defmodule Api.Accounts do
  @moduledoc "Organizer accounts — lookup, auth, invites."

  alias Api.SurrealDB

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
    hash = Bcrypt.hash_pwd_salt(pass)

    sql = """
    CREATE organizer SET
      email = $email,
      name = $name,
      password_hash = $hash,
      invited_by = $inviter;
    """

    SurrealDB.one(sql, %{
      email: email,
      name: name,
      hash: hash,
      inviter: inviter["id"]
    })
  end

  defp record_id(table, id) do
    case String.contains?(id, ":") do
      true -> id
      false -> "#{table}:#{id}"
    end
  end
end
