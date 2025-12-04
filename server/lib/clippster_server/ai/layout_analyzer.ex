defmodule ClippsterServer.AI.LayoutAnalyzer do
  @moduledoc """
  Analyzes speaker detection results to classify video content type
  and determine optimal layout for portrait video exports.

  Classifies videos into categories:
  - :talking_head - Single centered speaker, minimal movement
  - :gaming - Speaker in corner with large content area (screen share/gameplay)
  - :irl - Mobile/active speaker with high movement variance
  - :multi_speaker - Multiple speakers in different regions
  - :podcast - Multiple speakers in similar region (side by side)
  """

  @doc """
  Analyzes speaker detection results and classifies the video content type.

  ## Parameters
    - detection_result: Output from SpeakerDetection.analyze_video_segment/4

  ## Returns
    - %{
        video_type: atom,
        speaker_layout: :single | :dual | :multi,
        content_regions: [region],
        recommended_framing: :pan | :split_screen | :static,
        confidence: float,
        analysis_details: map
      }
  """
  def analyze(detection_result) do
    speakers = detection_result.speakers
    frames = detection_result.frames
    dimensions = detection_result.video_dimensions

    IO.puts("[LayoutAnalyzer] Analyzing #{length(speakers)} speakers across #{length(frames)} frames")

    # Analyze speaker characteristics
    speaker_analysis = analyze_speaker_characteristics(speakers)
    
    # Analyze spatial distribution
    spatial_analysis = analyze_spatial_distribution(speakers, dimensions)
    
    # Analyze temporal patterns (movement over time)
    temporal_analysis = analyze_temporal_patterns(frames)

    # Classify video type based on all analyses
    {video_type, confidence} = classify_video_type(speaker_analysis, spatial_analysis, temporal_analysis)

    # Determine content regions (areas without speakers)
    content_regions = identify_content_regions(speakers, dimensions)

    # Determine recommended framing strategy
    recommended_framing = determine_framing_strategy(video_type, speaker_analysis, content_regions)

    # Determine speaker layout
    speaker_layout = determine_speaker_layout(speakers)

    %{
      video_type: video_type,
      speaker_layout: speaker_layout,
      content_regions: content_regions,
      recommended_framing: recommended_framing,
      confidence: confidence,
      analysis_details: %{
        speaker_analysis: speaker_analysis,
        spatial_analysis: spatial_analysis,
        temporal_analysis: temporal_analysis,
        speakers_detected: length(speakers)
      }
    }
  end

  @doc """
  Analyzes characteristics of detected speakers.
  """
  def analyze_speaker_characteristics(speakers) when length(speakers) == 0 do
    %{
      count: 0,
      primary_speaker: nil,
      secondary_speakers: [],
      size_distribution: :none,
      position_spread: 0.0
    }
  end
  def analyze_speaker_characteristics(speakers) do
    # Sort by detection count (most detected = primary speaker)
    sorted_speakers = Enum.sort_by(speakers, & &1.detection_count, :desc)
    primary = hd(sorted_speakers)
    secondary = Enum.drop(sorted_speakers, 1)

    # Calculate average face size
    avg_sizes = Enum.map(speakers, fn s -> 
      s.average_bbox.width * s.average_bbox.height 
    end)
    avg_size = Enum.sum(avg_sizes) / length(avg_sizes)

    # Determine size distribution
    size_distribution = cond do
      length(speakers) == 1 -> :single
      max_size_ratio(speakers) > 2.0 -> :uneven  # One speaker much larger
      true -> :even
    end

    # Calculate position spread (how far apart speakers are)
    position_spread = if length(speakers) > 1 do
      centroids = Enum.map(speakers, & &1.centroid)
      max_distance(centroids)
    else
      0.0
    end

    %{
      count: length(speakers),
      primary_speaker: primary,
      secondary_speakers: secondary,
      average_face_size: avg_size,
      size_distribution: size_distribution,
      position_spread: position_spread
    }
  end

  @doc """
  Analyzes spatial distribution of speakers in the frame.
  """
  def analyze_spatial_distribution(speakers, _dimensions) when length(speakers) == 0 do
    %{
      occupied_quadrants: [],
      free_quadrants: [:top_left, :top_right, :bottom_left, :bottom_right],
      speaker_positions: [],
      center_of_mass: %{x: 0.5, y: 0.5},
      coverage_percentage: 0.0
    }
  end
  def analyze_spatial_distribution(speakers, _dimensions) do
    # Identify which quadrants contain speakers
    quadrant_occupancy = speakers
    |> Enum.map(fn s -> 
      {classify_quadrant(s.centroid), s.speaker_index}
    end)
    |> Enum.group_by(fn {quadrant, _} -> quadrant end)

    occupied_quadrants = Map.keys(quadrant_occupancy)
    all_quadrants = [:top_left, :top_right, :bottom_left, :bottom_right]
    free_quadrants = all_quadrants -- occupied_quadrants

    # Calculate center of mass of all speakers
    center_of_mass = calculate_center_of_mass(speakers)

    # Calculate coverage percentage (how much of frame is covered by faces)
    coverage = speakers
    |> Enum.map(fn s -> s.average_bbox.width * s.average_bbox.height end)
    |> Enum.sum()

    %{
      occupied_quadrants: occupied_quadrants,
      free_quadrants: free_quadrants,
      speaker_positions: Enum.map(speakers, fn s -> 
        %{index: s.speaker_index, position: s.position_category}
      end),
      center_of_mass: center_of_mass,
      coverage_percentage: min(coverage, 1.0)
    }
  end

  @doc """
  Analyzes temporal patterns - how speakers move over time.
  """
  def analyze_temporal_patterns(frames) when length(frames) == 0 do
    %{
      average_face_count: 0.0,
      face_count_variance: 0.0,
      frames_with_faces: 0,
      detection_consistency: 0.0
    }
  end
  def analyze_temporal_patterns(frames) do
    face_counts = Enum.map(frames, & &1.face_count)
    total_frames = length(frames)
    frames_with_faces = Enum.count(face_counts, & &1 > 0)
    
    avg_count = Enum.sum(face_counts) / total_frames
    
    variance = face_counts
    |> Enum.map(fn c -> :math.pow(c - avg_count, 2) end)
    |> Enum.sum()
    |> Kernel./(total_frames)

    detection_consistency = frames_with_faces / total_frames

    %{
      average_face_count: Float.round(avg_count, 2),
      face_count_variance: Float.round(variance, 2),
      frames_with_faces: frames_with_faces,
      detection_consistency: Float.round(detection_consistency, 2)
    }
  end

  @doc """
  Classifies video type based on all analysis results.

  Returns {video_type, confidence}
  """
  def classify_video_type(speaker_analysis, spatial_analysis, _temporal_analysis) do
    speaker_count = speaker_analysis.count
    position_spread = speaker_analysis.position_spread
    movement_variance = get_avg_movement_variance(speaker_analysis)
    free_quadrants = spatial_analysis.free_quadrants
    coverage = spatial_analysis.coverage_percentage

    # Classification logic based on the plan's decision table
    cond do
      # No faces detected
      speaker_count == 0 ->
        {:unknown, 0.3}

      # Gaming/Screen share: Single speaker in corner, large free area
      speaker_count == 1 and 
        is_corner_position?(speaker_analysis.primary_speaker) and 
        length(free_quadrants) >= 2 and 
        coverage < 0.15 ->
        {:gaming, 0.85}

      # IRL/Mobile: Single speaker with high movement
      speaker_count == 1 and movement_variance > 0.08 ->
        {:irl, 0.80}

      # Talking head: Single centered speaker, low movement
      speaker_count == 1 and 
        is_centered?(speaker_analysis.primary_speaker) and 
        movement_variance < 0.05 ->
        {:talking_head, 0.90}

      # Single speaker, not clearly categorized
      speaker_count == 1 ->
        if movement_variance > 0.04 do
          {:irl, 0.65}
        else
          {:talking_head, 0.70}
        end

      # Multi-speaker in same region (podcast style)
      speaker_count >= 2 and position_spread < 0.35 ->
        {:podcast, 0.80}

      # Multi-speaker in different regions
      speaker_count >= 2 and position_spread >= 0.35 ->
        {:multi_speaker, 0.85}

      # Default fallback
      true ->
        {:unknown, 0.4}
    end
  end

  @doc """
  Identifies content regions (areas without speakers) that may contain
  important visual content like gameplay, presentations, or screen shares.
  """
  def identify_content_regions(speakers, _dimensions) when length(speakers) == 0 do
    # No speakers - entire frame is content
    [%{
      type: :full_frame,
      bbox: %{x: 0.0, y: 0.0, width: 1.0, height: 1.0},
      priority: :primary
    }]
  end
  def identify_content_regions(speakers, _dimensions) do
    # Get all speaker bboxes
    speaker_areas = Enum.map(speakers, fn s ->
      # Expand bbox slightly for safety margin
      expand_bbox(s.average_bbox, 0.05)
    end)

    # Find largest free regions
    # Divide frame into grid and check which cells are free
    grid_size = 4
    cells = for row <- 0..(grid_size - 1), col <- 0..(grid_size - 1) do
      cell_bbox = %{
        x: col / grid_size,
        y: row / grid_size,
        width: 1.0 / grid_size,
        height: 1.0 / grid_size
      }
      
      is_free = not Enum.any?(speaker_areas, fn speaker_bbox ->
        bboxes_overlap?(cell_bbox, speaker_bbox)
      end)

      {row, col, is_free}
    end

    # Group adjacent free cells into regions
    free_cells = cells |> Enum.filter(fn {_, _, free} -> free end)
    
    # Find contiguous free regions (simplified - just identify quadrants)
    regions = [:top_left, :top_right, :bottom_left, :bottom_right]
    |> Enum.map(fn quadrant ->
      quadrant_cells = get_quadrant_cells(free_cells, quadrant, grid_size)
      if length(quadrant_cells) >= 2 do
        %{
          type: :content_area,
          quadrant: quadrant,
          bbox: quadrant_to_bbox(quadrant),
          cell_count: length(quadrant_cells),
          priority: if(length(quadrant_cells) >= 3, do: :primary, else: :secondary)
        }
      else
        nil
      end
    end)
    |> Enum.filter(& &1)
    |> Enum.sort_by(fn r -> -r.cell_count end)

    if length(regions) > 0 do
      regions
    else
      # No clear content regions found
      []
    end
  end

  @doc """
  Determines the recommended framing strategy based on video type and analysis.
  """
  def determine_framing_strategy(video_type, speaker_analysis, content_regions) do
    case video_type do
      :gaming ->
        # Split screen: speaker bottom, content top
        :split_screen

      :talking_head ->
        # Simple static crop centered on speaker
        :static

      :irl ->
        # Dynamic panning to follow speaker
        :dynamic_pan

      :multi_speaker ->
        if length(content_regions) > 0 do
          :split_screen
        else
          # Pan between speakers or static wide shot
          :dynamic_pan
        end

      :podcast ->
        # Static wide shot or split screen if speakers far apart
        if speaker_analysis.position_spread > 0.25 do
          :split_screen
        else
          :static
        end

      _ ->
        # Default to static centered crop
        :static
    end
  end

  # Helper functions

  defp determine_speaker_layout(speakers) do
    case length(speakers) do
      0 -> :none
      1 -> :single
      2 -> :dual
      _ -> :multi
    end
  end

  defp max_size_ratio(speakers) when length(speakers) < 2, do: 1.0
  defp max_size_ratio(speakers) do
    sizes = Enum.map(speakers, fn s -> 
      s.average_bbox.width * s.average_bbox.height 
    end)
    max_size = Enum.max(sizes)
    min_size = Enum.min(sizes)
    if min_size > 0, do: max_size / min_size, else: 1.0
  end

  defp max_distance(centroids) when length(centroids) < 2, do: 0.0
  defp max_distance(centroids) do
    pairs = for c1 <- centroids, c2 <- centroids, c1 != c2, do: {c1, c2}
    if length(pairs) > 0 do
      pairs
      |> Enum.map(fn {c1, c2} -> 
        :math.sqrt(:math.pow(c1.x - c2.x, 2) + :math.pow(c1.y - c2.y, 2))
      end)
      |> Enum.max()
    else
      0.0
    end
  end

  defp calculate_center_of_mass(speakers) when length(speakers) == 0 do
    %{x: 0.5, y: 0.5}
  end
  defp calculate_center_of_mass(speakers) do
    # Weight by detection count (more detections = more weight)
    total_weight = Enum.sum(Enum.map(speakers, & &1.detection_count))
    
    weighted_x = speakers
    |> Enum.map(fn s -> s.centroid.x * s.detection_count end)
    |> Enum.sum()
    |> Kernel./(total_weight)

    weighted_y = speakers
    |> Enum.map(fn s -> s.centroid.y * s.detection_count end)
    |> Enum.sum()
    |> Kernel./(total_weight)

    %{x: weighted_x, y: weighted_y}
  end

  defp classify_quadrant(%{x: x, y: y}) do
    cond do
      x < 0.5 and y < 0.5 -> :top_left
      x >= 0.5 and y < 0.5 -> :top_right
      x < 0.5 and y >= 0.5 -> :bottom_left
      true -> :bottom_right
    end
  end

  defp get_avg_movement_variance(%{count: 0}), do: 0.0
  defp get_avg_movement_variance(%{primary_speaker: primary, secondary_speakers: secondary}) do
    all_speakers = [primary | secondary]
    variances = Enum.map(all_speakers, & &1.movement_variance)
    Enum.sum(variances) / length(variances)
  end

  defp is_corner_position?(speaker) do
    {h, v} = speaker.position_category
    (h == :left or h == :right) and (v == :top or v == :bottom)
  end

  defp is_centered?(speaker) do
    {h, _v} = speaker.position_category
    h == :center
  end

  defp expand_bbox(bbox, margin) do
    %{
      x: max(0.0, bbox.x - margin),
      y: max(0.0, bbox.y - margin),
      width: min(1.0, bbox.width + (margin * 2)),
      height: min(1.0, bbox.height + (margin * 2))
    }
  end

  defp bboxes_overlap?(box1, box2) do
    not (
      box1.x + box1.width < box2.x or
      box2.x + box2.width < box1.x or
      box1.y + box1.height < box2.y or
      box2.y + box2.height < box1.y
    )
  end

  defp get_quadrant_cells(free_cells, quadrant, grid_size) do
    half = div(grid_size, 2)
    
    {row_range, col_range} = case quadrant do
      :top_left -> {0..(half - 1), 0..(half - 1)}
      :top_right -> {0..(half - 1), half..(grid_size - 1)}
      :bottom_left -> {half..(grid_size - 1), 0..(half - 1)}
      :bottom_right -> {half..(grid_size - 1), half..(grid_size - 1)}
    end

    Enum.filter(free_cells, fn {row, col, _} ->
      row in row_range and col in col_range
    end)
  end

  defp quadrant_to_bbox(quadrant) do
    case quadrant do
      :top_left -> %{x: 0.0, y: 0.0, width: 0.5, height: 0.5}
      :top_right -> %{x: 0.5, y: 0.0, width: 0.5, height: 0.5}
      :bottom_left -> %{x: 0.0, y: 0.5, width: 0.5, height: 0.5}
      :bottom_right -> %{x: 0.5, y: 0.5, width: 0.5, height: 0.5}
    end
  end
end

