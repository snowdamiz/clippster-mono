defmodule ClippsterServerWeb.BrollController do
  use ClippsterServerWeb, :controller
  require Logger

  alias ClippsterServer.AI.BrollPlanner
  alias ClippsterServer.Media.{PexelsClient, PixabayClient}

  @doc """
  POST /api/ai/broll/suggest
  Returns timed B-roll suggestions from transcript analysis.
  """
  def suggest(conn, params) do
    case BrollPlanner.suggest(params) do
      {:ok, suggestions} ->
        json(conn, %{
          suggestions: Enum.map(suggestions, &camelize_suggestion/1)
        })

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})
    end
  rescue
    exception ->
      Logger.error(
        "[BrollController] suggest failed: #{Exception.format(:error, exception, __STACKTRACE__)}"
      )

      conn
      |> put_status(:internal_server_error)
      |> json(%{error: "B-roll planning failed"})
  end

  @doc """
  GET /api/ai/broll/search
  Search stock providers for B-roll candidates.
  """
  def search(conn, params) do
    query = String.trim(params["query"] || "")

    if query == "" do
      conn
      |> put_status(:bad_request)
      |> json(%{error: "query is required"})
    else
      provider = params["provider"] || "all"
      orientation = params["orientation"] || "portrait"
      page = parse_int(params["page"], 1)
      per_page = parse_int(params["per_page"] || params["perPage"], 8)
      media_type = params["media_type"] || params["mediaType"] || "video"

      opts = [orientation: orientation, page: page, per_page: per_page, media_type: media_type]

      result =
        case provider do
          "all" ->
            search_all_providers(query, opts)

          "pixabay" ->
            search_single_provider("pixabay", &PixabayClient.search/2, query, opts)

          "pexels" ->
            search_single_provider("pexels", &PexelsClient.search/2, query, opts)

          _ ->
            search_all_providers(query, opts)
        end

      case result do
        {:ok, provider_used, candidates} ->
          json(conn, %{
            provider: provider_used,
            query: query,
            candidates: candidates
          })

        {:error, reason} ->
          conn
          |> put_status(:service_unavailable)
          |> json(%{error: reason})
      end
    end
  end

  defp search_all_providers(query, opts) do
    results = [
      {"pexels", PexelsClient.search(query, opts)},
      {"pixabay", PixabayClient.search(query, opts)}
    ]

    successes =
      results
      |> Enum.flat_map(fn
        {provider, {:ok, candidates}} when is_list(candidates) -> [{provider, candidates}]
        _ -> []
      end)

    if successes == [] do
      cond do
        Enum.any?(results, fn {_provider, result} -> result == {:error, :not_configured} end) ->
          {:error, "No stock media providers configured (PEXELS_API_KEY or PIXABAY_API_KEY)"}

        true ->
          {_provider, {:error, reason}} =
            Enum.find(results, fn {_provider, result} -> match?({:error, _}, result) end) ||
              {"stock", {:error, "No stock media found"}}

          {:error, reason}
      end
    else
      candidates =
        successes
        |> Enum.map(fn {_provider, candidates} -> candidates end)
        |> interleave_candidates()
        |> Enum.take(Keyword.get(opts, :per_page, 20))

      {:ok, "mixed", candidates}
    end
  end

  defp search_single_provider(provider, search_fun, query, opts) do
    case search_fun.(query, opts) do
      {:ok, candidates} ->
        {:ok, provider, candidates}

      {:error, :not_configured} ->
        {:error, "#{provider} is not configured"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp interleave_candidates(candidate_lists) do
    candidate_lists
    |> Enum.reject(&(&1 == []))
    |> do_interleave([])
  end

  defp do_interleave([], acc), do: Enum.reverse(acc)

  defp do_interleave(lists, acc) do
    {heads, tails} =
      lists
      |> Enum.map(fn
        [head | tail] -> {head, tail}
        [] -> nil
      end)
      |> Enum.reject(&is_nil/1)
      |> Enum.unzip()

    do_interleave(Enum.reject(tails, &(&1 == [])), Enum.reverse(heads) ++ acc)
  end

  defp camelize_suggestion(s) do
    %{
      id: s["id"],
      clipId: s["clipId"],
      startTime: s["startTime"],
      endTime: s["endTime"],
      transcriptText: s["transcriptText"],
      reason: s["reason"],
      visualQuery: s["visualQuery"],
      generationPrompt: s["generationPrompt"],
      sourceType: s["sourceType"],
      status: s["status"] || "suggested",
      confidence: s["confidence"],
      candidates: s["candidates"] || []
    }
  end

  defp parse_int(v, default) when is_binary(v) do
    case Integer.parse(v) do
      {i, _} -> i
      :error -> default
    end
  end

  defp parse_int(v, _default) when is_integer(v), do: v
  defp parse_int(_, default), do: default
end
