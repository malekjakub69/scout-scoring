defmodule ApiWeb.HealthController do
  use ApiWeb, :controller

  def show(conn, _) do
    db =
      case Api.SurrealDB.health() do
        :ok -> "ok"
        _ -> "down"
      end

    json(conn, %{status: "ok", db: db})
  end
end
