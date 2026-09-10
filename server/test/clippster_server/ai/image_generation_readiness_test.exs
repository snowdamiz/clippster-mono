defmodule ClippsterServer.AI.ImageGenerationReadinessTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.ImageGenerationReadiness

  test "accepts a latest assistant message that explicitly marks generation ready" do
    assert ImageGenerationReadiness.latest_assistant_ready?([
             %{role: "user", metadata: nil},
             %{role: "assistant", metadata: %{"ready_to_generate" => true}}
           ])
  end

  test "rejects a stale ready response when a newer user message exists" do
    refute ImageGenerationReadiness.latest_assistant_ready?([
             %{role: "assistant", metadata: %{"ready_to_generate" => true}},
             %{role: "user", metadata: nil}
           ])
  end

  test "rejects a latest assistant follow-up question" do
    refute ImageGenerationReadiness.latest_assistant_ready?([
             %{role: "assistant", metadata: %{"ready_to_generate" => false}}
           ])
  end

  test "accepts a latest assistant message that is ready to edit" do
    assert ImageGenerationReadiness.latest_assistant_ready_to_edit?([
             %{role: "user", metadata: nil},
             %{
               role: "assistant",
               metadata: %{
                 "ready_to_edit" => true,
                 "edit_prompt" => "Make it less neon"
               }
             }
           ])
  end

  test "rejects edit readiness without an edit prompt" do
    refute ImageGenerationReadiness.latest_assistant_ready_to_edit?([
             %{role: "assistant", metadata: %{"ready_to_edit" => true, "edit_prompt" => ""}}
           ])
  end
end
