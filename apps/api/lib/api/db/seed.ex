defmodule Api.DB.Seed do
  @moduledoc """
  Seeds the first organizer account from env vars. Idempotent.

      SEED_EMAIL=admin@example.com SEED_PASS=... SEED_NAME="Admin" mix scout.seed
  """

  require Logger

  def run do
    {:ok, _} = Application.ensure_all_started(:req)

    email = System.get_env("SEED_EMAIL") || "admin@example.com"
    pass = System.get_env("SEED_PASS") || "changeme123"
    name = System.get_env("SEED_NAME") || "Admin"

    case Api.SurrealDB.one("SELECT id FROM organizer WHERE email = $email LIMIT 1;", %{
           email: email
         }) do
      {:ok, existing} when is_map(existing) ->
        Logger.info("Seed OK — organizer already exists: #{email}")
        :ok

      {:ok, nil} ->
        create_organizer(email, pass, name)

      {:error, reason} ->
        Logger.error("Seed lookup failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp create_organizer(email, pass, name) do
    hash = Bcrypt.hash_pwd_salt(pass)

    case Api.SurrealDB.one(
           "CREATE organizer SET email = $email, name = $name, password_hash = $hash;",
           %{email: email, name: name, hash: hash}
         ) do
      {:ok, organizer} when is_map(organizer) ->
        Logger.info("Seed OK — organizer created: #{email}")
        :ok

      {:error, reason} ->
        Logger.error("Seed create failed: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
