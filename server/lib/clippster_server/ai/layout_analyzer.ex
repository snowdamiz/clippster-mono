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

    # Log classification details for debugging
    if speaker_count > 0 do
      primary = speaker_analysis.primary_speaker
      {h_pos, v_pos} = primary.position_category
      is_corner = is_corner_position?(primary)
      is_centered = is_centered?(primary)
      
      IO.puts("[LayoutAnalyzer] Classification details:")
      IO.puts("  Speaker count: #{speaker_count}")
      IO.puts("  Position: #{inspect(h_pos)}, #{inspect(v_pos)}")
      IO.puts("  Is corner: #{is_corner}, Is centered: #{is_centered}")
      IO.puts("  Coverage: #{Float.round(coverage, 4)}")
      IO.puts("  Free quadrants: #{length(free_quadrants)} (#{inspect(free_quadrants)})")
      IO.puts("  Movement variance: #{Float.round(movement_variance, 4)}")
      IO.puts("  Speaker centroid: (#{Float.round(primary.centroid.x, 3)}, #{Float.round(primary.centroid.y, 3)})")
      IO.puts("  Speaker bbox: (#{Float.round(primary.average_bbox.x, 3)}, #{Float.round(primary.average_bbox.y, 3)}, #{Float.round(primary.average_bbox.width, 3)}, #{Float.round(primary.average_bbox.height, 3)})")
    end

    # Classification logic based on the plan's decision table
    result = cond do
      # No faces detected
      speaker_count == 0 ->
        {:unknown, 0.3}

      # Gaming/Screen share: Single speaker in corner, large free area
      # More lenient: if speaker is in bottom corner (common for facecams), classify as gaming
      speaker_count == 1 and 
        is_corner_position?(speaker_analysis.primary_speaker) and 
        length(free_quadrants) >= 2 and 
        coverage < 0.20 ->  # Increased threshold from 0.15 to 0.20
        IO.puts("[LayoutAnalyzer] Classified as GAMING (corner position, free quadrants, low coverage)")
        {:gaming, 0.85}

      # Gaming/Screen share: Single speaker in bottom corner (common facecam position)
      # Even if coverage is slightly higher, if speaker is clearly in bottom corner, it's likely gaming
      speaker_count == 1 and 
        is_bottom_corner?(speaker_analysis.primary_speaker) and 
        coverage < 0.25 ->
        IO.puts("[LayoutAnalyzer] Classified as GAMING (bottom corner position)")
        {:gaming, 0.75}

      # IRL/Mobile: Single speaker with high movement
      speaker_count == 1 and movement_variance > 0.08 ->
        IO.puts("[LayoutAnalyzer] Classified as IRL (high movement)")
        {:irl, 0.80}

      # Talking head: Single centered speaker, low movement
      speaker_count == 1 and 
        is_centered?(speaker_analysis.primary_speaker) and 
        movement_variance < 0.05 ->
        IO.puts("[LayoutAnalyzer] Classified as TALKING_HEAD (centered, low movement)")
        {:talking_head, 0.90}

      # Single speaker, not clearly categorized
      speaker_count == 1 ->
        if movement_variance > 0.04 do
          IO.puts("[LayoutAnalyzer] Classified as IRL (moderate movement)")
          {:irl, 0.65}
        else
          IO.puts("[LayoutAnalyzer] Classified as TALKING_HEAD (default fallback)")
          {:talking_head, 0.70}
        end

      # Multi-speaker in same region (podcast style)
      speaker_count >= 2 and position_spread < 0.35 ->
        IO.puts("[LayoutAnalyzer] Classified as PODCAST")
        {:podcast, 0.80}

      # Multi-speaker in different regions
      speaker_count >= 2 and position_spread >= 0.35 ->
        IO.puts("[LayoutAnalyzer] Classified as MULTI_SPEAKER")
        {:multi_speaker, 0.85}

      # Default fallback
      true ->
        IO.puts("[LayoutAnalyzer] Classified as UNKNOWN (fallback)")
        {:unknown, 0.4}
    end

    {video_type, confidence} = result
    IO.puts("[LayoutAnalyzer] Final classification: #{video_type} (confidence: #{Float.round(confidence, 2)})")
    result
  end

  @doc """
  Identifies content regions (areas without speakers) that may contain
  important visual content like gameplay, presentations, or screen shares.
  """
  def identify_content_regions(speakers, _dimensions) when length(speakers) == 0 do
    # No speakers - entire frame is content
    IO.puts("[LayoutAnalyzer] No speakers detected - entire frame is content")
    [%{
      type: :full_frame,
      bbox: %{x: 0.0, y: 0.0, width: 1.0, height: 1.0},
      priority: :primary
    }]
  end
  def identify_content_regions(speakers, _dimensions) do
    IO.puts("[LayoutAnalyzer] Identifying content regions for #{length(speakers)} speaker(s)")
    
    # Get all speaker bboxes
    speaker_areas = Enum.map(speakers, fn s ->
      # Expand bbox slightly for safety margin
      expanded = expand_bbox(s.average_bbox, 0.05)
      IO.puts("  Speaker bbox: (#{Float.round(s.average_bbox.x, 3)}, #{Float.round(s.average_bbox.y, 3)}, #{Float.round(s.average_bbox.width, 3)}, #{Float.round(s.average_bbox.height, 3)})")
      expanded
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
    IO.puts("  Free cells: #{length(free_cells)}/#{grid_size * grid_size}")
    
    # Find contiguous free regions - use improved algorithm
    # First, try to find large contiguous areas (not just quadrants)
    regions = find_contiguous_regions(free_cells, grid_size, speaker_areas)
    
    if length(regions) > 0 do
      regions
    else
      # Fallback: use quadrant-based detection
      quadrant_regions = [:top_left, :top_right, :bottom_left, :bottom_right]
      |> Enum.map(fn quadrant ->
        quadrant_cells = get_quadrant_cells(free_cells, quadrant, grid_size)
        cell_count = length(quadrant_cells)
        if cell_count >= 2 do
          region = %{
            type: :content_area,
            quadrant: quadrant,
            bbox: quadrant_to_bbox(quadrant),
            cell_count: cell_count,
            priority: if(cell_count >= 3, do: :primary, else: :secondary)
          }
          IO.puts("  Content region: #{quadrant} (#{cell_count} cells, #{region.priority})")
          region
        else
          nil
        end
      end)
      |> Enum.filter(& &1)
      |> Enum.sort_by(fn r -> -r.cell_count end)
      
      if length(quadrant_regions) > 0 do
        quadrant_regions
      else
        # Last resort: create content region based on speaker position
        create_fallback_content_region(speakers)
      end
    end
  end

  @doc """
  Determines the recommended framing strategy based on video type and analysis.
  """
  def determine_framing_strategy(video_type, speaker_analysis, content_regions) do
    content_region_count = length(content_regions)
    
    IO.puts("[LayoutAnalyzer] Determining framing strategy:")
    IO.puts("  Video type: #{video_type}")
    IO.puts("  Content regions: #{content_region_count}")
    
    result = case video_type do
      :gaming ->
        # Split screen: speaker bottom, content top
        IO.puts("[LayoutAnalyzer] Using split_screen (gaming)")
        :split_screen

      :talking_head ->
        # If content regions are detected, use split screen even for talking_head
        # This handles cases where facecam is in corner but wasn't classified as gaming
        if content_region_count > 0 do
          IO.puts("[LayoutAnalyzer] Using split_screen (talking_head with content regions)")
          :split_screen
        else
          # Simple static crop centered on speaker
          IO.puts("[LayoutAnalyzer] Using static (talking_head)")
          :static
        end

      :irl ->
        # Dynamic panning to follow speaker
        IO.puts("[LayoutAnalyzer] Using dynamic_pan (irl)")
        :dynamic_pan

      :multi_speaker ->
        if content_region_count > 0 do
          IO.puts("[LayoutAnalyzer] Using split_screen (multi_speaker with content regions)")
          :split_screen
        else
          # Pan between speakers or static wide shot
          IO.puts("[LayoutAnalyzer] Using dynamic_pan (multi_speaker)")
          :dynamic_pan
        end

      :podcast ->
        # Static wide shot or split screen if speakers far apart
        if speaker_analysis.position_spread > 0.25 do
          IO.puts("[LayoutAnalyzer] Using split_screen (podcast, speakers far apart)")
          :split_screen
        else
          IO.puts("[LayoutAnalyzer] Using static (podcast)")
          :static
        end

      _ ->
        # Default to static centered crop, but prefer split_screen if content regions exist
        if content_region_count > 0 do
          IO.puts("[LayoutAnalyzer] Using split_screen (unknown type with content regions)")
          :split_screen
        else
          IO.puts("[LayoutAnalyzer] Using static (default fallback)")
          :static
        end
    end
    
    IO.puts("[LayoutAnalyzer] Recommended framing: #{result}")
    result
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

  defp is_bottom_corner?(speaker) do
    {h, v} = speaker.position_category
    (h == :left or h == :right) and v == :bottom
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

  # Find contiguous free regions using improved algorithm
  # Groups adjacent free cells into larger regions
  defp find_contiguous_regions(free_cells, grid_size, _speaker_areas) do
    # Group cells by adjacency
    groups = group_adjacent_cells(free_cells, grid_size)
    
    # Convert groups to regions
    regions = groups
    |> Enum.filter(fn group -> length(group) >= 2 end)  # At least 2 cells
    |> Enum.map(fn group ->
      # Calculate bounding box for this group
      min_row = Enum.min(Enum.map(group, fn {r, _, _} -> r end))
      max_row = Enum.max(Enum.map(group, fn {r, _, _} -> r end))
      min_col = Enum.min(Enum.map(group, fn {_, c, _} -> c end))
      max_col = Enum.max(Enum.map(group, fn {_, c, _} -> c end))
      
      bbox = %{
        x: min_col / grid_size,
        y: min_row / grid_size,
        width: (max_col - min_col + 1) / grid_size,
        height: (max_row - min_row + 1) / grid_size
      }
      
      # Determine quadrant (if applicable)
      quadrant = if bbox.width >= 0.4 and bbox.height >= 0.4 do
        cond do
          bbox.x < 0.5 and bbox.y < 0.5 -> :top_left
          bbox.x >= 0.5 and bbox.y < 0.5 -> :top_right
          bbox.x < 0.5 and bbox.y >= 0.5 -> :bottom_left
          true -> :bottom_right
        end
      else
        nil
      end
      
      %{
        type: :content_area,
        quadrant: quadrant,
        bbox: bbox,
        cell_count: length(group),
        priority: if(length(group) >= 4, do: :primary, else: :secondary)
      }
    end)
    |> Enum.sort_by(fn r -> -r.cell_count end)
    
    if length(regions) > 0 do
      IO.puts("[LayoutAnalyzer] Found #{length(regions)} contiguous content region(s)")
      regions
    else
      []
    end
  end

  # Group adjacent cells into contiguous regions
  defp group_adjacent_cells(cells, _grid_size) do
    # Simple grouping: cells are adjacent if they share a row or col and are next to each other
    groups = Enum.reduce(cells, [], fn cell, acc ->
      {row, col, _} = cell
      
      # Find existing groups that this cell is adjacent to
      {adjacent_groups, other_groups} = Enum.split_with(acc, fn group ->
        Enum.any?(group, fn {r, c, _} ->
          (r == row and abs(c - col) == 1) or (c == col and abs(r - row) == 1)
        end)
      end)
      
      # Merge adjacent groups and add this cell
      merged_group = Enum.reduce(adjacent_groups, [cell], fn group, merged ->
        merged ++ group
      end)
      
      other_groups ++ [merged_group]
    end)
    
    groups
  end

  # Create fallback content region based on speaker position
  defp create_fallback_content_region(speakers) when length(speakers) == 0 do
    IO.puts("[LayoutAnalyzer] No speakers - entire frame is content")
    [%{
      type: :full_frame,
      bbox: %{x: 0.0, y: 0.0, width: 1.0, height: 1.0},
      priority: :primary
    }]
  end
  defp create_fallback_content_region(speakers) do
    if length(speakers) == 1 do
      primary = hd(speakers)
      {h_pos, v_pos} = primary.position_category
      
      # If speaker is in corner, create content region for opposite area
      if (h_pos == :left or h_pos == :right) and (v_pos == :top or v_pos == :bottom) do
        # Speaker in corner - create content region for center/opposite area
        content_bbox = cond do
          h_pos == :left and v_pos == :bottom ->
            # Speaker bottom-left - content is top/center-right
            %{x: 0.3, y: 0.0, width: 0.7, height: 0.7}
          h_pos == :right and v_pos == :bottom ->
            # Speaker bottom-right - content is top/center-left
            %{x: 0.0, y: 0.0, width: 0.7, height: 0.7}
          h_pos == :left and v_pos == :top ->
            # Speaker top-left - content is bottom/center-right
            %{x: 0.3, y: 0.3, width: 0.7, height: 0.7}
          h_pos == :right and v_pos == :top ->
            # Speaker top-right - content is bottom/center-left
            %{x: 0.0, y: 0.3, width: 0.7, height: 0.7}
          true ->
            # Speaker centered - content is around edges
            %{x: 0.1, y: 0.1, width: 0.8, height: 0.8}
        end
        
        quadrant = cond do
          h_pos == :left -> :top_right
          h_pos == :right -> :top_left
          true -> nil
        end
        
        region = %{
          type: :content_area,
          quadrant: quadrant,
          bbox: content_bbox,
          cell_count: 8,
          priority: :primary
        }
        IO.puts("[LayoutAnalyzer] Created fallback content region (speaker in #{inspect(h_pos)}-#{inspect(v_pos)})")
        [region]
      else
        # Speaker not in corner - create center content region
        region = %{
          type: :content_area,
          quadrant: nil,
          bbox: %{x: 0.2, y: 0.2, width: 0.6, height: 0.6},
          cell_count: 6,
          priority: :primary
        }
        IO.puts("[LayoutAnalyzer] Created fallback content region (speaker centered)")
        [region]
      end
    else
      # Multiple speakers - create content region in largest free area
      IO.puts("[LayoutAnalyzer] Multiple speakers - no fallback content region")
      []
    end
  end

end

