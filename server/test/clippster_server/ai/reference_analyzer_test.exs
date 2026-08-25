defmodule ClippsterServer.AI.ReferenceAnalyzerTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.ReferenceAnalyzer

  defp valid_payload do
    %{
      "metadata" => %{
        "duration" => 12,
        "width" => 1920,
        "height" => 1080,
        "fps" => 30,
        "fileSizeBytes" => 10_000
      },
      "frames" => [
        %{
          "timestamp" => 0,
          "kind" => "uniform",
          "mimeType" => "image/jpeg",
          "base64Data" => "eA=="
        },
        %{
          "timestamp" => 11.5,
          "kind" => "cut-after",
          "mimeType" => "image/jpeg",
          "base64Data" => "eA=="
        }
      ],
      "cutTimestamps" => [4.5],
      "audioPeaks" => [%{"time" => 4.4, "amplitude" => 0.8}]
    }
  end

  test "accepts bounded full-timeline temporal evidence" do
    assert {:ok, payload} = ReferenceAnalyzer.validate_payload(valid_payload())
    assert length(payload["frames"]) == 2
  end

  test "rejects timestamps outside the probed duration" do
    payload = put_in(valid_payload(), ["cutTimestamps"], [13])

    assert {:error, "Reference contains invalid cut timestamps"} =
             ReferenceAnalyzer.validate_payload(payload)
  end

  test "rejects oversized or non-JPEG frame evidence" do
    payload = put_in(valid_payload(), ["frames", Access.at(0), "mimeType"], "image/png")

    assert {:error, "Reference contains an invalid sampled frame"} =
             ReferenceAnalyzer.validate_payload(payload)
  end
end
