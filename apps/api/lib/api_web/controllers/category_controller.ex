defmodule ApiWeb.CategoryController do
  use ApiWeb, :controller
  alias Api.Races

  defp owner(conn), do: conn.assigns.organizer["id"]

  def index(conn, %{"race_id" => rid}) do
    case Races.list_categories(rid, owner(conn)) do
      {:ok, data} -> json(conn, %{data: data})
      _ -> conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def create(conn, %{"race_id" => rid} = params) do
    case Races.create_category(rid, owner(conn), params) do
      {:ok, cat} -> conn |> put_status(201) |> json(cat)
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end

  def delete(conn, %{"id" => id}) do
    case Races.delete_category(id, owner(conn)) do
      {:ok, :deleted} ->
        json(conn, %{ok: true})

      {:error, :category_has_patrols} ->
        conn |> put_status(409) |> json(%{error: "category_has_patrols"})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "not_found"})

      _ ->
        conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end
end
