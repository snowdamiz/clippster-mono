defmodule ClippsterServer.AI.ImageGenerationReadiness do
  @moduledoc """
  Server-authoritative readiness checks shared by image and thumbnail creation.
  """

  def latest_assistant_ready?(messages) when is_list(messages) do
    case List.last(messages) do
      %{role: "assistant", metadata: %{"ready_to_generate" => true}} -> true
      _ -> false
    end
  end

  def latest_assistant_ready?(_messages), do: false

  def latest_assistant_ready_to_edit?(messages) when is_list(messages) do
    case List.last(messages) do
      %{role: "assistant", metadata: %{"ready_to_edit" => true, "edit_prompt" => prompt}}
      when is_binary(prompt) and prompt != "" ->
        true

      _ ->
        false
    end
  end

  def latest_assistant_ready_to_edit?(_messages), do: false
end
