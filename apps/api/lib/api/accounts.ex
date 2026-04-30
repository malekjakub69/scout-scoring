defmodule Api.Accounts do
  @moduledoc "Organizer accounts — lookup, auth, invites."

  alias Api.SurrealDB

  @generated_password_bytes 12

  def get_organizer(id) when is_binary(id) do
    case SurrealDB.one("SELECT * FROM $id;", %{id: record_id("organizer", id)}) do
      {:ok, org} when is_map(org) -> org
      _ -> nil
    end
  end

  def get_by_email(email) do
    case SurrealDB.one("SELECT * FROM organizer WHERE email = $email LIMIT 1;", %{email: email}) do
      {:ok, org} when is_map(org) -> org
      _ -> nil
    end
  end

  def list_organizers do
    SurrealDB.all(
      "SELECT id, email, name, is_admin, created_at FROM organizer ORDER BY email;",
      %{}
    )
  end

  def update_admin(id, is_admin) when is_boolean(is_admin) do
    org_id = record_id("organizer", id)

    with :ok <- ensure_can_change_admin(org_id, is_admin) do
      SurrealDB.one("UPDATE $id SET is_admin = $is_admin;", %{id: org_id, is_admin: is_admin})
    end
  end

  def reset_password(id) do
    org_id = record_id("organizer", id)
    pass = generate_password()
    hash = Bcrypt.hash_pwd_salt(pass)

    case SurrealDB.one("UPDATE $id SET password_hash = $hash;", %{id: org_id, hash: hash}) do
      {:ok, organizer} when is_map(organizer) -> {:ok, Map.put(organizer, "password", pass)}
      other -> other
    end
  end

  def delete_organizer(id) do
    org_id = record_id("organizer", id)

    with {:ok, owned} <-
           SurrealDB.all("SELECT id FROM race WHERE owner = $organizer;", %{organizer: org_id}),
         true <- owned == [],
         :ok <- ensure_can_delete_admin(org_id),
         {:ok, _} <-
           SurrealDB.query("DELETE race_member WHERE organizer = $organizer;", %{
             organizer: org_id
           }),
         {:ok, _} <- SurrealDB.query("DELETE $id;", %{id: org_id}) do
      {:ok, :deleted}
    else
      false -> {:error, :organizer_owns_races}
      {:error, _} = err -> err
      _ -> {:error, :not_found}
    end
  end

  def list_race_assignments(id) do
    org_id = record_id("organizer", id)

    with {:ok, owned} <-
           SurrealDB.all("SELECT id FROM race WHERE owner = $organizer;", %{organizer: org_id}),
         {:ok, memberships} <-
           SurrealDB.all(
             "SELECT id, race, role FROM race_member WHERE organizer = $organizer;",
             %{organizer: org_id}
           ) do
      owner_assignments =
        Enum.map(owned, fn %{"id" => race_id} ->
          %{"race_id" => race_id, "role" => "owner", "membership_id" => nil}
        end)

      owned_race_ids = MapSet.new(Enum.map(owner_assignments, & &1["race_id"]))

      member_assignments =
        memberships
        |> Enum.reject(fn member -> MapSet.member?(owned_race_ids, member["race"]) end)
        |> Enum.map(fn member ->
          %{
            "race_id" => member["race"],
            "role" => member["role"],
            "membership_id" => member["id"]
          }
        end)

      {:ok, owner_assignments ++ member_assignments}
    end
  end

  def authenticate(email, password) do
    case get_by_email(email) do
      nil ->
        # run a dummy hash check to avoid timing oracles
        Bcrypt.no_user_verify()
        {:error, :invalid_credentials}

      %{"password_hash" => hash} = org ->
        if Bcrypt.verify_pass(password, hash),
          do: {:ok, org},
          else: {:error, :invalid_credentials}
    end
  end

  def invite(inviter, %{"email" => email, "name" => name, "password" => pass}) do
    create_organizer(inviter, %{"email" => email, "name" => name, "password" => pass})
  end

  def create_organizer(creator, attrs) do
    pass = attrs["password"] || generate_password()
    email = attrs["email"]
    name = attrs["name"]
    is_admin = attrs["is_admin"] == true
    hash = Bcrypt.hash_pwd_salt(pass)

    sql = """
    CREATE organizer SET
      email = $email,
      name = $name,
      password_hash = $hash,
      invited_by = $creator,
      is_admin = $is_admin;
    """

    case SurrealDB.one(sql, %{
           email: email,
           name: name,
           hash: hash,
           creator: creator["id"],
           is_admin: is_admin
         }) do
      {:ok, organizer} when is_map(organizer) ->
        {:ok, Map.put(organizer, "password", pass)}

      other ->
        other
    end
  end

  def generate_password do
    @generated_password_bytes
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp ensure_can_change_admin(org_id, false), do: ensure_not_last_admin(org_id)
  defp ensure_can_change_admin(_org_id, true), do: :ok

  defp ensure_can_delete_admin(org_id), do: ensure_not_last_admin(org_id)

  defp ensure_not_last_admin(org_id) do
    case get_organizer(org_id) do
      %{"is_admin" => true} ->
        case SurrealDB.one(
               "SELECT count() AS count FROM organizer WHERE is_admin = true GROUP ALL;",
               %{}
             ) do
          {:ok, %{"count" => count}} when count > 1 -> :ok
          _ -> {:error, :last_admin}
        end

      %{} ->
        :ok

      _ ->
        {:error, :not_found}
    end
  end

  defp record_id(table, id) do
    case String.contains?(id, ":") do
      true -> id
      false -> "#{table}:#{id}"
    end
  end
end
