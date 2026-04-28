defmodule Api.AI.OpenAI do
  @moduledoc """
  OpenAI client for AI-driven document import (stanoviště).

  Uses the Responses API with structured outputs (`text.format = json_schema`)
  so the model is forced into a strict JSON shape. We still validate the parsed
  payload structurally and retry once on any failure (HTTP, refusal, parse,
  schema violation), passing the previous error back so the model can self-correct.
  After two failures we surface `{:error, :invalid_format}` to the controller.

  Two phases:

    * `extract/2` — receives the raw document (PDF base64 or plain text) and
      returns a draft of stations + a list of clarifying questions for the
      organizer. Also echoes a `document_excerpt` we can pass back into refine
      so we don't need to keep PDF bytes anywhere.

    * `refine/3` — takes that excerpt + draft + answers and returns the final
      list of stations ready for preview / commit.
  """

  require Logger

  @endpoint "https://api.openai.com/v1/responses"
  @default_model "gpt-5-mini"
  # gpt-5* are reasoning models — even at low effort they need a comfortable
  # margin, especially when a PDF attachment has to be parsed.
  @receive_timeout 180_000

  @system_prompt """
  Jsi asistent, který z dokumentu závodu skautských hlídek vytahuje seznam
  stanovišť (kontrolních bodů). Každé stanoviště má pořadí (position),
  název (name) a kritéria bodování (criteria) — seznam dvojic { name, max_points }.

  Pravidla:
  - Pokud dokument obsahuje rozpis stanovišť, extrahuj je v pořadí, v jakém
    jsou v dokumentu uvedena. Position číslujeme od 1.
  - Pokud u stanoviště nelze jednoznačně určit kritéria nebo body, polož
    konkrétní otázku v poli `questions`. Otázky musí být zodpověditelné
    krátkou odpovědí (číslo, věta).
  - Nikdy si nevymýšlej hodnoty — radši se zeptej.
  - V `document_excerpt` vrať doslovný úryvek z dokumentu, který se týká
    stanovišť (max ~6000 znaků), aby šlo později při zpřesnění odpovědí
    pokračovat bez původního souboru.
  """

  @refine_system_prompt """
  Jsi asistent, který na základě úryvku z dokumentu, draftu stanovišť
  a odpovědí organizátora vytvoří finální seznam stanovišť.

  Použij odpovědi organizátora jako autoritativní zdroj — pokud něco
  upřesnily, draft tomu přizpůsob. Vrať pole `stations`. Pokud po
  zpřesnění zůstává něco nejasné, raději zvol konzervativní výchozí
  hodnotu (max_points: 10) a pokračuj.
  """

  @doc """
  Extract a draft of stations from a document.

  `input` is one of:
    * `{:pdf, filename, base64_data}` — base64-encoded PDF bytes
    * `{:text, content}` — plain text / markdown
  """
  def extract(input, opts \\ []) do
    user_content = build_extract_content(input)

    request_with_retry(
      input: [
        %{role: "system", content: @system_prompt},
        %{role: "user", content: user_content}
      ],
      schema: extract_schema(),
      schema_name: "extracted_stations",
      validator: &validate_extract/1,
      opts: opts
    )
  end

  @doc """
  Refine a draft into final stations using organizer answers.
  """
  def refine(document_excerpt, draft, answers, opts \\ []) do
    user_payload =
      Jason.encode!(%{
        document_excerpt: document_excerpt,
        draft_stations: draft,
        answers: answers
      })

    request_with_retry(
      input: [
        %{role: "system", content: @refine_system_prompt},
        %{
          role: "user",
          content: [
            %{type: "input_text", text: user_payload}
          ]
        }
      ],
      schema: refine_schema(),
      schema_name: "final_stations",
      validator: &validate_refine/1,
      opts: opts
    )
  end

  # ---------- schemas ----------

  defp station_schema do
    %{
      "type" => "object",
      "additionalProperties" => false,
      "required" => ["name", "position", "criteria"],
      "properties" => %{
        "name" => %{"type" => "string"},
        "position" => %{"type" => "integer", "minimum" => 1},
        "criteria" => %{
          "type" => "array",
          "items" => %{
            "type" => "object",
            "additionalProperties" => false,
            "required" => ["name", "max_points"],
            "properties" => %{
              "name" => %{"type" => "string"},
              "max_points" => %{"type" => "integer", "minimum" => 0}
            }
          }
        }
      }
    }
  end

  defp extract_schema do
    %{
      "type" => "object",
      "additionalProperties" => false,
      "required" => ["document_excerpt", "draft_stations", "questions"],
      "properties" => %{
        "document_excerpt" => %{"type" => "string"},
        "draft_stations" => %{"type" => "array", "items" => station_schema()},
        "questions" => %{
          "type" => "array",
          "items" => %{
            "type" => "object",
            "additionalProperties" => false,
            "required" => ["id", "question", "context"],
            "properties" => %{
              "id" => %{"type" => "string"},
              "question" => %{"type" => "string"},
              "context" => %{"type" => ["string", "null"]}
            }
          }
        }
      }
    }
  end

  defp refine_schema do
    %{
      "type" => "object",
      "additionalProperties" => false,
      "required" => ["stations"],
      "properties" => %{
        "stations" => %{"type" => "array", "items" => station_schema()}
      }
    }
  end

  # ---------- request orchestration ----------

  defp build_extract_content({:pdf, filename, base64}) do
    [
      %{type: "input_text", text: "Vytáhni stanoviště z přiloženého dokumentu."},
      %{
        type: "input_file",
        filename: filename,
        file_data: "data:application/pdf;base64,#{base64}"
      }
    ]
  end

  defp build_extract_content({:text, content}) do
    [
      %{type: "input_text", text: "Vytáhni stanoviště z následujícího textu:\n\n" <> content}
    ]
  end

  defp request_with_retry(args) do
    case do_request(args, nil) do
      {:ok, payload} ->
        {:ok, payload}

      {:error, reason} ->
        Logger.warning("OpenAI first attempt failed: #{inspect(reason)} — retrying")

        case do_request(args, reason) do
          {:ok, payload} ->
            {:ok, payload}

          {:error, reason2} ->
            Logger.error("OpenAI retry failed: #{inspect(reason2)}")
            {:error, :invalid_format}
        end
    end
  end

  defp do_request(args, prior_error) do
    api_key = api_key!()
    model = Keyword.get(args[:opts], :model, default_model())

    input =
      case prior_error do
        nil ->
          args[:input]

        err ->
          args[:input] ++
            [
              %{
                role: "user",
                content:
                  "Předchozí odpověď nebyla validní (chyba: " <>
                    inspect(err) <>
                    "). Zkus to znovu, dodrž přesně schéma."
              }
            ]
      end

    body = %{
      model: model,
      input: input,
      # Extraction is a deterministic pattern-matching task — heavy reasoning
      # adds latency without improving output. Keep effort low so gpt-5-mini
      # finishes within our timeout even on multi-page PDFs.
      reasoning: %{effort: "low"},
      text: %{
        format: %{
          type: "json_schema",
          name: args[:schema_name],
          strict: true,
          schema: args[:schema]
        }
      }
    }

    case Req.post(@endpoint,
           headers: [
             {"Authorization", "Bearer #{api_key}"},
             {"Content-Type", "application/json"}
           ],
           json: body,
           receive_timeout: @receive_timeout
         ) do
      {:ok, %Req.Response{status: 200, body: resp}} ->
        with {:ok, text} <- extract_output_text(resp),
             {:ok, json} <- Jason.decode(text),
             {:ok, validated} <- args[:validator].(json) do
          {:ok, validated}
        end

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, {:http, status, summarize_error(body)}}

      {:error, reason} ->
        {:error, {:transport, inspect(reason)}}
    end
  end

  defp extract_output_text(%{"output" => output}) when is_list(output) do
    text =
      output
      |> Enum.flat_map(fn
        %{"content" => content} when is_list(content) -> content
        _ -> []
      end)
      |> Enum.find_value(fn
        %{"type" => "output_text", "text" => t} -> t
        %{"type" => "refusal", "refusal" => r} -> {:refusal, r}
        _ -> nil
      end)

    case text do
      nil -> {:error, :no_output_text}
      {:refusal, r} -> {:error, {:refusal, r}}
      t when is_binary(t) -> {:ok, t}
    end
  end

  defp extract_output_text(_), do: {:error, :unexpected_response_shape}

  # Defensive structural check on top of OpenAI's strict schema.
  defp validate_extract(%{
         "document_excerpt" => excerpt,
         "draft_stations" => draft,
         "questions" => questions
       })
       when is_binary(excerpt) and is_list(draft) and is_list(questions) do
    with {:ok, draft} <- validate_stations(draft),
         {:ok, questions} <- validate_questions(questions) do
      {:ok, %{document_excerpt: excerpt, draft_stations: draft, questions: questions}}
    end
  end

  defp validate_extract(_), do: {:error, :extract_shape}

  defp validate_refine(%{"stations" => stations}) when is_list(stations) do
    with {:ok, stations} <- validate_stations(stations) do
      {:ok, %{stations: stations}}
    end
  end

  defp validate_refine(_), do: {:error, :refine_shape}

  defp validate_stations(list) do
    list
    |> Enum.reduce_while({:ok, []}, fn s, {:ok, acc} ->
      case s do
        %{"name" => n, "position" => p, "criteria" => criteria}
        when is_binary(n) and is_integer(p) and is_list(criteria) ->
          if Enum.all?(criteria, &valid_criterion?/1) do
            {:cont,
             {:ok, [%{name: n, position: p, criteria: normalize_criteria(criteria)} | acc]}}
          else
            {:halt, {:error, :invalid_criterion}}
          end

        _ ->
          {:halt, {:error, :invalid_station}}
      end
    end)
    |> case do
      {:ok, list} -> {:ok, Enum.reverse(list)}
      err -> err
    end
  end

  defp valid_criterion?(%{"name" => n, "max_points" => m})
       when is_binary(n) and is_integer(m) and m >= 0,
       do: true

  defp valid_criterion?(_), do: false

  defp normalize_criteria(criteria) do
    Enum.map(criteria, fn %{"name" => n, "max_points" => m} -> %{name: n, max_points: m} end)
  end

  defp validate_questions(list) do
    if Enum.all?(list, fn
         %{"id" => id, "question" => q} when is_binary(id) and is_binary(q) -> true
         _ -> false
       end) do
      {:ok,
       Enum.map(list, fn q ->
         %{id: q["id"], question: q["question"], context: q["context"]}
       end)}
    else
      {:error, :invalid_question}
    end
  end

  defp api_key! do
    case System.get_env("OPENAI_API_KEY") do
      key when is_binary(key) and byte_size(key) > 0 -> key
      _ -> raise "OPENAI_API_KEY is not set"
    end
  end

  defp default_model do
    case System.get_env("OPENAI_MODEL") do
      model when is_binary(model) and byte_size(model) > 0 -> model
      _ -> @default_model
    end
  end

  defp summarize_error(%{"error" => %{"message" => m}}), do: m
  defp summarize_error(other), do: inspect(other) |> String.slice(0, 300)
end
