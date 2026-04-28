defmodule ApiWeb.PatrolController do
  use ApiWeb, :controller
  alias Api.Races

  defp owner(conn), do: conn.assigns.organizer["id"]

  def index(conn, %{"race_id" => rid}) do
    case Races.list_patrols(rid, owner(conn)) do
      {:ok, data} -> json(conn, %{data: data})
      _ -> conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def create(conn, %{"race_id" => rid} = params) do
    case Races.create_patrol(rid, owner(conn), params) do
      {:ok, p} -> conn |> put_status(201) |> json(p)
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def bulk_create(conn, %{"race_id" => rid, "patrols" => patrols}) when is_list(patrols) do
    case Races.bulk_create_patrols(rid, owner(conn), patrols) do
      {:ok, created} -> conn |> put_status(201) |> json(%{created: length(created)})
      {:partial, report} -> conn |> put_status(207) |> json(report)
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Races.update_patrol(id, owner(conn), params) do
      {:ok, p} -> json(conn, p)
      _ -> conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def delete(conn, %{"id" => id}) do
    case Races.delete_patrol(id, owner(conn)) do
      {:ok, :deleted} -> send_resp(conn, 204, "")
      {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "not_found"})
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end
end
