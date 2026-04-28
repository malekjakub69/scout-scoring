defmodule Api.AuditLog do
  @moduledoc "Append-only log of all mutations + auth events."

  alias Api.SurrealDB

  # Wrap string fields that may look like "table:id" with type::string to
  # prevent SurrealDB 3's auto-coercion to a record reference.
  def log(action, actor, race_id, entity, payload \\ %{}) do
    {set, vars} =
      SurrealDB.build_set(
        race: race_id,
        payload: payload
      )

    set =
      [
        set,
        "action = type::string($action)",
        "actor = type::string($actor)",
        "entity = type::string($entity)"
      ]
      |> Enum.reject(&(&1 == ""))
      |> Enum.join(", ")

    vars =
      vars
      |> Map.put(:action, to_string(action))
      |> Map.put(:actor, to_string(actor || "system"))
      |> Map.put(:entity, (entity && to_string(entity)) || "")

    SurrealDB.query("CREATE audit_log SET #{set};", vars)
  end

  def list_for_race(race_id, limit \\ 200) do
    SurrealDB.all(
      "SELECT * FROM audit_log WHERE race = $race ORDER BY at DESC LIMIT #{limit};",
      %{race: race_id}
    )
  end
end
