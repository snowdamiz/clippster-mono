defmodule ClippsterServerWeb.ClipsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.WhisperAPI
  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServer.AI.SystemPrompt
  alias ClippsterServer.ClipValidation
  alias ClippsterServerWeb.ProgressChannel

  def detect(conn, %{"project_id" => project_id, "prompt" => user_prompt} = params) do
    IO.puts("[ClipsController] Starting clip detection for project #{project_id}")
    IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

    # Check if we're using a cached transcript or fresh audio
    using_cached_transcript = Map.get(params, "using_cached_transcript", "false") == "true"

    IO.puts("[ClipsController] Using cached transcript: #{using_cached_transcript}")

    try do
      # Broadcast initial progress
      ProgressChannel.broadcast_progress(project_id, "starting", 0, "Initializing clip detection...")

      # Step 1: Get transcript data (either from cache or transcribe fresh audio)
      {whisper_result, processing_type} = cond do
        using_cached_transcript and Map.has_key?(params, "transcript") ->
          IO.puts("[ClipsController] Using cached transcript data...")
          ProgressChannel.broadcast_progress(project_id, "transcribing", 40, "Using cached transcript...")

          # Parse cached transcript data
          transcript_data = Jason.decode!(params["transcript"])
          # raw_response is already a JSON string from the database
          cached_whisper_response = Jason.decode!(transcript_data["raw_response"])
          IO.puts("[ClipsController] Cached transcript parsed successfully")
          {{:ok, cached_whisper_response}, "cached"}

        Map.has_key?(params, "audio") ->
          audio_upload = params["audio"]
          IO.puts("[ClipsController] Audio filename: #{audio_upload.filename}")
          IO.puts("[ClipsController] Audio content type: #{audio_upload.content_type}")

          # Forward audio to Whisper API
          IO.puts("[ClipsController] Sending audio to Whisper API...")
          ProgressChannel.broadcast_progress(project_id, "transcribing", 10, "Transcribing audio with Whisper...")
          whisper_result = WhisperAPI.transcribe(audio_upload)
          IO.puts("[ClipsController] WhisperAPI call completed")
          ProgressChannel.broadcast_progress(project_id, "transcribing", 40, "Audio transcription completed")
          {whisper_result, "fresh"}

        true ->
          throw {:error, "Either audio file or transcript data must be provided"}
      end

      case whisper_result do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Whisper response received")
          IO.puts("[ClipsController] Whisper response keys: #{inspect(Map.keys(whisper_response))}")

          # Debug: Check if word-level data is available
          words_available = try do
            words = extract_words_from_response(whisper_response)
            case words do
              nil ->
                IO.puts("[ClipsController] extract_words_from_response returned nil")
                false
              [] ->
                IO.puts("[ClipsController] No words found in response")
                false
              words when is_list(words) ->
                IO.puts("[ClipsController] Word-level data available: #{length(words)} words")
                if length(words) > 0 do
                  first_word = hd(words)
                  IO.puts("[ClipsController] First word sample: #{inspect(first_word)}")
                end
                true
              _ ->
                IO.puts("[ClipsController] extract_words_from_response returned unexpected type: #{inspect(words)}")
                false
            end
          rescue
            error ->
              IO.puts("[ClipsController] Error during word extraction: #{inspect(error)}")
              IO.puts("[ClipsController] Error type: #{inspect(Exception.format(:error, error, []))}")
              false
          end

          IO.puts("[ClipsController] Word-level timestamps available: #{words_available}")

          # Step 2: Process verbose_json response - create optimized version for AI, keep full data for validation
          IO.puts("[ClipsController] Processing Whisper response with enhanced timing...")
          # Keep full enhanced response for validation
          full_enhanced_transcript = process_whisper_response_enhanced(whisper_response)
          # Create optimized version for AI (words stripped)
          ai_transcript = process_whisper_response_for_ai(full_enhanced_transcript)

          IO.puts("[ClipsController] Full enhanced transcript keys: #{inspect(Map.keys(full_enhanced_transcript))}")
          if full_enhanced_transcript["segments"] do
            IO.puts("[ClipsController] First segment keys: #{inspect(Map.keys(hd(full_enhanced_transcript["segments"])))}")
          end

          IO.puts("[ClipsController] AI transcript keys: #{inspect(Map.keys(ai_transcript))}")
          if ai_transcript["segments"] do
            IO.puts("[ClipsController] AI first segment keys: #{inspect(Map.keys(hd(ai_transcript["segments"])))}")
          end

          # Step 3: Send to OpenRouter API with system prompt using optimized transcript
          IO.puts("[ClipsController] Sending optimized transcript to OpenRouter API...")
          ProgressChannel.broadcast_progress(project_id, "analyzing", 50, "Analyzing transcript for clip-worthy moments...")
          system_prompt = SystemPrompt.get()

          ai_result = OpenRouterAPI.generate_clips(ai_transcript, system_prompt, user_prompt)
          IO.puts("[ClipsController] OpenRouter API call completed")
          ProgressChannel.broadcast_progress(project_id, "analyzing", 80, "AI analysis completed")

          case ai_result do
            {:ok, ai_response} ->
              IO.puts("[ClipsController] AI response received from OpenRouter")
              IO.puts("[ClipsController] AI response structure: #{inspect(Map.keys(ai_response))}")

              # Step 4: Validate AI response structure
              case validate_ai_response(ai_response) do
                :ok ->
                  IO.puts("[ClipsController] AI response validation successful")

                  # Step 5: Enhanced validation and correction using original Whisper response with word-level data
                  IO.puts("[ClipsController] Starting enhanced clip validation...")
                  IO.puts("[ClipsController] Using original Whisper response for validation...")
                  ProgressChannel.broadcast_progress(project_id, "validating", 85, "Validating and correcting clip timestamps...")
                  case ClipValidation.validate_and_correct_clips(ai_response["clips"], whisper_response, false) do
                    {:ok, validation_result} ->
                      IO.puts("[ClipsController] Enhanced validation completed")
                      IO.puts("[ClipsController] Quality score: #{validation_result.qualityScore}")

                      # Replace clips with validated and corrected versions
                      enhanced_response = ai_response
                      |> Map.put("clips", validation_result.validatedClips)
                      |> Map.put("validation_metadata", %{
                        "qualityScore" => validation_result.qualityScore,
                        "issuesCount" => length(validation_result.issues),
                        "correctionsCount" => length(validation_result.corrections),
                        "validatedAt" => DateTime.utc_now() |> DateTime.to_iso8601()
                      })

                      # Step 6: Return enhanced response with validation data
                      ProgressChannel.broadcast_progress(project_id, "completed", 100, "Clip detection completed successfully!")
                      completion_message = if processing_type == "cached" do
                        "Clip detection completed using cached transcript!"
                      else
                        "Clip detection completed successfully!"
                      end

                      json(conn, %{
                        success: true,
                        clips: enhanced_response,
                        transcript: whisper_response,
                        processing_info: %{
                          used_cached_transcript: processing_type == "cached",
                          processing_type: processing_type,
                          completion_message: completion_message
                        },
                        validation: %{
                          qualityScore: validation_result.qualityScore,
                          issues: validation_result.issues,
                          corrections: validation_result.corrections,
                          clipsProcessed: length(validation_result.validatedClips)
                        }
                      })

                    _ ->
                      IO.puts("[ClipsController] Enhanced validation failed, using original clips")
                      # Fall back to original clips if enhanced validation fails
                      completion_message = if processing_type == "cached" do
                        "Clip detection completed using cached transcript!"
                      else
                        "Clip detection completed successfully!"
                      end

                      json(conn, %{
                        success: true,
                        clips: ai_response,
                        transcript: whisper_response,
                        processing_info: %{
                          used_cached_transcript: processing_type == "cached",
                          processing_type: processing_type,
                          completion_message: completion_message
                        },
                        validation: %{
                          qualityScore: 0.0,
                          issues: ["Enhanced validation failed"],
                          corrections: []
                        }
                      })
                  end

                {:error, reason} ->
                  IO.puts("[ClipsController] AI response validation failed: #{reason}")
                  conn
                  |> put_status(500)
                  |> json(%{
                    success: false,
                    error: "Invalid AI response structure",
                    details: reason
                  })
              end

            {:error, reason} ->
              IO.puts("[ClipsController] OpenRouter API failed: #{inspect(reason)}")
              # Broadcast error to frontend
              ProgressChannel.broadcast_progress(project_id, "error", 0, "AI analysis failed. No credits were charged.")
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "AI clip generation failed",
                details: reason,
                noCreditsCharged: true
              })
          end

        {:error, reason} ->
          IO.puts("[ClipsController] Whisper API failed: #{inspect(reason)}")
          # Broadcast error to frontend
          ProgressChannel.broadcast_progress(project_id, "error", 0, "Audio transcription failed. No credits were charged.")
          conn
          |> put_status(500)
          |> json(%{
            success: false,
            error: "Whisper transcription failed",
            details: reason,
            noCreditsCharged: true
          })
      end

    rescue
      error ->
        IO.puts("[ClipsController] Error in detect: #{inspect(error)}")
        IO.puts("[ClipsController] Error type: #{inspect(Exception.format(:error, error, []))}")
        # Broadcast error to frontend
        ProgressChannel.broadcast_progress(project_id, "error", 0, "Clip detection failed. No credits were charged.")
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Clip detection failed",
          details: Exception.message(error),
          noCreditsCharged: true
        })
    end
  end

  # Process Whisper response with enhanced word timing analysis for AI
  defp process_whisper_response_enhanced(whisper_response) do
    IO.puts("[ClipsController] Processing response with enhanced timing analysis...")

    # Extract word-level data for validation
    words = extract_words_from_response(whisper_response)
    IO.puts("[ClipsController] Extracted #{length(words)} words for validation")

    # Enhance segments with word-level timing analysis
    enhanced_segments = enhance_segments_with_word_timing(whisper_response["segments"] || [])
    IO.puts("[ClipsController] Enhanced #{length(enhanced_segments)} segments with timing analysis")

    processed_response = whisper_response
    |> Map.put("segments", enhanced_segments)
    |> Map.put("words", words)  # Preserve words at top level for validation

    IO.puts("[ClipsController] Enhanced processing complete")
    processed_response
  end

  # Extract word-level timestamps from Whisper response
  defp extract_words_from_response(whisper_response) do
    IO.puts("[ClipsController] extract_words_from_response called with keys: #{inspect(Map.keys(whisper_response))}")

    words = case whisper_response do
      %{"words" => words} when is_list(words) ->
        IO.puts("[ClipsController] Found top-level words: #{length(words)}")
        words
      %{"verbose_json" => %{"words" => words}} when is_list(words) ->
        IO.puts("[ClipsController] Found verbose_json words: #{length(words)}")
        words
      %{"segments" => segments} when is_list(segments) and length(segments) > 0 ->
        IO.puts("[ClipsController] Checking #{length(segments)} segments for word data")

        # Check first segment structure safely
        first_segment = hd(segments)
        IO.puts("[ClipsController] First segment keys: #{inspect(Map.keys(first_segment))}")

        # Check what type the 'words' field actually is
        case Map.get(first_segment, "words") do
          words when is_list(words) ->
            IO.puts("[ClipsController] First segment words is a list with #{length(words)} items")
          words when is_map(words) ->
            IO.puts("[ClipsController] First segment words is a map: #{inspect(words)}")
          words when is_nil(words) ->
            IO.puts("[ClipsController] First segment words is nil")
          words ->
            IO.puts("[ClipsController] First segment words is unexpected type: #{inspect(words)}")
        end

        # Extract words from segments if available, with defensive programming
        extracted_words = segments
        |> Enum.reduce([], fn segment, acc ->
          case segment do
            %{"words" => words} when is_list(words) ->
              IO.puts("[ClipsController] Found segment with #{length(words)} words")

              # Debug: Show first few word entries
              sample_words = Enum.take(words, 3)
              IO.puts("[ClipsController] Sample words: #{inspect(sample_words)}")

              # Filter out nil values and ensure word has required structure
              valid_words = Enum.filter(words, fn word ->
                cond do
                  word == nil ->
                    false
                  not is_map(word) ->
                    IO.puts("[ClipsController] Word is not a map: #{inspect(word)}")
                    false
                  not Map.has_key?(word, "start") ->
                    IO.puts("[ClipsController] Word missing 'start': #{inspect(word)}")
                    false
                  not Map.has_key?(word, "end") ->
                    IO.puts("[ClipsController] Word missing 'end': #{inspect(word)}")
                    false
                  not Map.has_key?(word, "word") ->
                    IO.puts("[ClipsController] Word missing 'word': #{inspect(word)}")
                    false
                  true ->
                    true
                end
              end)

              IO.puts("[ClipsController] Valid words in this segment: #{length(valid_words)}")
              acc ++ valid_words
            %{"words" => words} ->
              IO.puts("[ClipsController] Found segment with words that is not a list: #{inspect(words)}")
              acc
            _ ->
              IO.puts("[ClipsController] Segment has no words or wrong structure")
              acc
          end
        end)

        IO.puts("[ClipsController] Extracted #{length(extracted_words)} words from segments")
        extracted_words

      %{"segments" => segments} when is_list(segments) ->
        IO.puts("[ClipsController] Found empty segments list")
        []
      _ ->
        IO.puts("[ClipsController] No word data found in response")
        []
    end

    IO.puts("[ClipsController] extract_words_from_response returning #{length(words)} words")
    words
  end

  # Validate AI response structure matches system prompt specifications
  defp validate_ai_response(response) do
    required_fields = ["clips"]

    # Check top-level required fields
    case validate_required_fields(response, required_fields) do
      :ok ->
        # Validate clips array
        clips = response["clips"]

        if is_list(clips) and length(clips) > 0 do
          # Validate each clip structure
          case validate_clips_structure(clips) do
            :ok -> :ok
            error -> error
          end
        else
          {:error, "clips must be a non-empty array"}
        end

      error -> error
    end
  end

  defp validate_required_fields(map, required_fields) do
    missing_fields = Enum.filter(required_fields, fn field ->
      not Map.has_key?(map, field)
    end)

    if length(missing_fields) == 0 do
      :ok
    else
      {:error, "Missing required fields: #{Enum.join(missing_fields, ", ")}"}
    end
  end

  defp validate_clips_structure(clips) do
    required_clip_fields = [
      "id", "title", "filename", "type", "segments",
      "total_duration", "combined_transcript", "virality_score",
      "reason", "socialMediaPost"
    ]

    clips
    |> Enum.with_index()
    |> Enum.each(fn {clip, index} ->
      # Check required fields for this clip
      case validate_required_fields(clip, required_clip_fields) do
        :ok ->
          # Validate segments array
          segments = clip["segments"]
          if is_list(segments) and length(segments) > 0 do
            validate_segments_structure(segments, index)
          else
            throw {:error, "Clip #{index} segments must be a non-empty array"}
          end

        error -> throw error
      end
    end)

    :ok
  catch
    {:error, reason} -> {:error, reason}
  end

  defp validate_segments_structure(segments, clip_index) do
    required_segment_fields = ["start_time", "end_time", "duration", "transcript"]

    segments
    |> Enum.with_index()
    |> Enum.each(fn {segment, segment_index} ->
      case validate_required_fields(segment, required_segment_fields) do
        :ok ->
          # Validate timestamp fields are numbers
          validate_timestamp_fields(segment, clip_index, segment_index)

        error -> throw error
      end
    end)

    :ok
  catch
    {:error, reason} -> {:error, reason}
  end

  defp validate_timestamp_fields(segment, clip_index, segment_index) do
    timestamp_fields = ["start_time", "end_time", "duration"]

    Enum.each(timestamp_fields, fn field ->
      value = segment[field]
      if not is_number(value) do
        throw {:error, "Clip #{clip_index} segment #{segment_index} #{field} must be a number"}
      end
    end)

    # Validate type field is either "continuous" or "spliced"
    # This will be checked at the clip level in the calling function
    :ok
  catch
    {:error, reason} -> {:error, reason}
  end

  # Enhance segments with word-level timing analysis for AI processing
  defp enhance_segments_with_word_timing(segments) do
    IO.puts("[ClipsController] Enhancing #{length(segments)} segments with word timing analysis")

    segments
    |> Enum.with_index()
    |> Enum.map(fn {segment, index} ->
      try do
        enhance_single_segment(segment, index)
      rescue
        error ->
          IO.puts("[ClipsController] Error enhancing segment #{index}: #{inspect(error)}")
          # Return original segment if enhancement fails
          segment
      end
    end)
  end

  # Enhance a single segment with timing analysis
  defp enhance_single_segment(segment, index) do
    words = Map.get(segment, "words", [])

    if length(words) > 0 do
      # Calculate word gaps and timing analysis
      words_with_gaps = calculate_word_gaps(words)

      # Identify internal dead space candidates
      internal_gaps = identify_internal_gaps(words_with_gaps)

      # Calculate content density score
      density_score = calculate_content_density(words_with_gaps, segment)

      # Calculate speaking rate
      speaking_rate = calculate_speaking_rate(words_with_gaps, segment)

      # Identify filler words
      filler_words = identify_filler_words(words_with_gaps)

      enhanced_segment = segment
      |> Map.put("words", words_with_gaps)
      |> Map.put("internal_gaps", internal_gaps)
      |> Map.put("content_density_score", density_score)
      |> Map.put("speaking_rate", speaking_rate)
      |> Map.put("filler_word_count", length(filler_words))
      |> Map.put("total_word_count", length(words_with_gaps))
      |> Map.put("has_internal_dead_space", length(internal_gaps) > 0)

      IO.puts("[ClipsController] Segment #{index}: density=#{Float.round(density_score, 2)}, rate=#{Float.round(speaking_rate, 1)}wpm, gaps=#{length(internal_gaps)}")

      enhanced_segment
    else
      IO.puts("[ClipsController] Segment #{index}: No words available for enhancement")
      segment
    end
  end

  # Calculate gaps between consecutive words
  defp calculate_word_gaps(words) do
    words
    |> Enum.with_index()
    |> Enum.map(fn {word, index} ->
      gap_after = if index < length(words) - 1 do
        next_word = Enum.at(words, index + 1)
        next_word["start"] - word["end"]
      else
        0.0
      end

      word
      |> Map.put("gap_after", Float.round(gap_after, 3))
      |> Map.put("word_duration", Float.round(word["end"] - word["start"], 3))
    end)
  end

  # Identify internal gaps that are candidates for splicing
  defp identify_internal_gaps(words_with_gaps) do
    # Define thresholds for different types of gaps
    extended_pause_threshold = 1.5  # >1.5s is significant dead space
    natural_break_threshold = 0.8   # 0.8-1.5s are natural break points

    words_with_gaps
    |> Enum.map(fn word ->
      gap = Map.get(word, "gap_after", 0.0)
      word_text = Map.get(word, "word", "")

      cond do
        gap > extended_pause_threshold ->
          severity = cond do
            gap > 3.0 -> "severe"
            true -> "moderate"
          end

          %{
            "type" => "extended_pause",
            "duration" => gap,
            "position" => word["end"],
            "before_word" => word_text,
            "splice_candidate" => true,
            "severity" => severity
          }

        gap >= natural_break_threshold ->
          %{
            "type" => "natural_break",
            "duration" => gap,
            "position" => word["end"],
            "before_word" => word_text,
            "splice_candidate" => false,
            "severity" => "mild"
          }

        true ->
          nil
      end
    end)
    |> Enum.filter(&(&1 != nil))
  end

  # Calculate content density score based on speaking rate and information value
  defp calculate_content_density(words_with_gaps, segment) do
    segment_duration = Map.get(segment, "end", 0.0) - Map.get(segment, "start", 0.0)
    word_count = length(words_with_gaps)

    if segment_duration > 0 and word_count > 0 do
      # Base density: words per minute
      words_per_minute = (word_count / segment_duration) * 60.0

      # Penalty for extended pauses
      total_pause_time = words_with_gaps
      |> Enum.map(&Map.get(&1, "gap_after", 0.0))
      |> Enum.filter(&(&1 > 0.5))  # Only count pauses > 0.5s
      |> Enum.sum()

      pause_ratio = total_pause_time / segment_duration

      # Information value indicators (questions, exclamations, key terms)
      information_indicators = count_information_indicators(words_with_gaps)
      information_ratio = information_indicators / word_count

      # Calculate final density score (0.0 to 1.0)
      density_score = cond do
        words_per_minute > 180 and pause_ratio < 0.2 -> 1.0  # Very dense
        words_per_minute > 150 and pause_ratio < 0.3 -> 0.9  # Dense
        words_per_minute > 120 and pause_ratio < 0.4 -> 0.8  # Above average
        words_per_minute > 100 and pause_ratio < 0.5 -> 0.7  # Average
        words_per_minute > 80  and pause_ratio < 0.6 -> 0.6  # Below average
        true -> 0.5  # Low density
      end

      # Boost score for high information value
      final_score = min(1.0, density_score + (information_ratio * 0.2))

      Float.round(final_score, 3)
    else
      0.0
    end
  end

  # Calculate speaking rate in words per minute
  defp calculate_speaking_rate(words_with_gaps, segment) do
    segment_duration = Map.get(segment, "end", 0.0) - Map.get(segment, "start", 0.0)
    word_count = length(words_with_gaps)

    if segment_duration > 0 do
      Float.round((word_count / segment_duration) * 60.0, 1)
    else
      0.0
    end
  end

  # Count information value indicators in words
  defp count_information_indicators(words) do
    information_words = [
      "what", "why", "how", "when", "where", "who",  # Questions
      "amazing", "incredible", "unbelievable", "perfect", "excellent",  # Strong adjectives
      "absolutely", "definitely", "literally", "actually", "basically",  # Intensifiers
      "important", "critical", "essential", "significant", "major"  # Importance markers
    ]

    words
    |> Enum.map(&String.downcase(Map.get(&1, "word", "")))
    |> Enum.count(fn word ->
      String.contains?(word, "?") or  # Question marks in transcripts
      Enum.any?(information_words, &String.contains?(word, &1))
    end)
  end

  # Identify filler words and hesitation markers
  defp identify_filler_words(words_with_gaps) do
    filler_patterns = [
      "um", "uh", "er", "ah", "like", "you know", "i mean",
      "sort of", "kind of", "actually", "basically", "literally"
    ]

    words_with_gaps
    |> Enum.map(&String.downcase(Map.get(&1, "word", "")))
    |> Enum.filter(fn word ->
      Enum.any?(filler_patterns, &String.contains?(word, &1))
    end)
  end

  # Process Whisper response for AI - strip words array to reduce payload size
  # Keep enhanced analysis metrics but remove the massive words array
  defp process_whisper_response_for_ai(full_enhanced_transcript) do
    IO.puts("[ClipsController] Creating optimized transcript for AI...")

    # Process segments to strip words but keep enhanced metrics
    optimized_segments = case full_enhanced_transcript["segments"] do
      segments when is_list(segments) ->
        segments
        |> Enum.map(fn segment ->
          # Strip the words array but keep all enhanced analysis
          segment
          |> Map.delete("words")
          |> Map.delete("verbose_json")  # Remove any nested verbose data
        end)
      _ ->
        IO.puts("[ClipsController] No segments found in enhanced transcript")
        []
    end

    # Create optimized transcript structure
    optimized_transcript = %{
      "duration" => Map.get(full_enhanced_transcript, "duration"),
      "language" => Map.get(full_enhanced_transcript, "language"),
      "text" => Map.get(full_enhanced_transcript, "text"),
      "segments" => optimized_segments,
      # Keep metadata about processing but not the heavy data
      "processing_info" => %{
        "segments_processed" => length(optimized_segments),
        "words_stripped" => true,
        "enhanced_metrics_preserved" => true
      }
    }

    IO.puts("[ClipsController] Optimized transcript created with #{length(optimized_segments)} segments")
    IO.puts("[ClipsController] Words array stripped to reduce AI payload size")

    optimized_transcript
  end
end