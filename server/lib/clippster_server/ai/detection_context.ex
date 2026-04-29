defmodule ClippsterServer.AI.DetectionContext do
  @moduledoc """
  Builds concise context appendices for single-model clip detection.
  """

  alias ClippsterServer.AI.StreamerReach
  alias ClippsterServer.News

  @doc """
  Builds a prompt appendix from user prompt category, transcript terms, news, and streamer metadata.
  """
  @spec build(String.t(), map() | nil, map() | nil) :: String.t()
  def build(user_prompt, transcript \\ nil, streamer_metadata \\ nil) do
    category = infer_category(user_prompt)
    keywords = extract_keywords(transcript)
    news_context = maybe_news_context(category, keywords)
    streamer_context = StreamerReach.format_for_prompt(streamer_metadata)

    """
    ---

    **DETECTION CONTEXT LAYER:**
    - Prompt category: #{category}
    - Transcript keywords: #{format_keywords(keywords)}
    - Use the user's prompt as a targeting lens, but still return general viral moments if they score higher than category-specific moments.

    #{streamer_context}

    #{news_context}
    """
    |> String.trim()
  end

  defp infer_category(prompt) when is_binary(prompt) do
    prompt = String.downcase(prompt)

    cond do
      prompt =~ "gambl" or prompt =~ "casino" or prompt =~ "slot" or prompt =~ "bet" ->
        "gambling"

      prompt =~ "gaming" or prompt =~ "gameplay" or prompt =~ "clutch" or prompt =~ "ranked" ->
        "gaming"

      prompt =~ "breaking news" or prompt =~ "current event" or prompt =~ "trending" ->
        "breaking_news"

      prompt =~ "irl" or prompt =~ "just chatting" or prompt =~ "street" ->
        "irl"

      prompt =~ "music" or prompt =~ "song" or prompt =~ "performance" or prompt =~ "concert" ->
        "music"

      true ->
        "general"
    end
  end

  defp infer_category(_), do: "general"

  defp maybe_news_context("breaking_news", keywords) do
    """
    **CURRENT NEWS CONTEXT:**
    Attach high weight to direct reactions to these current events. The topic/person/event must be named in the clip or strongly implied by the transcript.

    #{News.get_ai_context(10, keywords: keywords, categories: nil)}

    **News boost ceiling:** direct named reaction +15, clear discussion +10, weak/tangential reference +0.
    """
    |> String.trim()
  end

  defp maybe_news_context(category, keywords) when category in ["general", "irl"] do
    """
    **CURRENT NEWS CONTEXT:**
    Use only when transcript keywords overlap a current event. Do not boost generic commentary with no named event/person.

    #{News.get_ai_context(6, keywords: keywords, categories: nil)}

    **News boost ceiling:** direct named reaction +10, clear discussion +6, weak/tangential reference +0.
    """
    |> String.trim()
  end

  defp maybe_news_context(_category, keywords) do
    """
    **CURRENT NEWS CONTEXT:**
    For this category, only use news when the streamer directly names the topic/person/event.

    #{News.get_ai_context(4, keywords: keywords, categories: nil)}

    **News boost ceiling:** direct named overlap +6, otherwise +0.
    """
    |> String.trim()
  end

  defp extract_keywords(nil), do: []

  defp extract_keywords(transcript) when is_map(transcript) do
    text =
      [
        Map.get(transcript, "text"),
        transcript
        |> Map.get("segments", [])
        |> Enum.take(80)
        |> Enum.map_join(" ", &Map.get(&1, "text", ""))
      ]
      |> Enum.filter(&is_binary/1)
      |> Enum.join(" ")

    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, " ")
    |> String.split(~r/\s+/, trim: true)
    |> Enum.reject(&(String.length(&1) < 4))
    |> Enum.reject(&(&1 in stop_words()))
    |> Enum.frequencies()
    |> Enum.sort_by(fn {_word, count} -> -count end)
    |> Enum.take(16)
    |> Enum.map(fn {word, _count} -> word end)
  end

  defp extract_keywords(_), do: []

  defp format_keywords([]), do: "none extracted"
  defp format_keywords(keywords), do: Enum.join(keywords, ", ")

  defp stop_words do
    ~w(about after also because been from have just like more that this they what when with your youre there their them then really going gonna wanna were)
  end
end
