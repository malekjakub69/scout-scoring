defmodule Api.DB.Migrate do
  @moduledoc """
  Applies SurrealDB migrations from `priv/surreal/migrations/*.surql`.

  On every call (also on server startup) it:

    1. Ensures the configured namespace and database exist.
    2. Ensures the `_migration` tracking table exists.
    3. Applies every migration file whose name is not yet recorded in
       `_migration`, in lexicographic order (use `NNN_name.surql`).

  Individual files should use `DEFINE ... IF NOT EXISTS` for safety, but are
  only sent to SurrealDB once thanks to the tracking table.
  """

  require Logger

  @migrations_subdir "surreal/migrations"

  @spec run() :: :ok | {:error, term()}
  def run do
    {:ok, _} = Application.ensure_all_started(:req)

    cfg = Application.fetch_env!(:api, Api.SurrealDB)

    with :ok <- ensure_namespace_and_db(cfg),
         :ok <- ensure_migration_table(),
         {:ok, applied} <- fetch_applied(),
         :ok <- apply_pending(applied) do
      :ok
    end
  end

  # -- NS/DB bootstrap ------------------------------------------------------

  # Runs at the root level (no NS/DB headers) because NS/DB may not exist yet.
  defp ensure_namespace_and_db(cfg) do
    sql = """
    DEFINE NAMESPACE IF NOT EXISTS #{cfg[:namespace]};
    USE NAMESPACE #{cfg[:namespace]};
    DEFINE DATABASE IF NOT EXISTS #{cfg[:database]};
    """

    headers = [
      {"Accept", "application/json"},
      {"Content-Type", "text/plain"}
    ]

    case Req.post(cfg[:url] <> "/sql",
           headers: headers,
           auth: {:basic, "#{cfg[:user]}:#{cfg[:pass]}"},
           body: sql,
           receive_timeout: 10_000
         ) do
      {:ok, %Req.Response{status: 200}} ->
        Logger.debug("NS '#{cfg[:namespace]}' / DB '#{cfg[:database]}' ensured")
        :ok

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, {:http, status, body}}

      {:error, reason} ->
        {:error, {:transport, reason}}
    end
  end

  # -- migration tracking ---------------------------------------------------

  defp ensure_migration_table do
    sql = """
    DEFINE TABLE IF NOT EXISTS _migration SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS name ON _migration TYPE string;
    DEFINE FIELD IF NOT EXISTS applied_at ON _migration TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS _migration_name_unique ON _migration FIELDS name UNIQUE;
    """

    case Api.SurrealDB.script(sql) do
      {:ok, results} -> check_results(results, "create _migration")
      {:error, reason} -> {:error, reason}
    end
  end

  defp fetch_applied do
    case Api.SurrealDB.query("SELECT name FROM _migration", %{}) do
      {:ok, rows} ->
        names =
          rows
          |> List.wrap()
          |> Enum.map(&Map.get(&1, "name"))
          |> Enum.reject(&is_nil/1)
          |> MapSet.new()

        {:ok, names}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp record_applied(name) do
    case Api.SurrealDB.query(
           "CREATE _migration SET name = $name, applied_at = time::now()",
           %{name: name}
         ) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # -- migration files ------------------------------------------------------

  defp apply_pending(applied) do
    files = list_migration_files()

    pending =
      files
      |> Enum.reject(fn {name, _path} -> MapSet.member?(applied, name) end)

    if pending == [] do
      Logger.info(
        "SurrealDB migrations up to date (#{length(files)} known, #{MapSet.size(applied)} applied)"
      )

      :ok
    else
      Logger.info("Applying #{length(pending)} pending SurrealDB migration(s)")

      Enum.reduce_while(pending, :ok, fn {name, path}, _acc ->
        case apply_one(name, path) do
          :ok -> {:cont, :ok}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  defp list_migration_files do
    dir = Path.join(:code.priv_dir(:api), @migrations_subdir)

    dir
    |> Path.join("*.surql")
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.map(fn path -> {Path.basename(path), path} end)
  end

  defp apply_one(name, path) do
    Logger.info("Applying migration #{name}")
    sql = File.read!(path)

    with {:ok, results} <- Api.SurrealDB.script(sql),
         :ok <- check_results(results, name),
         :ok <- record_applied(name) do
      Logger.info("Migration #{name} OK (#{length(results)} stmt)")
      :ok
    else
      {:error, reason} ->
        Logger.error("Migration #{name} failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp check_results(results, label) do
    errors =
      results
      |> Enum.with_index()
      |> Enum.filter(fn {r, _} -> Map.get(r, "status") == "ERR" end)

    if errors == [] do
      :ok
    else
      Enum.each(errors, fn {r, i} ->
        Logger.error("#{label} stmt ##{i + 1}: #{inspect(r)}")
      end)

      {:error, :schema_failed}
    end
  end
end
