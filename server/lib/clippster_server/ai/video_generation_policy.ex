defmodule ClippsterServer.AI.VideoGenerationPolicy do
  @moduledoc """
  Central model, credit and limit policy for the AI video editor.

  Opus does every creative decision (planning, composition, revisions). Gemini only labels what
  shots show. Measurement and compilation happen in code on the client.

  Override models with OPENROUTER_VIDEO_AGENT_MODEL / OPENROUTER_VIDEO_LABEL_MODEL.
  """

  @default_agent_model "anthropic/claude-opus-5.5"
  @default_label_model "google/gemini-3.7-flash"

  @credit_costs %{"generate" => 10, "revise" => 5, "reference" => 2}

  @max_turns %{"generate" => 40, "revise" => 20}
  @max_label_calls 80
  @max_reference_chunks 40
  @max_output_seconds 60
  @agent_max_tokens 16_000
  @agent_reasoning_effort "medium"

  @spec credit_cost(String.t()) :: pos_integer()
  def credit_cost(kind) when is_map_key(@credit_costs, kind), do: Map.fetch!(@credit_costs, kind)

  @spec max_turns(String.t()) :: pos_integer()
  def max_turns(kind) when is_map_key(@max_turns, kind), do: Map.fetch!(@max_turns, kind)

  def max_label_calls, do: @max_label_calls
  def max_reference_chunks, do: @max_reference_chunks
  def max_output_seconds, do: @max_output_seconds
  def agent_max_tokens, do: @agent_max_tokens
  def agent_reasoning_effort, do: @agent_reasoning_effort

  @spec agent_model() :: String.t()
  def agent_model, do: env_model("OPENROUTER_VIDEO_AGENT_MODEL", @default_agent_model)

  @spec label_model() :: String.t()
  def label_model, do: env_model("OPENROUTER_VIDEO_LABEL_MODEL", @default_label_model)

  defp env_model(name, default) do
    case System.get_env(name) do
      value when is_binary(value) and value != "" -> value
      _ -> default
    end
  end
end
