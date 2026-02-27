defmodule ClippsterServer.AI.SpeakerDetection do
  @moduledoc """
  Orchestrates speaker/point-of-interest detection for video clips.

  Uses cloud vision APIs to detect faces in video frames and analyze
  their positions to determine optimal framing strategies for portrait
  video exports.
  """

  alias ClippsterServer.AI.VisionAPI

  @doc """
  Analyzes a video segment for speakers and points of interest.

  ## Parameters
    - video_path: Path to the video file
    - start_time: Start time in seconds
    - end_time: End time in seconds
    - opts: Optional configuration
      - :sample_interval - seconds between frame samples (default: 2)
      - :max_speakers - maximum speakers to track (default: 3)
      - :ffmpeg_path - path to FFmpeg binary (default: "ffmpeg")

  ## Returns
    - {:ok, %{speakers: [...], frames: [...], video_dimensions: {...}}}
    - {:error, reason}
  """
  def analyze_video_segment(video_path, start_time, end_time, opts \\ []) do
    sample_interval = Keyword.get(opts, :sample_interval, 2)
    ffmpeg_path = Keyword.get(opts, :ffmpeg_path, "ffmpeg")

    IO.puts("[SpeakerDetection] Analyzing video: #{video_path}")
    IO.puts("[SpeakerDetection] Time range: #{start_time}s - #{end_time}s")
    IO.puts("[SpeakerDetection] Sample interval: #{sample_interval}s")

    with {:ok, video_info} <- get_video_info(video_path, ffmpeg_path),
         {:ok, frames} <-
           extract_frames(video_path, start_time, end_time, sample_interval, ffmpeg_path),
         {:ok, frame_analyses} <- analyze_frames(frames, video_info),
         {:ok, speaker_tracking} <- track_speakers_across_frames(frame_analyses, opts) do
      result = %{
        speakers: speaker_tracking.speakers,
        frames: frame_analyses,
        video_dimensions: %{
          width: video_info.width,
          height: video_info.height
        },
        analysis_metadata: %{
          total_frames_analyzed: length(frame_analyses),
          sample_interval: sample_interval,
          duration: end_time - start_time,
          analyzed_at: DateTime.utc_now() |> DateTime.to_iso8601()
        }
      }

      {:ok, result}
    end
  end

  @doc """
  Extracts frames from a video at specified intervals as base64-encoded images.

  ## Parameters
    - video_path: Path to video file
    - start_time: Start time in seconds
    - end_time: End time in seconds
    - interval: Seconds between frame extractions
    - ffmpeg_path: Path to FFmpeg binary

  ## Returns
    - {:ok, [{timestamp, base64_image}, ...]}
    - {:error, reason}
  """
  def extract_frames(video_path, start_time, end_time, interval, ffmpeg_path \\ "ffmpeg") do
    duration = end_time - start_time
    num_frames = max(1, trunc(duration / interval) + 1)

    IO.puts("[SpeakerDetection] Extracting #{num_frames} frames...")

    timestamps =
      for i <- 0..(num_frames - 1) do
        start_time + i * interval
      end
      |> Enum.filter(fn t -> t <= end_time end)

    # Extract frames in parallel for speed
    frames =
      timestamps
      |> Task.async_stream(
        fn timestamp -> extract_single_frame(video_path, timestamp, ffmpeg_path) end,
        max_concurrency: 4,
        timeout: 30_000
      )
      |> Enum.map(fn
        {:ok, result} -> result
        {:exit, _reason} -> {:error, :timeout}
      end)
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, frame} -> frame end)

    if length(frames) > 0 do
      IO.puts("[SpeakerDetection] Successfully extracted #{length(frames)} frames")
      {:ok, frames}
    else
      {:error, "Failed to extract any frames from video"}
    end
  end

  @doc """
  Extracts a single frame from video at specified timestamp.

  Returns {:ok, %{timestamp: float, image_base64: string}} or {:error, reason}
  """
  def extract_single_frame(video_path, timestamp, ffmpeg_path \\ "ffmpeg") do
    # Create temporary file for frame output
    temp_file =
      System.tmp_dir!()
      |> Path.join("frame_#{:erlang.unique_integer([:positive])}.jpg")

    args = [
      "-ss",
      Float.to_string(timestamp),
      "-i",
      video_path,
      "-vframes",
      "1",
      "-f",
      "image2",
      # High quality JPEG
      "-q:v",
      "2",
      "-y",
      temp_file
    ]

    try do
      case System.cmd(ffmpeg_path, args, stderr_to_stdout: true) do
        {_output, 0} ->
          case File.read(temp_file) do
            {:ok, image_data} ->
              base64_image = Base.encode64(image_data)
              File.rm(temp_file)
              {:ok, %{timestamp: timestamp, image_base64: base64_image}}

            {:error, reason} ->
              {:error, "Failed to read frame file: #{inspect(reason)}"}
          end

        {output, exit_code} ->
          {:error, "FFmpeg failed with code #{exit_code}: #{String.slice(output, 0, 200)}"}
      end
    after
      # Cleanup temp file if it exists
      File.rm(temp_file)
    end
  end

  @doc """
  Gets video information (dimensions, duration) using FFmpeg.
  """
  def get_video_info(video_path, ffmpeg_path \\ "ffmpeg") do
    ffprobe_path = String.replace(ffmpeg_path, "ffmpeg", "ffprobe")

    args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-select_streams",
      "v:0",
      video_path
    ]

    case System.cmd(ffprobe_path, args, stderr_to_stdout: true) do
      {output, 0} ->
        case Jason.decode(output) do
          {:ok, %{"streams" => [stream | _]}} ->
            {:ok,
             %{
               width: Map.get(stream, "width", 1920),
               height: Map.get(stream, "height", 1080),
               duration: parse_duration(Map.get(stream, "duration", "0")),
               fps: parse_fps(Map.get(stream, "r_frame_rate", "30/1"))
             }}

          _ ->
            # Fallback to default dimensions
            {:ok, %{width: 1920, height: 1080, duration: 0.0, fps: 30.0}}
        end

      {output, _exit_code} ->
        IO.puts("[SpeakerDetection] FFprobe warning: #{String.slice(output, 0, 100)}")
        # Return default dimensions as fallback
        {:ok, %{width: 1920, height: 1080, duration: 0.0, fps: 30.0}}
    end
  end

  # Parse duration string to float
  defp parse_duration(duration) when is_binary(duration) do
    case Float.parse(duration) do
      {value, _} -> value
      :error -> 0.0
    end
  end

  defp parse_duration(_), do: 0.0

  # Parse frame rate fraction to float
  defp parse_fps(fps_string) when is_binary(fps_string) do
    case String.split(fps_string, "/") do
      [num, den] ->
        {n, _} = Integer.parse(num)
        {d, _} = Integer.parse(den)
        if d > 0, do: n / d, else: 30.0

      _ ->
        case Float.parse(fps_string) do
          {value, _} -> value
          :error -> 30.0
        end
    end
  end

  defp parse_fps(_), do: 30.0

  @doc """
  Analyzes extracted frames using Vision API for face detection.

  Returns a list of frame analyses with detected faces.
  """
  def analyze_frames(frames, video_info) when is_list(frames) do
    IO.puts("[SpeakerDetection] Analyzing #{length(frames)} frames with Vision API...")

    # Batch frames for efficient API usage (up to 16 images per batch request)
    batch_size = 16
    batches = Enum.chunk_every(frames, batch_size)

    frame_analyses =
      batches
      |> Enum.with_index()
      |> Enum.flat_map(fn {batch, batch_idx} ->
        IO.puts("[SpeakerDetection] Processing batch #{batch_idx + 1}/#{length(batches)}...")

        images =
          Enum.map(batch, fn frame -> {frame.image_base64, %{timestamp: frame.timestamp}} end)

        case VisionAPI.detect_faces_batch(images) do
          {:ok, batch_results} ->
            # Combine frames with their detection results
            Enum.zip(batch, batch_results)
            |> Enum.map(fn {frame, faces} ->
              normalized_faces =
                VisionAPI.normalize_face_bboxes(faces, video_info.width, video_info.height)

              %{
                timestamp: frame.timestamp,
                faces: normalized_faces,
                face_count: length(faces)
              }
            end)

          {:error, reason} ->
            IO.puts("[SpeakerDetection] Batch #{batch_idx + 1} failed: #{inspect(reason)}")
            # Return empty results for failed batch
            Enum.map(batch, fn frame ->
              %{timestamp: frame.timestamp, faces: [], face_count: 0}
            end)
        end
      end)

    {:ok, frame_analyses}
  end

  @doc """
  Tracks speakers across multiple frames to identify consistent subjects.

  Uses spatial clustering to group face detections into speaker identities.
  """
  def track_speakers_across_frames(frame_analyses, opts \\ []) do
    max_speakers = Keyword.get(opts, :max_speakers, 3)

    IO.puts("[SpeakerDetection] Tracking speakers across #{length(frame_analyses)} frames...")

    # Collect all face detections with their timestamps
    all_detections =
      frame_analyses
      |> Enum.flat_map(fn frame ->
        Enum.map(frame.faces, fn face ->
          Map.put(face, :timestamp, frame.timestamp)
        end)
      end)

    if length(all_detections) == 0 do
      IO.puts("[SpeakerDetection] No faces detected in any frame")
      {:ok, %{speakers: [], total_detections: 0}}
    else
      # Cluster faces by position to identify unique speakers
      speakers = cluster_faces_into_speakers(all_detections, max_speakers)

      IO.puts("[SpeakerDetection] Identified #{length(speakers)} unique speakers")

      {:ok,
       %{
         speakers: speakers,
         total_detections: length(all_detections)
       }}
    end
  end

  @doc """
  Clusters face detections into speaker identities based on spatial proximity.

  Uses a simple centroid-based clustering approach that groups faces
  appearing in similar positions across frames.
  """
  def cluster_faces_into_speakers(detections, max_speakers) do
    # Sort detections by timestamp
    sorted = Enum.sort_by(detections, & &1.timestamp)

    # Initialize clusters with first frame's faces
    first_frame_faces =
      sorted
      |> Enum.filter(fn d -> d.timestamp == hd(sorted).timestamp end)
      |> Enum.take(max_speakers)

    initial_clusters =
      first_frame_faces
      |> Enum.with_index()
      |> Enum.map(fn {face, idx} ->
        %{
          speaker_index: idx,
          detections: [face],
          centroid: get_face_centroid(face)
        }
      end)

    # Assign remaining detections to clusters
    remaining = sorted |> Enum.drop(length(first_frame_faces))

    final_clusters =
      Enum.reduce(remaining, initial_clusters, fn detection, clusters ->
        assign_detection_to_cluster(detection, clusters, max_speakers)
      end)

    # Convert clusters to speaker summaries
    final_clusters
    |> Enum.map(&summarize_speaker_cluster/1)
    # Sort by most frequent
    |> Enum.sort_by(fn s -> -s.detection_count end)
  end

  # Get centroid of face bounding box
  defp get_face_centroid(face) do
    bbox = face.bbox

    %{
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    }
  end

  # Assign a detection to the nearest cluster or create new cluster
  defp assign_detection_to_cluster(detection, clusters, max_speakers) do
    det_centroid = get_face_centroid(detection)

    # Find nearest cluster
    {nearest_cluster, distance} =
      clusters
      |> Enum.map(fn cluster ->
        dist = euclidean_distance(det_centroid, cluster.centroid)
        {cluster, dist}
      end)
      |> Enum.min_by(fn {_, dist} -> dist end, fn -> {nil, :infinity} end)

    # Threshold for considering a face as same speaker (normalized coordinates)
    # 25% of frame size
    same_speaker_threshold = 0.25

    cond do
      nearest_cluster != nil and distance < same_speaker_threshold ->
        # Add to existing cluster and update centroid
        updated_detections = nearest_cluster.detections ++ [detection]
        new_centroid = calculate_cluster_centroid(updated_detections)

        updated_cluster = %{
          nearest_cluster
          | detections: updated_detections,
            centroid: new_centroid
        }

        Enum.map(clusters, fn c ->
          if c.speaker_index == nearest_cluster.speaker_index, do: updated_cluster, else: c
        end)

      length(clusters) < max_speakers ->
        # Create new cluster for this face
        new_cluster = %{
          speaker_index: length(clusters),
          detections: [detection],
          centroid: det_centroid
        }

        clusters ++ [new_cluster]

      true ->
        # Assign to nearest cluster even if distance is large
        if nearest_cluster != nil do
          updated_detections = nearest_cluster.detections ++ [detection]
          new_centroid = calculate_cluster_centroid(updated_detections)

          updated_cluster = %{
            nearest_cluster
            | detections: updated_detections,
              centroid: new_centroid
          }

          Enum.map(clusters, fn c ->
            if c.speaker_index == nearest_cluster.speaker_index, do: updated_cluster, else: c
          end)
        else
          clusters
        end
    end
  end

  # Calculate centroid of a cluster of face detections
  defp calculate_cluster_centroid(detections) do
    centroids = Enum.map(detections, &get_face_centroid/1)
    n = length(centroids)

    %{
      x: Enum.sum(Enum.map(centroids, & &1.x)) / n,
      y: Enum.sum(Enum.map(centroids, & &1.y)) / n
    }
  end

  # Euclidean distance between two points
  defp euclidean_distance(p1, p2) do
    dx = p1.x - p2.x
    dy = p1.y - p2.y
    :math.sqrt(dx * dx + dy * dy)
  end

  # Summarize a speaker cluster into a speaker profile
  defp summarize_speaker_cluster(cluster) do
    detections = cluster.detections
    n = length(detections)

    # Calculate average bounding box
    avg_bbox = %{
      x: Enum.sum(Enum.map(detections, & &1.bbox.x)) / n,
      y: Enum.sum(Enum.map(detections, & &1.bbox.y)) / n,
      width: Enum.sum(Enum.map(detections, & &1.bbox.width)) / n,
      height: Enum.sum(Enum.map(detections, & &1.bbox.height)) / n
    }

    # Calculate average confidence
    avg_confidence = Enum.sum(Enum.map(detections, & &1.confidence)) / n

    # Determine position category
    position_category = categorize_position(cluster.centroid)

    # Calculate movement variance (how much this speaker moves)
    movement_variance = calculate_movement_variance(detections)

    %{
      speaker_index: cluster.speaker_index,
      average_bbox: avg_bbox,
      centroid: cluster.centroid,
      confidence: Float.round(avg_confidence, 3),
      detection_count: n,
      position_category: position_category,
      movement_variance: Float.round(movement_variance, 4),
      first_seen: Enum.min_by(detections, & &1.timestamp).timestamp,
      last_seen: Enum.max_by(detections, & &1.timestamp).timestamp
    }
  end

  # Categorize face position in frame
  defp categorize_position(%{x: x, y: y}) do
    horizontal =
      cond do
        x < 0.33 -> :left
        x > 0.67 -> :right
        true -> :center
      end

    vertical =
      cond do
        y < 0.33 -> :top
        y > 0.67 -> :bottom
        true -> :middle
      end

    {horizontal, vertical}
  end

  # Calculate variance of face positions (indicates movement)
  defp calculate_movement_variance(detections) when length(detections) < 2, do: 0.0

  defp calculate_movement_variance(detections) do
    centroids = Enum.map(detections, &get_face_centroid/1)

    mean_x = Enum.sum(Enum.map(centroids, & &1.x)) / length(centroids)
    mean_y = Enum.sum(Enum.map(centroids, & &1.y)) / length(centroids)

    variance_x =
      Enum.sum(Enum.map(centroids, fn c -> :math.pow(c.x - mean_x, 2) end)) / length(centroids)

    variance_y =
      Enum.sum(Enum.map(centroids, fn c -> :math.pow(c.y - mean_y, 2) end)) / length(centroids)

    :math.sqrt(variance_x + variance_y)
  end
end
