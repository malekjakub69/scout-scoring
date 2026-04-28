defmodule ApiWeb.Plugs.AuthenticateOrganizer do
  @moduledoc "Extracts Bearer JWT, verifies it, loads organizer → conn.assigns.organizer"
  import Plug.Conn

  alias Api.Auth.Guardian

  def init(opts), do: opts

  def call(conn, _opts) do
    with [<<"Bearer ", token::binary>>] <- get_req_header(conn, "authorization"),
         {:ok, claims} <- Guardian.decode_and_verify(token),
         {:ok, organizer} <- Guardian.resource_from_claims(claims) do
      conn
      |> assign(:organizer, organizer)
      |> assign(:actor, organizer["id"])
    else
      _ ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(401, Jason.encode!(%{error: "unauthorized"}))
        |> halt()
    end
  end
end
