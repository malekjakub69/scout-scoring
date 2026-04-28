defmodule Api.Races do
  @moduledoc "Race / Category / Patrol / Station context."

  alias Api.{SurrealDB, Auth.StationToken, AuditLog}

  # ---------- Race ----------

  def list_races(organizer_id) do
    SurrealDB.all(
      "SELECT * FROM race WHERE owner = $owner ORDER BY created_at DESC;",
      %{owner: organizer_id}
    )
  end

  def get_race(id, organizer_id) do
    case SurrealDB.one(
           "SELECT * FROM $id WHERE owner = $owner;",
           %{id: id, owner: organizer_id}
         ) do
      {:ok, race} when is_map(race) -> {:ok, race}
      _ -> {:error, :not_found}
    end
  end

  def create_race(organizer_id, attrs) do
    {set, vars} =
      SurrealDB.build_set(
        name: attrs["name"],
        held_on: attrs["held_on"],
        location: attrs["location"],
        owner: organizer_id,
        scoring_model: attrs["scoring_model"] || "sum_points",
        time_tracking: attrs["time_tracking"] || "none"
      )

    with {:ok, race} <- SurrealDB.one("CREATE race SET #{set};", vars) do
      AuditLog.log("race.create", organizer_id, race["id"], race["id"], %{name: race["name"]})
      {:ok, race}
    end
  end

  def update_race(id, organizer_id, attrs) do
    {set, vars} =
      SurrealDB.build_set(
        name: attrs["name"],
        held_on: attrs["held_on"],
        location: attrs["location"],
        scoring_model: attrs["scoring_model"],
        time_tracking: attrs["time_tracking"]
      )

    vars = Map.merge(vars, %{id: id, owner: organizer_id})

    case SurrealDB.one("UPDATE $id SET #{set} WHERE owner = $owner;", vars) do
      {:ok, race} when is_map(race) ->
        AuditLog.log("race.update", organizer_id, id, id, attrs)
        {:ok, race}

      _ ->
        {:error, :not_found}
    end
  end

  def activate_race(id, organizer_id) do
    with {:ok, race} <- get_race(id, organizer_id),
         {:ok, stations} <- list_stations(id, organizer_id),
         {:ok, issued} <- issue_tokens_for(race, stations),
         {:ok, activated_race} <-
           SurrealDB.one(
             "UPDATE $id SET state = 'active', activated_at = time::now() WHERE owner = $owner;",
             %{id: id, owner: organizer_id}
           ) do
      AuditLog.log("race.activate", organizer_id, id, id, %{})
      {:ok, Map.put(issued, :race, activated_race)}
    end
  end

  @doc """
  Re-issues fresh station tokens, PINs, and QR URLs for every station on
  an already-active race. Rotating invalidates any previously-printed QR
  codes — that's the feature, not a bug.
  """
  def reissue_station_tokens(race_id, organizer_id) do
    with {:ok, race} <- get_race(race_id, organizer_id),
         {:ok, stations} <- list_stations(race_id, organizer_id),
         {:ok, issued} <- issue_tokens_for(race, stations) do
      AuditLog.log("race.reissue_tokens", organizer_id, race_id, race_id, %{})
      {:ok, issued}
    end
  end

  defp issue_tokens_for(%{"id" => race_id}, stations) do
    base = web_base_url()

    updated =
      Enum.map(stations, fn %{"id" => sid} = station ->
        pin = StationToken.generate_pin()
        nonce = StationToken.generate_nonce()

        SurrealDB.query(
          "UPDATE $id SET access_token_hash = $nonce, pin = $pin, is_active = true;",
          %{id: sid, pin: pin, nonce: nonce}
        )

        Map.merge(station, %{
          "pin" => pin,
          "access_token_hash" => nonce,
          "qr_url" => "#{base}/station/#{sid}?pin=#{pin}"
        })
      end)

    {:ok, %{race_id: race_id, stations: updated}}
  end

  defp web_base_url do
    Application.get_env(:api, :web_base_url, "http://localhost:3000")
  end

  def close_race(id, organizer_id) do
    sql = "UPDATE $id SET state = 'closed', closed_at = time::now() WHERE owner = $owner;"

    with {:ok, race} when is_map(race) <-
           SurrealDB.one(sql, %{id: id, owner: organizer_id}) do
      SurrealDB.query(
        "UPDATE station SET is_active = false WHERE race = $race;",
        %{race: id}
      )

      AuditLog.log("race.close", organizer_id, id, id, %{})
      {:ok, race}
    else
      _ -> {:error, :not_found}
    end
  end

  # ---------- Category ----------

  def list_categories(race_id, organizer_id) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      SurrealDB.all(
        "SELECT * FROM category WHERE race = $race ORDER BY name;",
        %{race: race_id}
      )
    end
  end

  def create_category(race_id, organizer_id, attrs) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      SurrealDB.one(
        "CREATE category SET race = $race, name = $name, scored = $scored;",
        %{race: race_id, name: attrs["name"], scored: attrs["scored"] != false}
      )
    end
  end

  def delete_category(id, organizer_id) do
    with {:ok, category} when is_map(category) <-
           SurrealDB.one(
             "SELECT * FROM $id WHERE race.owner = $owner LIMIT 1;",
             %{id: id, owner: organizer_id}
           ),
         {:ok, nil} <-
           SurrealDB.one(
             "SELECT id FROM patrol WHERE category = $category LIMIT 1;",
             %{category: id}
           ),
         {:ok, _} <- SurrealDB.query("DELETE $id;", %{id: id}) do
      AuditLog.log("category.delete", organizer_id, category["race"], id, %{
        name: category["name"]
      })

      {:ok, :deleted}
    else
      {:ok, nil} -> {:error, :not_found}
      {:error, _} = err -> err
      _ -> {:error, :category_has_patrols}
    end
  end

  # ---------- Patrol ----------

  def list_patrols(race_id, organizer_id) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      SurrealDB.all(
        "SELECT * FROM patrol WHERE race = $race ORDER BY start_number;",
        %{race: race_id}
      )
    end
  end

  def list_patrols_public(race_id) do
    # Used by station clients: only minimal fields, no organizer auth needed.
    SurrealDB.all(
      "SELECT id, start_number, name, category FROM patrol WHERE race = $race ORDER BY start_number;",
      %{race: race_id}
    )
  end

  def create_patrol(race_id, organizer_id, attrs) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      sql = """
      CREATE patrol SET
        race = $race,
        category = $category,
        start_number = $start_number,
        name = $name,
        members = $members;
      """

      SurrealDB.one(sql, %{
        race: race_id,
        category: attrs["category"],
        start_number: attrs["start_number"],
        name: attrs["name"],
        members: attrs["members"] || []
      })
    end
  end

  def bulk_create_patrols(race_id, organizer_id, patrols) when is_list(patrols) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      results =
        Enum.map(patrols, fn attrs ->
          case create_patrol(race_id, organizer_id, attrs) do
            {:ok, p} -> {:ok, p}
            err -> {:error, %{attrs: attrs, error: inspect(err)}}
          end
        end)

      failures = Enum.filter(results, &match?({:error, _}, &1))

      if failures == [] do
        {:ok, Enum.map(results, fn {:ok, p} -> p end)}
      else
        {:partial,
         %{
           created: Enum.count(results, &match?({:ok, _}, &1)),
           failed: Enum.map(failures, fn {:error, e} -> e end)
         }}
      end
    end
  end

  def update_patrol(id, organizer_id, attrs) do
    sql = """
    UPDATE $id SET
      category = $category,
      start_number = $start_number,
      name = $name,
      members = $members
    WHERE race.owner = $owner;
    """

    SurrealDB.one(sql, %{
      id: id,
      owner: organizer_id,
      category: attrs["category"],
      start_number: attrs["start_number"],
      name: attrs["name"],
      members: attrs["members"] || []
    })
  end

  def delete_patrol(id, organizer_id) do
    with {:ok, patrol} when is_map(patrol) <-
           SurrealDB.one(
             "SELECT id FROM $id WHERE race.owner = $owner LIMIT 1;",
             %{id: id, owner: organizer_id}
           ),
         {:ok, _} <- SurrealDB.query("DELETE $id;", %{id: patrol["id"]}) do
      {:ok, :deleted}
    else
      {:ok, nil} -> {:error, :not_found}
      err -> err
    end
  end

  # ---------- Station ----------

  def list_stations(race_id, organizer_id) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      SurrealDB.all(
        "SELECT * FROM station WHERE race = $race ORDER BY position, name;",
        %{race: race_id}
      )
    end
  end

  def create_station(race_id, organizer_id, attrs) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      sql = """
      CREATE station SET
        race = $race,
        name = $name,
        position = $position,
        criteria = $criteria;
      """

      SurrealDB.one(sql, %{
        race: race_id,
        name: attrs["name"],
        position: attrs["position"] || 0,
        criteria: attrs["criteria"] || []
      })
    end
  end

  def bulk_create_stations(race_id, organizer_id, stations) when is_list(stations) do
    with {:ok, _} <- get_race(race_id, organizer_id) do
      results =
        Enum.map(stations, fn attrs ->
          case create_station(race_id, organizer_id, attrs) do
            {:ok, s} -> {:ok, s}
            err -> {:error, %{attrs: attrs, error: inspect(err)}}
          end
        end)

      failures = Enum.filter(results, &match?({:error, _}, &1))

      if failures == [] do
        {:ok, Enum.map(results, fn {:ok, s} -> s end)}
      else
        {:partial,
         %{
           created: Enum.count(results, &match?({:ok, _}, &1)),
           failed: Enum.map(failures, fn {:error, e} -> e end)
         }}
      end
    end
  end

  def update_station(id, organizer_id, attrs) do
    sql = """
    UPDATE $id SET
      name = $name,
      position = $position,
      criteria = $criteria
    WHERE race.owner = $owner;
    """

    SurrealDB.one(sql, %{
      id: id,
      owner: organizer_id,
      name: attrs["name"],
      position: attrs["position"] || 0,
      criteria: attrs["criteria"] || []
    })
  end

  def deactivate_station(id, organizer_id) do
    sql = "UPDATE $id SET is_active = false, access_token_hash = NONE WHERE race.owner = $owner;"

    case SurrealDB.one(sql, %{id: id, owner: organizer_id}) do
      {:ok, station} when is_map(station) -> {:ok, station}
      {:ok, nil} -> {:error, :not_found}
      err -> err
    end
  end

  def reset_station_pin(id, organizer_id) do
    pin = StationToken.generate_pin()
    nonce = StationToken.generate_nonce()

    sql = """
    UPDATE $id SET
      access_token_hash = $nonce,
      pin = $pin,
      is_active = true
    WHERE race.owner = $owner AND race.state = 'active';
    """

    case SurrealDB.one(sql, %{id: id, owner: organizer_id, pin: pin, nonce: nonce}) do
      {:ok, station} when is_map(station) ->
        {:ok, Map.put(station, "qr_url", "#{web_base_url()}/station/#{station["id"]}?pin=#{pin}")}

      {:ok, nil} ->
        {:error, :not_found}

      err ->
        err
    end
  end

  @doc "Lookup a station by id, only if active and race not closed. Used by station-auth plug."
  def get_active_station(id) do
    sql = """
    SELECT *, race.state AS race_state
    FROM $id
    WHERE is_active = true AND race.state = 'active'
    LIMIT 1;
    """

    case SurrealDB.one(sql, %{id: id}) do
      {:ok, station} when is_map(station) -> {:ok, station}
      _ -> {:error, :not_found}
    end
  end

  def authenticate_station_pin(id, pin) when is_binary(pin) do
    with {:ok, station} <- get_active_station(id),
         true <- station["pin"] == pin do
      {:ok, station}
    else
      _ -> {:error, :invalid_pin}
    end
  end

  def authenticate_station_pin(_id, _pin), do: {:error, :invalid_pin}
end
