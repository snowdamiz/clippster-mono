defmodule ClippsterServer.AI.PromptRulesParser do
  @moduledoc """
  Parses user-defined rules from detection prompts.

  This module extracts constraints like minimum and maximum duration requirements
  from user prompts to ensure AI-detected clips comply with user preferences.
  """

  require Logger

  @type duration_rules :: %{
          minimum: integer() | nil,
          maximum: integer() | nil,
          ideal_min: integer(),
          ideal_max: integer()
        }

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

    result =
      Enum.find_value(patterns, fn pattern ->
        case Regex.run(pattern, prompt_lower) do
          [_full_match, duration_str] ->
            case Integer.parse(duration_str) do
              {duration, _} when duration > 0 -> duration
              _ -> nil
            end

          _ ->
            nil
        end
      end)

    if result do
      Logger.info(
        "[PromptRulesParser] Detected minimum duration rule: #{result} seconds from prompt"
      )
    end

    result
  end

  def parse_minimum_duration(_), do: nil

  @doc """
  Parses maximum duration rules from user prompts.

  Looks for patterns like:
  - "no clips over 45 seconds"
  - "maximum 60 seconds" / "max 60s"
  - "clips should be under 45 seconds"
  - "45 second maximum"
  """
  @spec parse_maximum_duration(String.t()) :: integer() | nil
  def parse_maximum_duration(prompt) when is_binary(prompt) do
    prompt_lower = String.downcase(prompt)

    patterns = [
      ~r/no clips? (?:over|above|more than|longer than)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      ~r/(?:max(?:imum)?|at most)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      ~r/clips? should be (?:under|below|less than|no more than)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      ~r/(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?\s*max(?:imum)?/i
    ]

    result = parse_first_positive_integer(prompt_lower, patterns)

    if result do
      Logger.info(
        "[PromptRulesParser] Detected maximum duration rule: #{result} seconds from prompt"
      )
    end

    result
  end

  def parse_maximum_duration(_), do: nil

  @doc """
  Parses an ideal duration range from prompt copy.

  Defaults to the product policy: clips should bias 30-45 seconds unless
  a prompt explicitly asks for a different range.
  """
  @spec parse_ideal_duration_range(String.t()) :: {integer(), integer()}
  def parse_ideal_duration_range(prompt) when is_binary(prompt) do
    prompt_lower = String.downcase(prompt)

    patterns = [
      ~r/(?:ideal|prefer(?:red)?|target|aim for|around)\s*(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?/i,
      ~r/(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:s(?:ec(?:ond)?s?)?)?\s*(?:ideal|preferred|target|sweet spot)/i
    ]

    Enum.find_value(patterns, {30, 45}, fn pattern ->
      case Regex.run(pattern, prompt_lower) do
        [_full, first, second] ->
          with {min_duration, _} <- Integer.parse(first),
               {max_duration, _} <- Integer.parse(second),
               true <- min_duration > 0 and max_duration >= min_duration do
            {min_duration, max_duration}
          else
            _ -> nil
          end

        _ ->
          nil
      end
    end)
  end

  def parse_ideal_duration_range(_), do: {30, 45}

  @doc """
  Returns all duration rules used by the deterministic clip-shape pass.
  """
  @spec parse_duration_rules(String.t()) :: duration_rules()
  def parse_duration_rules(prompt) do
    {ideal_min, ideal_max} = parse_ideal_duration_range(prompt)

    %{
      minimum: parse_minimum_duration(prompt),
      maximum: parse_maximum_duration(prompt),
      ideal_min: ideal_min,
      ideal_max: ideal_max
    }
  end

  defp parse_first_positive_integer(prompt_lower, patterns) do
    Enum.find_value(patterns, fn pattern ->
      case Regex.run(pattern, prompt_lower) do
        [_full_match, duration_str] ->
          case Integer.parse(duration_str) do
            {duration, _} when duration > 0 -> duration
            _ -> nil
          end

        _ ->
          nil
      end
    end)
  end
end
