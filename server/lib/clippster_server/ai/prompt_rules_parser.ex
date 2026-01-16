defmodule ClippsterServer.AI.PromptRulesParser do
  @moduledoc """
  Parses user-defined rules from detection prompts.

  This module extracts constraints like minimum duration requirements
  from user prompts to ensure AI-detected clips comply with user preferences.
  """

  require Logger

  @doc """
  Parses minimum duration rules from user prompts.

  Looks for patterns like:
  - "no clips under 10 seconds"
  - "minimum 10 seconds" / "min 10s"
  - "at least 10 seconds"
  - "clips should be 10+ seconds"
  - "10 second minimum"

  Returns the minimum duration in seconds, or nil if not specified.

  ## Examples

      iex> parse_minimum_duration("no clips under 10 seconds")
      10

      iex> parse_minimum_duration("minimum 15 seconds")
      15

      iex> parse_minimum_duration("detect viral moments")
      nil
  """
  @spec parse_minimum_duration(String.t()) :: integer() | nil
  def parse_minimum_duration(prompt) when is_binary(prompt) do
    prompt_lower = String.downcase(prompt)

    # Try each pattern in order of specificity
    patterns = [
      # "no clips under X seconds/s"
      ~r/no clips? (?:under|below|less than|shorter than)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      # "minimum X seconds" / "min X s"
      ~r/(?:min(?:imum)?|at least)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      # "clips should be X+ seconds"
      ~r/clips? should be\s*(\d+)\+?\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      # "X second(s) minimum"
      ~r/(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?\s*minimum/i,
      # "X+ seconds"
      ~r/(\d+)\+\s*(?:s(?:ec(?:ond)?s?)?)?/i
    ]

    result = Enum.find_value(patterns, fn pattern ->
      case Regex.run(pattern, prompt_lower) do
        [_full_match, duration_str] ->
          case Integer.parse(duration_str) do
            {duration, _} when duration > 0 -> duration
            _ -> nil
          end
        _ -> nil
      end
    end)

    if result do
      Logger.info("[PromptRulesParser] Detected minimum duration rule: #{result} seconds from prompt")
    end

    result
  end

  def parse_minimum_duration(_), do: nil
end
