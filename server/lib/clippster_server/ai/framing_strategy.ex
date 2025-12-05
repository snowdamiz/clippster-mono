defmodule ClippsterServer.AI.FramingStrategy do
  @moduledoc """
  Generates concrete framing instructions for video export based on
  layout analysis results.

  Produces detailed crop regions, pan keyframes, and split screen
  configurations for FFmpeg video processing.
  """

  alias ClippsterServer.AI.{SpeakerDetection, LayoutAnalyzer}

  @doc """
  Generates a complete framing strategy for a video clip.

  ## Parameters
    - video_path: Path to the video file
    - start_time: Clip start time in seconds
    - end_time: Clip end time in seconds
    - target_aspect_ratio: Target aspect ratio (e.g., "9:16")
    - opts: Optional configuration

  ## Returns
    - {:ok, %FramingStrategy{}}
    - {:error, reason}
  """
  def generate_strategy(video_path, start_time, end_time, target_aspect_ratio, opts \\ []) do
    IO.puts("[FramingStrategy] Generating strategy for #{video_path}")
    IO.puts("[FramingStrategy] Time range: #{start_time}s - #{end_time}s, Target: #{target_aspect_ratio}")

    with {:ok, detection_result} <- SpeakerDetection.analyze_video_segment(video_path, start_time, end_time, opts),
         layout_analysis <- LayoutAnalyzer.analyze(detection_result) do
      
      strategy = build_strategy(detection_result, layout_analysis, target_aspect_ratio, opts)
      {:ok, strategy}
    end
  end

  @doc """
  Builds a framing strategy from detection and layout analysis results.
  """
  def build_strategy(detection_result, layout_analysis, target_aspect_ratio, _opts \\ []) do
    video_dims = detection_result.video_dimensions
    speakers = detection_result.speakers
    frames = detection_result.frames

    # Parse target aspect ratio
    {target_w, target_h} = parse_aspect_ratio(target_aspect_ratio)
    is_portrait = target_h > target_w

    # Build strategy based on recommended framing
    case layout_analysis.recommended_framing do
      :split_screen ->
        build_split_screen_strategy(speakers, layout_analysis, video_dims, target_w, target_h)

      :dynamic_pan ->
        build_dynamic_pan_strategy(speakers, frames, video_dims, target_w, target_h)

      :static ->
        build_static_strategy(speakers, video_dims, target_w, target_h)

      _ ->
        # Default to static centered crop
        build_static_strategy(speakers, video_dims, target_w, target_h)
    end
    |> Map.merge(%{
      video_type: layout_analysis.video_type,
      speaker_count: length(speakers),
      confidence: layout_analysis.confidence,
      target_aspect_ratio: target_aspect_ratio,
      is_portrait: is_portrait,
      source_dimensions: video_dims,
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  @doc """
  Builds a split screen strategy with speaker region and content region.
  """
  def build_split_screen_strategy(speakers, layout_analysis, video_dims, target_w, target_h) do
    IO.puts("[FramingStrategy] Building split screen strategy")
    IO.puts("  Speakers: #{length(speakers)}")
    IO.puts("  Content regions: #{length(layout_analysis.content_regions)}")
    
    # Determine split ratio (default 50/50, can be adjusted)
    split_ratio = determine_split_ratio(speakers, layout_analysis)
    IO.puts("  Split ratio: #{Float.round(split_ratio, 3)} (top: #{Float.round(split_ratio * 100, 1)}%, bottom: #{Float.round((1.0 - split_ratio) * 100, 1)}%)")
    
    # Get primary speaker for bottom region
    primary_speaker = List.first(speakers)
    
    if primary_speaker do
      IO.puts("  Primary speaker centroid: (#{Float.round(primary_speaker.centroid.x, 3)}, #{Float.round(primary_speaker.centroid.y, 3)})")
    end
    
    # Get content region for top
    content_region = List.first(layout_analysis.content_regions) || 
      %{bbox: %{x: 0.0, y: 0.0, width: 1.0, height: 0.5}}
    
    IO.puts("  Content region bbox: (#{Float.round(content_region.bbox.x, 3)}, #{Float.round(content_region.bbox.y, 3)}, #{Float.round(content_region.bbox.width, 3)}, #{Float.round(content_region.bbox.height, 3)})")

    # Calculate crop regions for each split
    {bottom_crop, top_crop} = calculate_split_crops(
      primary_speaker,
      content_region,
      video_dims,
      target_w,
      target_h,
      split_ratio
    )
    
    IO.puts("  Top crop: (#{Float.round(top_crop.x, 3)}, #{Float.round(top_crop.y, 3)}, #{Float.round(top_crop.width, 3)}, #{Float.round(top_crop.height, 3)})")
    IO.puts("  Bottom crop: (#{Float.round(bottom_crop.x, 3)}, #{Float.round(bottom_crop.y, 3)}, #{Float.round(bottom_crop.width, 3)}, #{Float.round(bottom_crop.height, 3)})")

    %{
      mode: :split_screen,
      layout: %{
        type: :vertical_stack,
        top_region: top_crop,
        bottom_region: bottom_crop,
        split_ratio: split_ratio
      },
      regions: [
        %{name: :content, crop: top_crop, position: :top},
        %{name: :speaker, crop: bottom_crop, position: :bottom}
      ],
      ffmpeg_filter: build_split_screen_filter(top_crop, bottom_crop, target_w, target_h)
    }
  end

  @doc """
  Builds a dynamic pan strategy with keyframes for smooth panning.
  """
  def build_dynamic_pan_strategy(speakers, frames, video_dims, target_w, target_h) do
    # Generate keyframes from frame analysis
    keyframes = generate_pan_keyframes(speakers, frames, video_dims, target_w, target_h)

    # Calculate crop dimensions
    crop_dims = calculate_portrait_crop_dimensions(video_dims, target_w, target_h)

    %{
      mode: :dynamic_pan,
      keyframes: keyframes,
      crop_dimensions: crop_dims,
      interpolation: :linear,  # Can be :ease_in_out for smoother motion
      ffmpeg_filter: build_dynamic_pan_filter(keyframes, crop_dims, video_dims)
    }
  end

  @doc """
  Builds a static crop strategy centered on speakers.
  """
  def build_static_strategy(speakers, video_dims, target_w, target_h) do
    # Calculate crop center based on speaker positions
    crop_center = calculate_optimal_crop_center(speakers, video_dims)
    
    # Calculate crop dimensions for target aspect ratio
    crop_dims = calculate_portrait_crop_dimensions(video_dims, target_w, target_h)

    # Calculate final crop position (ensuring it stays within frame)
    crop_x = clamp(crop_center.x - (crop_dims.width / 2), 0.0, 1.0 - crop_dims.width)
    crop_y = clamp(crop_center.y - (crop_dims.height / 2), 0.0, 1.0 - crop_dims.height)

    crop_region = %{
      x: crop_x,
      y: crop_y,
      width: crop_dims.width,
      height: crop_dims.height
    }

    %{
      mode: :static,
      crop_region: crop_region,
      crop_center: crop_center,
      ffmpeg_filter: build_static_crop_filter(crop_region, video_dims, target_w, target_h)
    }
  end

  # Parse aspect ratio string to tuple
  defp parse_aspect_ratio(ratio_string) do
    case String.split(ratio_string, ":") do
      [w, h] ->
        {String.to_integer(w), String.to_integer(h)}
      _ ->
        {9, 16}  # Default to portrait
    end
  end

  # Determine optimal split ratio based on speaker size and content importance
  defp determine_split_ratio(speakers, layout_analysis) do
    speaker_coverage = case List.first(speakers) do
      nil -> 0.0
      speaker -> speaker.average_bbox.width * speaker.average_bbox.height
    end

    content_area = case List.first(layout_analysis.content_regions) do
      nil -> 0.0
      region -> region.bbox.width * region.bbox.height
    end

    # Adjust ratio based on relative sizes
    cond do
      content_area > speaker_coverage * 2 ->
        0.6  # 60% content, 40% speaker
      speaker_coverage > content_area * 2 ->
        0.4  # 40% content, 60% speaker
      true ->
        0.5  # Equal split
    end
  end

  # Calculate crop regions for split screen
  # The key insight: each split region has its OWN aspect ratio based on the split ratio.
  # For a 9:16 output with 50/50 split, each split is 1080x960 = 9:8 aspect ratio (1.125).
  # We store the CENTER POINT of each crop region, and the Rust code calculates
  # the actual crop dimensions based on the split's aspect ratio.
  defp calculate_split_crops(speaker, content_region, video_dims, target_w, target_h, split_ratio) do
    # Calculate the output dimensions for reference
    output_w = target_w * 120  # e.g., 1080
    output_h = target_h * 120  # e.g., 1920
    
    # Calculate the aspect ratio for each split region
    top_output_h = round(output_h * split_ratio)
    bottom_output_h = output_h - top_output_h
    
    # Each split has its own aspect ratio
    top_split_aspect = output_w / top_output_h
    bottom_split_aspect = output_w / bottom_output_h
    
    # Calculate crop dimensions for each split using its own aspect ratio
    source_aspect = video_dims.width / video_dims.height
    
    # Top region crop dimensions (based on top_split_aspect)
    {top_crop_w_norm, top_crop_h_norm} = if top_split_aspect > source_aspect do
      # Use full width, calculate height
      {1.0, source_aspect / top_split_aspect}
    else
      # Use full height, calculate width  
      {top_split_aspect / source_aspect, 1.0}
    end
    
    # Intelligently determine top region center based on content region
    # If content region is detected, use its center; otherwise use screen center
    {top_center_x, top_center_y} = if content_region && content_region.bbox do
      # Use content region center, but intelligently adjust based on region type
      content_center_x = content_region.bbox.x + content_region.bbox.width / 2
      content_center_y = content_region.bbox.y + content_region.bbox.height / 2
      
      # If content region is a specific quadrant, prefer center of screen for better framing
      # Otherwise use the detected center
      case content_region.quadrant do
        nil ->
          # No specific quadrant - use detected center
          {content_center_x, content_center_y}
        _quadrant ->
          # Quadrant detected - blend between quadrant center and screen center
          # This prevents off-center crops for quadrant-based detections
          quadrant_center_x = case content_region.quadrant do
            :top_left -> 0.25
            :top_right -> 0.75
            :bottom_left -> 0.25
            :bottom_right -> 0.75
            _ -> 0.5
          end
          quadrant_center_y = case content_region.quadrant do
            :top_left -> 0.25
            :top_right -> 0.25
            :bottom_left -> 0.75
            :bottom_right -> 0.75
            _ -> 0.5
          end
          
          # Blend: 70% screen center, 30% quadrant center (prefer centered framing)
          {0.7 * 0.5 + 0.3 * quadrant_center_x, 0.7 * 0.35 + 0.3 * quadrant_center_y}
      end
    else
      # No content region - center on screen (default for presentations, screen shares, etc.)
      {0.5, 0.4}  # Slightly above center for better framing
    end
    
    IO.puts("  Top crop center: (#{Float.round(top_center_x, 3)}, #{Float.round(top_center_y, 3)})")
    
    # Calculate top crop position (centered on content area)
    # Use full available area - no zoom constraint
    top_x = clamp(top_center_x - top_crop_w_norm / 2, 0.0, 1.0 - top_crop_w_norm)
    top_y = clamp(top_center_y - top_crop_h_norm / 2, 0.0, 1.0 - top_crop_h_norm)
    
    top_crop = %{
      x: top_x,
      y: top_y,
      width: top_crop_w_norm,  # Full width - no zoom constraint
      height: top_crop_h_norm,  # Full height - no zoom constraint
      output_height_ratio: split_ratio
    }

    # Determine if speaker is in corner (facecam) or center (main subject)
    is_corner_speaker = if speaker do
      {h_pos, v_pos} = speaker.position_category
      (h_pos == :left or h_pos == :right) and (v_pos == :top or v_pos == :bottom)
    else
      false
    end
    
    # Bottom region: Intelligently calculate zoom based on facecam size and target output
    # For facecam, use the face bbox center directly (more accurate than centroid)
    speaker_center = if speaker do
      # Use the center of the average bbox for more precise positioning
      # This is more accurate than centroid which averages across frames
      bbox = speaker.average_bbox
      face_center_x = bbox.x + (bbox.width / 2)
      face_center_y = bbox.y + (bbox.height / 2)
      
      # For corner facecams, the facecam window might be positioned in a specific corner
      # Adjust the center slightly to account for typical facecam window positioning
      {h_pos, v_pos} = speaker.position_category
      adjusted_center = if is_corner_speaker do
        # For corner facecams, bias towards the corner slightly
        # This helps center on the facecam window, not just the face
        bias_x = case h_pos do
          :left -> -0.02  # Slight bias left
          :right -> 0.02  # Slight bias right
          _ -> 0.0
        end
        bias_y = case v_pos do
          :top -> -0.02  # Slight bias up
          :bottom -> 0.02  # Slight bias down
          _ -> 0.0
        end
        %{
          x: face_center_x + bias_x,
          y: face_center_y + bias_y
        }
      else
        %{x: face_center_x, y: face_center_y}
      end
      
      adjusted_center
    else
      %{x: 0.5, y: 0.75}  # Default to lower center
    end
    
    IO.puts("  Speaker center (from bbox): (#{Float.round(speaker_center.x, 4)}, #{Float.round(speaker_center.y, 4)})")
    
    # Intelligently detect facecam window boundaries and calculate crop to include entire window
    # No hardcoded values - everything is calculated adaptively based on face position and size
    {calculated_crop_w, calculated_crop_h, window_center} = if speaker && is_corner_speaker do
      # Bottom section output dimensions (in pixels)
      bottom_output_w_px = output_w
      bottom_output_h_px = bottom_output_h
      
      # Face bbox in source video (normalized 0-1)
      face_bbox = speaker.average_bbox
      face_w_norm = face_bbox.width
      face_h_norm = face_bbox.height
      face_x_norm = face_bbox.x
      face_y_norm = face_bbox.y
      face_center_x = face_x_norm + face_w_norm / 2
      face_center_y = face_y_norm + face_h_norm / 2
      
      # Calculate crop size to make the facecam FILL the bottom section
      # Key insight: We want the face/facecam to be CENTERED and LARGE in the output
      # The crop MUST be centered on the face - if the face is near an edge,
      # we need to make the crop smaller so it can still be centered
      
      bottom_aspect = bottom_output_w_px / bottom_output_h_px
      
      # Calculate the MAXIMUM crop size that can be centered on the face
      # For a face at position cx, the max width centered on it is 2 * min(cx, 1-cx)
      max_centered_w = 2.0 * min(face_center_x, 1.0 - face_center_x)
      max_centered_h = 2.0 * min(face_center_y, 1.0 - face_center_y)
      
      # Calculate desired padding around face
      # Use face size as reference - typically want 2-3x face size for good framing
      padding_h = face_w_norm * 1.2  # Horizontal padding on each side
      padding_v_top = face_h_norm * 0.6  # Less padding above face
      padding_v_bottom = face_h_norm * 2.0  # More padding below for body
      
      # Calculate ideal crop area centered on face with padding
      ideal_padded_w = face_w_norm + padding_h * 2
      ideal_padded_h = face_h_norm + padding_v_top + padding_v_bottom
      
      # Adjust to maintain bottom_split_aspect ratio
      {ideal_crop_w, ideal_crop_h} = if bottom_aspect > (ideal_padded_w / ideal_padded_h) do
        # Need wider crop to match aspect ratio
        {ideal_padded_h * bottom_aspect, ideal_padded_h}
      else
        # Need taller crop to match aspect ratio
        {ideal_padded_w, ideal_padded_w / bottom_aspect}
      end
      
      # CRITICAL: Constrain crop size to what can be CENTERED on the face
      # This ensures the face will be perfectly centered in the output
      # Use the SMALLER of: ideal size OR maximum centerable size
      constrained_w = min(ideal_crop_w, max_centered_w)
      constrained_h = min(ideal_crop_h, max_centered_h)
      
      # Re-adjust to maintain aspect ratio after constraining
      # Choose the dimension that results in the TIGHTER crop (more zoom)
      {final_crop_w, final_crop_h} = if bottom_aspect > (constrained_w / constrained_h) do
        # Width is the limiting factor
        {constrained_w, constrained_w / bottom_aspect}
      else
        # Height is the limiting factor
        {constrained_h * bottom_aspect, constrained_h}
      end
      
      # Ensure minimum crop size to avoid over-zooming on very small faces
      min_crop_w = 0.12
      min_crop_h = min_crop_w / bottom_aspect
      final_crop_w = max(final_crop_w, min_crop_w)
      final_crop_h = max(final_crop_h, min_crop_h)
      
      # The crop is EXACTLY centered on the face - no offset needed
      # Since we constrained the size, this position will always be valid
      crop_center_x = face_center_x
      crop_center_y = face_center_y
      
      IO.puts("  Facecam framing (face-centered, constrained for true centering):")
      IO.puts("    Face bbox: (#{Float.round(face_x_norm, 4)}, #{Float.round(face_y_norm, 4)}, #{Float.round(face_w_norm, 4)}, #{Float.round(face_h_norm, 4)})")
      IO.puts("    Face center: (#{Float.round(face_center_x, 4)}, #{Float.round(face_center_y, 4)})")
      IO.puts("    Max centerable: #{Float.round(max_centered_w, 4)} x #{Float.round(max_centered_h, 4)}")
      IO.puts("    Ideal padded: #{Float.round(ideal_crop_w, 4)} x #{Float.round(ideal_crop_h, 4)}")
      IO.puts("    Final crop: #{Float.round(final_crop_w, 4)} x #{Float.round(final_crop_h, 4)}")
      IO.puts("    Crop center: (#{Float.round(crop_center_x, 4)}, #{Float.round(crop_center_y, 4)})")
      
      {final_crop_w, final_crop_h, %{x: crop_center_x, y: crop_center_y}}
    else
      # Not a corner speaker (or no speaker) - use standard aspect-preserving crop
      # Use speaker center for positioning
      window_center = speaker_center
      
      speaker_bbox_area = if speaker do
        speaker.average_bbox.width * speaker.average_bbox.height
      else
        0.1
      end
      
      # For centered speakers, use moderate zoom based on size
      zoom_factor = cond do
        speaker_bbox_area < 0.10 -> 2.5
        speaker_bbox_area < 0.20 -> 2.0
        true -> 1.5
      end
      
      speaker_bbox_w = if speaker, do: speaker.average_bbox.width, else: 0.2
      speaker_bbox_h = if speaker, do: speaker.average_bbox.height, else: 0.25
      
      desired_w = speaker_bbox_w * zoom_factor
      desired_h = speaker_bbox_h * zoom_factor
      
      {crop_w, crop_h} = if bottom_split_aspect > (desired_w / desired_h) do
        {desired_h * bottom_split_aspect, desired_h}
      else
        {desired_w, desired_w / bottom_split_aspect}
      end
      
      # Clamp to reasonable bounds for non-facecam speakers
      crop_w = clamp(crop_w, 0.20, 0.7)
      crop_h = clamp(crop_h, 0.20, 0.7)
      
      {crop_w, crop_h, window_center}
    end
    
    bottom_crop_w_norm = calculated_crop_w
    bottom_crop_h_norm = calculated_crop_h
    
    IO.puts("  Final bottom crop size: #{Float.round(bottom_crop_w_norm, 4)} x #{Float.round(bottom_crop_h_norm, 4)}")

    # Calculate bottom crop position centered on the face/speaker
    # For corner facecams, the crop size is constrained to ensure true centering
    crop_center = window_center
    ideal_x = crop_center.x - bottom_crop_w_norm / 2
    ideal_y = crop_center.y - bottom_crop_h_norm / 2
    
    # Clamp to ensure crop stays within frame bounds
    # But try to maintain the center as much as possible
    bottom_x = clamp(ideal_x, 0.0, 1.0 - bottom_crop_w_norm)
    bottom_y = clamp(ideal_y, 0.0, 1.0 - bottom_crop_h_norm)
    
    # If clamping moved the crop, log it for debugging
    if abs(ideal_x - bottom_x) > 0.01 or abs(ideal_y - bottom_y) > 0.01 do
      IO.puts("  Crop position adjusted due to bounds:")
      IO.puts("    Ideal: (#{Float.round(ideal_x, 4)}, #{Float.round(ideal_y, 4)})")
      IO.puts("    Actual: (#{Float.round(bottom_x, 4)}, #{Float.round(bottom_y, 4)})")
    end
    
    IO.puts("  Final bottom crop position: (#{Float.round(bottom_x, 4)}, #{Float.round(bottom_y, 4)})")
    
    bottom_crop = %{
      x: bottom_x,
      y: bottom_y,
      width: bottom_crop_w_norm,
      height: bottom_crop_h_norm,
      output_height_ratio: 1.0 - split_ratio
    }

    {bottom_crop, top_crop}
  end

  # Generate pan keyframes from frame analysis
  defp generate_pan_keyframes(speakers, frames, video_dims, target_w, target_h) do
    crop_dims = calculate_portrait_crop_dimensions(video_dims, target_w, target_h)
    primary_speaker = List.first(speakers)

    frames
    |> Enum.filter(fn frame -> frame.face_count > 0 end)
    |> Enum.map(fn frame ->
      # Get the face closest to the primary speaker (if tracking is lost)
      best_face = if primary_speaker do
        frame.faces
        |> Enum.min_by(fn face ->
          dx = face.bbox.x + face.bbox.width / 2 - primary_speaker.centroid.x
          dy = face.bbox.y + face.bbox.height / 2 - primary_speaker.centroid.y
          dx * dx + dy * dy
        end, fn -> nil end)
      else
        List.first(frame.faces)
      end

      if best_face do
        # Calculate crop position to center on face
        face_center_x = best_face.bbox.x + best_face.bbox.width / 2
        face_center_y = best_face.bbox.y + best_face.bbox.height / 2
        
        crop_x = clamp(face_center_x - crop_dims.width / 2, 0.0, 1.0 - crop_dims.width)
        crop_y = clamp(face_center_y - crop_dims.height / 2, 0.0, 1.0 - crop_dims.height)

        %{
          timestamp: frame.timestamp,
          crop_x: crop_x,
          crop_y: crop_y,
          face_detected: true
        }
      else
        %{
          timestamp: frame.timestamp,
          crop_x: 0.5 - crop_dims.width / 2,  # Center
          crop_y: 0.5 - crop_dims.height / 2,
          face_detected: false
        }
      end
    end)
    |> smooth_keyframes()
  end

  # Smooth keyframes to avoid jittery motion
  defp smooth_keyframes(keyframes) when length(keyframes) < 3, do: keyframes
  defp smooth_keyframes(keyframes) do
    # Apply simple moving average for smoothing
    window_size = 3
    
    keyframes
    |> Enum.with_index()
    |> Enum.map(fn {kf, idx} ->
      start_idx = max(0, idx - div(window_size, 2))
      end_idx = min(length(keyframes) - 1, idx + div(window_size, 2))
      
      window = Enum.slice(keyframes, start_idx..end_idx)
      
      avg_x = Enum.sum(Enum.map(window, & &1.crop_x)) / length(window)
      avg_y = Enum.sum(Enum.map(window, & &1.crop_y)) / length(window)
      
      %{kf | crop_x: Float.round(avg_x, 4), crop_y: Float.round(avg_y, 4)}
    end)
  end

  # Calculate optimal crop center based on speakers
  defp calculate_optimal_crop_center(speakers, _video_dims) when length(speakers) == 0 do
    %{x: 0.5, y: 0.5}  # Default to center
  end
  defp calculate_optimal_crop_center(speakers, _video_dims) do
    # Weight by detection count
    total_weight = Enum.sum(Enum.map(speakers, & &1.detection_count))
    
    x = speakers
    |> Enum.map(fn s -> s.centroid.x * s.detection_count end)
    |> Enum.sum()
    |> Kernel./(total_weight)

    y = speakers
    |> Enum.map(fn s -> s.centroid.y * s.detection_count end)
    |> Enum.sum()
    |> Kernel./(total_weight)

    %{x: x, y: y}
  end

  # Calculate crop dimensions for portrait output from landscape source
  defp calculate_portrait_crop_dimensions(video_dims, target_w, target_h) do
    source_aspect = video_dims.width / video_dims.height
    target_aspect = target_w / target_h

    if target_aspect < source_aspect do
      # Target is more portrait than source - crop width
      crop_height = 1.0  # Use full height
      crop_width = crop_height * target_aspect / source_aspect
      %{width: crop_width, height: crop_height}
    else
      # Target is more landscape than source - crop height
      crop_width = 1.0  # Use full width
      crop_height = crop_width * source_aspect / target_aspect
      %{width: crop_width, height: crop_height}
    end
  end

  # Build FFmpeg filter string for split screen
  # Note: The Rust client handles the actual FFmpeg filter generation.
  # This filter string is provided for reference/debugging but may not be used directly.
  defp build_split_screen_filter(top_crop, bottom_crop, target_w, target_h) do
    # Calculate output dimensions
    output_w = target_w * 120  # Scale to reasonable size (e.g., 1080)
    output_h = target_h * 120  # e.g., 1920 for 9:16

    top_h = round(output_h * top_crop.output_height_ratio)
    bottom_h = output_h - top_h

    # The crop dimensions are normalized (0-1), multiply by source dimensions
    # Each crop has the correct aspect ratio to match its output region
    """
    [0:v]split=2[top_src][bottom_src];
    [top_src]crop=iw*#{Float.round(top_crop.width, 4)}:ih*#{Float.round(top_crop.height, 4)}:iw*#{Float.round(top_crop.x, 4)}:ih*#{Float.round(top_crop.y, 4)},scale=#{output_w}:#{top_h}:flags=lanczos[top];
    [bottom_src]crop=iw*#{Float.round(bottom_crop.width, 4)}:ih*#{Float.round(bottom_crop.height, 4)}:iw*#{Float.round(bottom_crop.x, 4)}:ih*#{Float.round(bottom_crop.y, 4)},scale=#{output_w}:#{bottom_h}:flags=lanczos[bottom];
    [top][bottom]vstack=inputs=2[out]
    """
  end

  # Build FFmpeg filter string for dynamic panning
  defp build_dynamic_pan_filter(keyframes, crop_dims, video_dims) do
    # Generate expression for X position interpolation
    x_expr = build_interpolation_expression(keyframes, :crop_x, video_dims.width, crop_dims.width)
    y_expr = build_interpolation_expression(keyframes, :crop_y, video_dims.height, crop_dims.height)
    
    crop_w = round(video_dims.width * crop_dims.width)
    crop_h = round(video_dims.height * crop_dims.height)

    "crop=#{crop_w}:#{crop_h}:#{x_expr}:#{y_expr}"
  end

  # Build FFmpeg interpolation expression from keyframes
  defp build_interpolation_expression([], _field, video_dim, crop_dim) do
    # Default to center (empty keyframes list)
    center = round(video_dim * (0.5 - crop_dim / 2))
    "#{center}"
  end
  defp build_interpolation_expression(keyframes, field, video_dim, _crop_dim) when length(keyframes) == 1 do
    kf = hd(keyframes)
    pos = round(video_dim * Map.get(kf, field))
    "#{pos}"
  end
  defp build_interpolation_expression(keyframes, field, video_dim, _crop_dim) do
    # Build piecewise linear interpolation using FFmpeg expressions
    # Uses 't' (time in seconds) for interpolation
    
    # Simplify: use linear interpolation between first and last
    first_kf = hd(keyframes)
    last_kf = List.last(keyframes)
    
    start_pos = round(video_dim * Map.get(first_kf, field))
    end_pos = round(video_dim * Map.get(last_kf, field))
    duration = last_kf.timestamp - first_kf.timestamp

    if abs(start_pos - end_pos) < 5 or duration < 0.5 do
      # Minimal movement - use static position
      avg_pos = round((start_pos + end_pos) / 2)
      "#{avg_pos}"
    else
      # Linear interpolation: start + (end - start) * (t - start_t) / duration
      start_t = first_kf.timestamp
      "#{start_pos}+(#{end_pos - start_pos})*(t-#{start_t})/#{duration}"
    end
  end

  # Build FFmpeg filter string for static crop
  defp build_static_crop_filter(crop_region, video_dims, target_w, target_h) do
    # Calculate pixel values
    crop_x = round(video_dims.width * crop_region.x)
    crop_y = round(video_dims.height * crop_region.y)
    crop_w = round(video_dims.width * crop_region.width)
    crop_h = round(video_dims.height * crop_region.height)

    # Target output dimensions
    output_w = target_w * 120  # e.g., 1080 for 9:16
    output_h = target_h * 120  # e.g., 1920 for 9:16

    "crop=#{crop_w}:#{crop_h}:#{crop_x}:#{crop_y},scale=#{output_w}:#{output_h}"
  end

  # Clamp value to range
  defp clamp(value, min_val, max_val) do
    value
    |> max(min_val)
    |> min(max_val)
  end

  @doc """
  Serializes a framing strategy to JSON for API responses.
  """
  def to_json(strategy) do
    strategy
    |> convert_atoms_to_strings()
    |> Jason.encode!()
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

