defmodule ClippsterServerWeb.SpeakerDetectionController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{SpeakerDetection, LayoutAnalyzer, FramingStrategy}

  @doc """
  Analyzes a video clip for speakers and points of interest.

  POST /api/clips/:clip_id/analyze-speakers

  Request body:
    - video_path: Path to video file (required)
    - start_time: Start time in seconds (required)
    - end_time: End time in seconds (required)
    - target_aspect_ratio: Target aspect ratio, e.g. "9:16" (optional, default "9:16")
    - sample_interval: Seconds between frame samples (optional, default 2)

  Response:
    - strategy: Framing strategy object with mode, regions, and FFmpeg filter
    - speakers: List of detected speakers with positions
    - video_type: Classification (gaming, talking_head, irl, etc.)
    - confidence: Detection confidence score
  """
  def analyze(conn, %{"clip_id" => clip_id} = params) do
    IO.puts("[SpeakerDetectionController] Analyzing speakers for clip: #{clip_id}")

    # Extract and validate required parameters
    with {:ok, video_path} <- get_required_param(params, "video_path"),
         {:ok, start_time} <- get_required_float(params, "start_time"),
         {:ok, end_time} <- get_required_float(params, "end_time") do

      # Optional parameters
      target_aspect_ratio = Map.get(params, "target_aspect_ratio", "9:16")
      sample_interval = Map.get(params, "sample_interval", 2) |> to_integer()

      IO.puts("[SpeakerDetectionController] Video: #{video_path}")
      IO.puts("[SpeakerDetectionController] Time: #{start_time}s - #{end_time}s")
      IO.puts("[SpeakerDetectionController] Target: #{target_aspect_ratio}")

      opts = [
        sample_interval: sample_interval,
        max_speakers: 3
      ]

      # Generate framing strategy
      case FramingStrategy.generate_strategy(video_path, start_time, end_time, target_aspect_ratio, opts) do
        {:ok, strategy} ->
          IO.puts("[SpeakerDetectionController] Strategy generated successfully")
          IO.puts("[SpeakerDetectionController] Mode: #{strategy.mode}, Type: #{strategy.video_type}")

          response = %{
            success: true,
            clip_id: clip_id,
            strategy: serialize_strategy(strategy),
            video_type: Atom.to_string(strategy.video_type),
            mode: Atom.to_string(strategy.mode),
            confidence: strategy.confidence,
            speaker_count: strategy.speaker_count,
            target_aspect_ratio: target_aspect_ratio,
            analyzed_at: DateTime.utc_now() |> DateTime.to_iso8601()
          }

          json(conn, response)

        {:error, reason} ->
          IO.puts("[SpeakerDetectionController] Analysis failed: #{inspect(reason)}")
          
          conn
          |> put_status(500)
          |> json(%{
            success: false,
            error: "Speaker analysis failed",
            details: inspect(reason)
          })
      end
    else
      {:error, message} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Invalid request",
          details: message
        })
    end
  end

  @doc """
  Quick analysis endpoint that returns video type classification without full framing strategy.

  POST /api/clips/:clip_id/classify-video

  Faster endpoint for determining video type before full analysis.
  """
  def classify(conn, %{"clip_id" => clip_id} = params) do
    IO.puts("[SpeakerDetectionController] Classifying video for clip: #{clip_id}")

    with {:ok, video_path} <- get_required_param(params, "video_path"),
         {:ok, start_time} <- get_required_float(params, "start_time"),
         {:ok, end_time} <- get_required_float(params, "end_time") do

      # Use longer sample interval for quick classification
      sample_interval = Map.get(params, "sample_interval", 5) |> to_integer()

      opts = [
        sample_interval: sample_interval,
        max_speakers: 3
      ]

      case SpeakerDetection.analyze_video_segment(video_path, start_time, end_time, opts) do
        {:ok, detection_result} ->
          layout_analysis = LayoutAnalyzer.analyze(detection_result)

          response = %{
            success: true,
            clip_id: clip_id,
            video_type: Atom.to_string(layout_analysis.video_type),
            recommended_framing: Atom.to_string(layout_analysis.recommended_framing),
            speaker_layout: Atom.to_string(layout_analysis.speaker_layout),
            confidence: layout_analysis.confidence,
            speakers_detected: length(detection_result.speakers),
            content_regions: length(layout_analysis.content_regions)
          }

          json(conn, response)

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{
            success: false,
            error: "Video classification failed",
            details: inspect(reason)
          })
      end
    else
      {:error, message} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: message})
    end
  end

  # Helper functions

  defp get_required_param(params, key) do
    case Map.get(params, key) do
      nil -> {:error, "Missing required parameter: #{key}"}
      "" -> {:error, "Parameter cannot be empty: #{key}"}
      value -> {:ok, value}
    end
  end

  defp get_required_float(params, key) do
    case Map.get(params, key) do
      nil -> 
        {:error, "Missing required parameter: #{key}"}
      value when is_number(value) -> 
        {:ok, value / 1.0}  # Ensure float
      value when is_binary(value) ->
        case Float.parse(value) do
          {float_val, _} -> {:ok, float_val}
          :error -> {:error, "Invalid number for #{key}: #{value}"}
        end
      _ ->
        {:error, "Invalid value for #{key}"}
    end
  end

  defp to_integer(value) when is_integer(value), do: value
  defp to_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> 2  # Default
    end
  end
  defp to_integer(_), do: 2

  # Serialize strategy for JSON response
  defp serialize_strategy(strategy) do
    strategy
    |> Map.take([
      :mode, :video_type, :confidence, :speaker_count,
      :target_aspect_ratio, :is_portrait, :source_dimensions,
      :generated_at
    ])
    |> Map.merge(serialize_mode_specific_data(strategy))
    |> convert_atoms_to_strings()
  end

  defp serialize_mode_specific_data(%{mode: :split_screen} = strategy) do
    %{
      layout: convert_atoms_to_strings(strategy.layout),
      regions: Enum.map(strategy.regions, &convert_atoms_to_strings/1),
      ffmpeg_filter: strategy.ffmpeg_filter
    }
  end
  defp serialize_mode_specific_data(%{mode: :dynamic_pan} = strategy) do
    %{
      keyframes: strategy.keyframes,
      crop_dimensions: strategy.crop_dimensions,
      interpolation: Atom.to_string(strategy.interpolation),
      ffmpeg_filter: strategy.ffmpeg_filter
    }
  end
  defp serialize_mode_specific_data(%{mode: :static} = strategy) do
    %{
      crop_region: strategy.crop_region,
      crop_center: strategy.crop_center,
      ffmpeg_filter: strategy.ffmpeg_filter
    }
  end
  defp serialize_mode_specific_data(strategy) do
    # Fallback for unknown modes
    Map.take(strategy, [:ffmpeg_filter])
  end

  # Convert atom keys to strings for JSON serialization
  defp convert_atoms_to_strings(map) when is_map(map) do
    map
    |> Enum.map(fn {k, v} ->
      key = if is_atom(k), do: Atom.to_string(k), else: k
      value = convert_atoms_to_strings(v)
      {key, value}
    end)
    |> Map.new()
  end
  defp convert_atoms_to_strings(list) when is_list(list) do
    Enum.map(list, &convert_atoms_to_strings/1)
  end
  defp convert_atoms_to_strings(atom) when is_atom(atom), do: Atom.to_string(atom)
  defp convert_atoms_to_strings(other), do: other
end

