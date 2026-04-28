defmodule ApiWeb.AIImportController do
  @moduledoc """
  AI-driven import of stations (stanoviště) from an uploaded document.

  Two endpoints:

    * `POST /api/races/:race_id/ai-import/extract` (multipart) — accepts a
      single file (`.pdf`, `.txt`, or `.md`, ≤5 MB) and returns a draft of
      stations + clarifying questions for the organizer.

    * `POST /api/races/:race_id/ai-import/refine` (json) — takes the
      `document_excerpt` echoed from extract, the draft, and the
      organizer's answers, and returns a final list of stations
      ready for preview / commit (commit goes via the bulk stations endpoint).

  Conversation state is held entirely on the FE — we don't persist anything
  during the AI conversation. Commit happens via
  `POST /api/races/:race_id/stations/bulk`.
  """

  use ApiWeb, :controller
  alias Api.AI.OpenAI
  alias Api.Races

  @max_size 5 * 1024 * 1024

  defp owner(conn), do: conn.assigns.organizer["id"]

  def extract(conn, %{"race_id" => rid, "file" => %Plug.Upload{} = upload}) do
    with :ok <- ensure_race(rid, owner(conn)),
         :ok <- check_size(upload.path),
         {:ok, payload} <- read_input(upload),
         {:ok, result} <- OpenAI.extract(payload) do
      conn |> put_status(200) |> json(result)
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "not_found"})

      {:error, :too_large} ->
        conn |> put_status(413) |> json(%{error: "file_too_large", limit_bytes: @max_size})

      {:error, :unsupported_type} ->
        conn
        |> put_status(415)
        |> json(%{error: "unsupported_media_type", allowed: ["pdf", "txt", "md"]})

      {:error, :invalid_format} ->
        conn
        |> put_status(422)
        |> json(%{error: "ai_invalid_format", detail: "AI returned malformed output twice."})

      _ ->
        conn |> put_status(502) |> json(%{error: "ai_upstream_error"})
    end
  end

  def extract(conn, _), do: conn |> put_status(400) |> json(%{error: "missing_file"})

  def refine(conn, %{
        "race_id" => rid,
        "document_excerpt" => excerpt,
        "draft_stations" => draft,
        "answers" => answers
      })
      when is_binary(excerpt) and is_list(draft) and is_list(answers) do
    with :ok <- ensure_race(rid, owner(conn)),
         {:ok, result} <- OpenAI.refine(excerpt, draft, answers) do
      conn |> put_status(200) |> json(result)
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "not_found"})

      {:error, :invalid_format} ->
        conn
        |> put_status(422)
        |> json(%{error: "ai_invalid_format", detail: "AI returned malformed output twice."})

      _ ->
        conn |> put_status(502) |> json(%{error: "ai_upstream_error"})
    end
  end

  def refine(conn, _), do: conn |> put_status(400) |> json(%{error: "bad_request"})

  # ---------- helpers ----------

  defp ensure_race(rid, owner) do
    case Races.get_race(rid, owner) do
      {:ok, _} -> :ok
      _ -> {:error, :not_found}
    end
  end

  defp check_size(path) do
    case File.stat(path) do
      {:ok, %File.Stat{size: size}} when size <= @max_size -> :ok
      {:ok, _} -> {:error, :too_large}
      _ -> {:error, :too_large}
    end
  end

  defp read_input(%Plug.Upload{filename: filename, content_type: ctype, path: path}) do
    cond do
      pdf?(filename, ctype) ->
        case File.read(path) do
          {:ok, bin} -> {:ok, {:pdf, filename, Base.encode64(bin)}}
          _ -> {:error, :unsupported_type}
        end

      text?(filename, ctype) ->
        case File.read(path) do
          {:ok, bin} -> {:ok, {:text, bin}}
          _ -> {:error, :unsupported_type}
        end

      true ->
        {:error, :unsupported_type}
    end
  end

  defp pdf?(filename, ctype) do
    ctype == "application/pdf" or String.ends_with?(String.downcase(filename || ""), ".pdf")
  end

  defp text?(filename, ctype) do
    String.starts_with?(ctype || "", "text/") or
      Enum.any?(
        [".txt", ".md", ".markdown"],
        &String.ends_with?(String.downcase(filename || ""), &1)
      )
  end
end
