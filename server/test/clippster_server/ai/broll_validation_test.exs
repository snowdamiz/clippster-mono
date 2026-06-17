defmodule ClippsterServer.AI.BrollValidationTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.BrollValidation

  describe "normalize_suggestions/2" do
    test "clamps times to clip duration and enforces minimum gap" do
      suggestions = [
        %{
          "id" => "a",
          "startTime" => 0,
          "endTime" => 4,
          "visualQuery" => "city skyline",
          "transcriptText" => "growth",
          "reason" => "abstract",
          "confidence" => 0.9
        },
        %{
          "id" => "b",
          "startTime" => 5,
          "endTime" => 9,
          "visualQuery" => "money stack",
          "transcriptText" => "revenue",
          "reason" => "literal",
          "confidence" => 0.8
        },
        %{
          "id" => "c",
          "startTime" => 10,
          "endTime" => 14,
          "visualQuery" => "laptop chart",
          "transcriptText" => "metrics",
          "reason" => "support",
          "confidence" => 0.7
        }
      ]

      result = BrollValidation.normalize_suggestions(suggestions, 30.0)

      assert length(result) >= 1
      assert hd(result)["endTime"] <= 30.0
    end

    test "drops suggestions without visual query" do
      suggestions = [
        %{"id" => "x", "startTime" => 2, "endTime" => 5, "visualQuery" => "", "confidence" => 0.5}
      ]

      assert BrollValidation.normalize_suggestions(suggestions, 20.0) == []
    end

    test "keeps valid suggestions after normalization" do
      suggestions = [
        %{
          "id" => "ok",
          "startTime" => 3,
          "endTime" => 7,
          "visualQuery" => "city traffic night",
          "transcriptText" => "sick in the head",
          "reason" => "visual interest",
          "confidence" => 0.8
        }
      ]

      result = BrollValidation.normalize_suggestions(suggestions, 24.0, density: "high")

      assert length(result) == 1
      assert hd(result)["startTime"] == 3.0
      assert hd(result)["endTime"] == 7.0
    end
  end
end
