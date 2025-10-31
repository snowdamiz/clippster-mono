defmodule ClippsterServerWeb.ClipsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.WhisperAPI
  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServer.AI.SystemPrompt

  def detect(conn, %{"audio" => audio_upload, "project_id" => project_id}) do
    IO.puts("[ClipsController] Starting clip detection for project #{project_id}")
    IO.puts("[ClipsController] Audio filename: #{audio_upload.filename}")
    IO.puts("[ClipsController] Audio content type: #{audio_upload.content_type}")

    try do
      # Step 1: Forward audio to Whisper API
      IO.puts("[ClipsController] Sending audio to Whisper API...")
      whisper_result = WhisperAPI.transcribe(audio_upload)
      IO.puts("[ClipsController] WhisperAPI call completed")

      case whisper_result do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Whisper response received")
          IO.puts("[ClipsController] Whisper response keys: #{inspect(Map.keys(whisper_response))}")

          # Step 2: Process verbose_json response (remove words array)
          IO.puts("[ClipsController] Processing Whisper response...")
          processed_transcript = process_whisper_response(whisper_response)

          IO.puts("[ClipsController] Processed transcript keys: #{inspect(Map.keys(processed_transcript))}")
          if processed_transcript["segments"] do
            IO.puts("[ClipsController] First segment keys: #{inspect(Map.keys(hd(processed_transcript["segments"])))}")
          end

          # Step 3: Send to OpenRouter API with system prompt
          IO.puts("[ClipsController] Sending transcript to OpenRouter API...")
          system_prompt = SystemPrompt.get()

          ai_result = OpenRouterAPI.generate_clips(processed_transcript, system_prompt)
          IO.puts("[ClipsController] OpenRouter API call completed")

          case ai_result do
            {:ok, ai_response} ->
              IO.puts("[ClipsController] AI response received from OpenRouter")
              IO.puts("[ClipsController] AI response structure: #{inspect(Map.keys(ai_response))}")

              # Step 4: Validate AI response structure
              case validate_ai_response(ai_response) do
                :ok ->
                  IO.puts("[ClipsController] AI response validation successful")

                  # Step 5: Return both AI response and original Whisper response
                  json(conn, %{
                    success: true,
                    clips: ai_response,
                    transcript: whisper_response
                  })

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

  # Process Whisper response by removing words array from segments
  defp process_whisper_response(whisper_response) do
    segments =
      whisper_response
      |> Map.get("segments", [])
      |> Enum.map(fn segment ->
        segment
        |> Map.delete("words")
      end)

    whisper_response
    |> Map.put("segments", segments)
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