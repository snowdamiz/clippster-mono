defmodule ClippsterServer.AI.PromptRulesParserTest do
  use ExUnit.Case, async: true
  alias ClippsterServer.AI.PromptRulesParser

  describe "parse_minimum_duration/1" do
    test "parses 'no clips under X seconds'" do
      assert PromptRulesParser.parse_minimum_duration("no clips under 10 seconds") == 10
      assert PromptRulesParser.parse_minimum_duration("No clips under 15 seconds please") == 15

      assert PromptRulesParser.parse_minimum_duration(
               "detect clips but no clips under 20 seconds"
             ) == 20
    end

    test "parses 'no clips below X seconds'" do
      assert PromptRulesParser.parse_minimum_duration("no clips below 10 seconds") == 10
    end

    test "parses 'no clips less than X seconds'" do
      assert PromptRulesParser.parse_minimum_duration("no clips less than 12 seconds") == 12
    end

    test "parses 'minimum X seconds' variations" do
      assert PromptRulesParser.parse_minimum_duration("minimum 10 seconds") == 10
      assert PromptRulesParser.parse_minimum_duration("min 15 seconds") == 15
      assert PromptRulesParser.parse_minimum_duration("minimum 8s") == 8
      assert PromptRulesParser.parse_minimum_duration("min 5s") == 5
    end

    test "parses 'at least X seconds'" do
      assert PromptRulesParser.parse_minimum_duration("at least 10 seconds") == 10
      assert PromptRulesParser.parse_minimum_duration("clips should be at least 12 seconds") == 12
    end

    test "parses 'X second minimum'" do
      assert PromptRulesParser.parse_minimum_duration("10 second minimum") == 10
      assert PromptRulesParser.parse_minimum_duration("15 seconds minimum") == 15
    end

    test "parses 'X+ seconds'" do
      assert PromptRulesParser.parse_minimum_duration("10+ seconds") == 10
      assert PromptRulesParser.parse_minimum_duration("15+ s") == 15
    end

    test "parses 'clips should be X+ seconds'" do
      assert PromptRulesParser.parse_minimum_duration("clips should be 10+ seconds") == 10
      assert PromptRulesParser.parse_minimum_duration("clips should be 8s") == 8
    end

    test "returns nil when no duration rule is found" do
      assert PromptRulesParser.parse_minimum_duration("detect viral moments") == nil
      assert PromptRulesParser.parse_minimum_duration("find the best clips") == nil
      assert PromptRulesParser.parse_minimum_duration("") == nil
    end

    test "handles case insensitivity" do
      assert PromptRulesParser.parse_minimum_duration("NO CLIPS UNDER 10 SECONDS") == 10
      assert PromptRulesParser.parse_minimum_duration("Minimum 15 Seconds") == 15
    end

    test "handles complex prompts with multiple rules" do
      prompt = "Detect the most viral moments. No clips under 10 seconds. Focus on high energy."
      assert PromptRulesParser.parse_minimum_duration(prompt) == 10
    end

    test "returns first match when multiple duration rules present" do
      # Should return the first match it finds
      prompt = "minimum 10 seconds and at least 15 seconds"
      result = PromptRulesParser.parse_minimum_duration(prompt)
      assert result in [10, 15]
    end

    test "handles nil input" do
      assert PromptRulesParser.parse_minimum_duration(nil) == nil
    end
  end

  describe "parse_maximum_duration/1" do
    test "parses max duration constraints" do
      assert PromptRulesParser.parse_maximum_duration("no clips over 45 seconds") == 45
      assert PromptRulesParser.parse_maximum_duration("maximum 60 seconds") == 60
      assert PromptRulesParser.parse_maximum_duration("max 90s") == 90
      assert PromptRulesParser.parse_maximum_duration("clips should be under 45 seconds") == 45
      assert PromptRulesParser.parse_maximum_duration("90 second maximum") == 90
    end

    test "returns nil when no max rule exists" do
      assert PromptRulesParser.parse_maximum_duration("find viral moments") == nil
      assert PromptRulesParser.parse_maximum_duration("no clips under 10 seconds") == nil
      assert PromptRulesParser.parse_maximum_duration(nil) == nil
    end
  end

  describe "parse_ideal_duration_range/1" do
    test "defaults to the product target range" do
      assert PromptRulesParser.parse_ideal_duration_range("find clips") == {30, 45}
      assert PromptRulesParser.parse_ideal_duration_range(nil) == {30, 45}
    end

    test "parses explicit ideal ranges" do
      assert PromptRulesParser.parse_ideal_duration_range("ideal 20-35 seconds") == {20, 35}
      assert PromptRulesParser.parse_ideal_duration_range("target 30 to 45s") == {30, 45}
      assert PromptRulesParser.parse_ideal_duration_range("15-60s preferred") == {15, 60}
    end
  end

  describe "parse_duration_rules/1" do
    test "combines min max and ideal range" do
      assert PromptRulesParser.parse_duration_rules(
               "minimum 15 seconds, no clips over 75 seconds, ideal 30-45 seconds"
             ) == %{minimum: 15, maximum: 75, ideal_min: 30, ideal_max: 45}
    end
  end
end
