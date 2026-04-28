defmodule Api.Auth.Guardian do
  use Guardian, otp_app: :api

  alias Api.Accounts

  @impl true
  def subject_for_token(%{"id" => id}, _claims) when is_binary(id), do: {:ok, id}
  def subject_for_token(_, _), do: {:error, :invalid_subject}

  @impl true
  def resource_from_claims(%{"sub" => "organizer:" <> _ = id}) do
    case Accounts.get_organizer(id) do
      nil -> {:error, :not_found}
      org -> {:ok, org}
    end
  end

  def resource_from_claims(_), do: {:error, :invalid_subject}
end
