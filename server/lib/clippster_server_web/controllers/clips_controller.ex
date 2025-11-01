defmodule ClippsterServerWeb.ClipsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.WhisperAPI
  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServer.AI.SystemPrompt
  alias ClippsterServer.ClipValidation

  def detect(conn, %{"audio" => audio_upload, "project_id" => project_id, "prompt" => user_prompt}) do
    IO.puts("[ClipsController] Starting clip detection for project #{project_id}")
    IO.puts("[ClipsController] Audio filename: #{audio_upload.filename}")
    IO.puts("[ClipsController] Audio content type: #{audio_upload.content_type}")
    IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

    try do
      # Step 1: Forward audio to Whisper API
      IO.puts("[ClipsController] Sending audio to Whisper API...")
      whisper_result = WhisperAPI.transcribe(audio_upload)
      IO.puts("[ClipsController] WhisperAPI call completed")

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

          # Step 2: Process verbose_json response (remove words array for AI)
          IO.puts("[ClipsController] Processing Whisper response...")
          processed_transcript = process_whisper_response(whisper_response)

          IO.puts("[ClipsController] Processed transcript keys: #{inspect(Map.keys(processed_transcript))}")
          if processed_transcript["segments"] do
            IO.puts("[ClipsController] First segment keys: #{inspect(Map.keys(hd(processed_transcript["segments"])))}")
          end

          # Step 3: Send to OpenRouter API with system prompt
          IO.puts("[ClipsController] Sending transcript to OpenRouter API...")
          system_prompt = SystemPrompt.get()

          ai_result = OpenRouterAPI.generate_clips(processed_transcript, system_prompt, user_prompt)
          IO.puts("[ClipsController] OpenRouter API call completed")

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
                      json(conn, %{
                        success: true,
                        clips: enhanced_response,
                        transcript: whisper_response,
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
                      json(conn, %{
                        success: true,
                        clips: ai_response,
                        transcript: whisper_response,
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
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "AI clip generation failed",
                details: reason
              })
          end

        {:error, reason} ->
          IO.puts("[ClipsController] Whisper API failed: #{inspect(reason)}")
          conn
          |> put_status(500)
          |> json(%{
            success: false,
            error: "Whisper transcription failed",
            details: reason
          })
      end

    rescue
      error ->
        IO.puts("[ClipsController] Error in detect: #{inspect(error)}")
        IO.puts("[ClipsController] Error type: #{inspect(Exception.format(:error, error, []))}")
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Clip detection failed",
          details: Exception.message(error)
        })
    end
  end

  # Process Whisper response by keeping words array for validation but removing segments-level words for AI processing
  defp process_whisper_response(whisper_response) do
    # Extract word-level data for validation before processing
    words = extract_words_from_response(whisper_response)

    segments =
      whisper_response
      |> Map.get("segments", [])
      |> Enum.map(fn segment ->
        segment
        |> Map.delete("words")
      end)

    processed_response = whisper_response
    |> Map.put("segments", segments)
    |> Map.put("words", words)  # Preserve words at top level for validation

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
end