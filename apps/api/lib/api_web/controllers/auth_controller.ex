defmodule ApiWeb.AuthController do
  use ApiWeb, :controller

  alias Api.{Accounts, Auth.Guardian, AuditLog}

  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate(email, password) do
      {:ok, org} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(org, %{}, ttl: {12, :hours})
        AuditLog.log("auth.login", org["id"], nil, org["id"])

        json(conn, %{
          token: token,
          organizer: %{id: org["id"], email: org["email"], name: org["name"]}
        })

      {:error, :invalid_credentials} ->
        conn
        |> put_status(401)
        |> json(%{error: "invalid_credentials"})
    end
  end

  def login(conn, _), do: conn |> put_status(400) |> json(%{error: "missing_fields"})

  def me(conn, _) do
    org = conn.assigns.organizer
    json(conn, %{id: org["id"], email: org["email"], name: org["name"]})
  end

  def invite(conn, params) do
    case Accounts.invite(conn.assigns.organizer, params) do
      {:ok, org} -> conn |> put_status(201) |> json(%{id: org["id"], email: org["email"]})
      _ -> conn |> put_status(422) |> json(%{error: "unprocessable_entity"})
    end
  end
end
