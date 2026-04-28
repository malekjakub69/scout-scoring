defmodule ApiWeb.StationAdminController do
  @moduledoc "Organizer-facing station management (create / edit / deactivate)."
  use ApiWeb, :controller
  alias Api.Races

  defp owner(conn), do: conn.assigns.organizer["id"]

  def index(conn, %{"race_id" => rid}) do
    case Races.list_stations(rid, owner(conn)) do
      {:ok, data} -> json(conn, %{data: data})
      _ -> conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def create(conn, %{"race_id" => rid} = params) do
    case Races.create_station(rid, owner(conn), params) do
      {:ok, s} -> conn |> put_status(201) |> json(s)
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def bulk_create(conn, %{"race_id" => rid, "stations" => stations}) when is_list(stations) do
    case Races.bulk_create_stations(rid, owner(conn), stations) do
      {:ok, created} ->
        conn |> put_status(201) |> json(%{created: length(created), data: created})

      {:partial, report} ->
        conn |> put_status(207) |> json(report)

      _ ->
        conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def bulk_create(conn, _), do: conn |> put_status(400) |> json(%{error: "bad_request"})

  def update(conn, %{"id" => id} = params) do
    case Races.update_station(id, owner(conn), params) do
      {:ok, s} -> json(conn, s)
      _ -> conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def deactivate(conn, %{"id" => id}) do
    case Races.deactivate_station(id, owner(conn)) do
      {:ok, _station} -> send_resp(conn, 204, "")
      {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "not_found"})
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def reset_pin(conn, %{"id" => id}) do
    case Races.reset_station_pin(id, owner(conn)) do
      {:ok, station} -> json(conn, station)
      {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "not_found"})
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end
end
