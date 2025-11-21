defmodule ClippsterServerWeb.ClipsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.WhisperAPI
  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServer.AI.SystemPrompt
  alias ClippsterServer.ClipValidation
  alias ClippsterServer.Credits
  alias ClippsterServerWeb.ProgressChannel

  def detect_chunked(conn, %{"project_id" => project_id, "prompt" => user_prompt, "chunks" => chunks_json}) do
    # Get user ID and admin status from token
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        IO.puts("[ClipsController] User authenticated: #{user_id}, Admin: #{is_admin}")

        # Parse chunks JSON since FormData sends it as a string
        chunks_metadata = case Jason.decode(chunks_json) do
          {:ok, parsed_chunks} when is_list(parsed_chunks) ->
            parsed_chunks
          {:ok, _} ->
            throw {:error, "chunks must be a list"}
          {:error, _} ->
            throw {:error, "chunks must be valid JSON"}
        end

        IO.puts("[ClipsController] Starting chunked clip detection for project #{project_id}")
        IO.puts("[ClipsController] Processing #{length(chunks_metadata)} chunks")
        IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

        # Check if chunks array is empty
        if length(chunks_metadata) == 0 do
          IO.puts("[ClipsController] No chunks provided - this indicates incomplete chunked transcript data")
          throw {:error, "No chunks available for processing. The chunked transcript may be incomplete or not yet generated."}
        end

        # Determine processing mode based on chunk content
        processing_mode = determine_chunk_processing_mode(chunks_metadata)
        IO.puts("[ClipsController] Using processing mode: #{processing_mode}")

        # Determine if this is a first run (raw audio) or followup run (pre-transcribed)
        is_first_run = processing_mode == :raw_audio
        IO.puts("[ClipsController] First run: #{is_first_run}")

        # Calculate audio duration from chunks
        duration_hours = calculate_duration_from_chunks(chunks_json)
        IO.puts("[ClipsController] Audio duration: #{Float.round(duration_hours, 3)} hours")

        # Bypass credit deduction for admin users
        credits_deducted = if is_admin do
          IO.puts("[ClipsController] Admin user detected - bypassing credit charges")
          0.0
        else
          # Deduct credits before processing for regular users
          case deduct_credits_for_processing(user_id, duration_hours, is_first_run) do
            {:ok, credits} ->
              credits
            {:error, :insufficient_credits, remaining, needed} ->
              IO.puts("[ClipsController] Insufficient credits: have #{Float.round(remaining, 3)}, need #{Float.round(needed, 3)}")
              conn
              |> put_status(402)
              |> json(%{
                success: false,
                error: "Insufficient credits",
                details: "You have #{Float.round(remaining, 3)} credits remaining, but #{Float.round(needed, 3)} credits are required for this operation.",
                credits_required: needed,
                credits_remaining: remaining
              })
              |> then(&{:halt, &1})

            {:error, reason, details} ->
              IO.puts("[ClipsController] Credit deduction failed: #{inspect(reason)} - #{inspect(details)}")
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "Credit deduction failed",
                details: "Unable to process credits: #{inspect(details)}"
              })
              |> then(&{:halt, &1})
          end
        end

        # Continue with processing if not halted
        case credits_deducted do
          {:halt, response} -> response
          credits ->
            IO.puts("[ClipsController] Processing with credits deducted: #{Float.round(credits, 3)}")
            process_chunked_clip_detection(conn, project_id, user_prompt, chunks_metadata, processing_mode, user_id, credits, is_admin)
        end

      {:error, reason} ->
        IO.puts("[ClipsController] Authentication failed: #{inspect(reason)}")
        conn
        |> put_status(401)
        |> json(%{
          success: false,
          error: "Authentication required",
          details: "Please authenticate to use this service"
        })
    end
  end

  # Separate function to handle the actual chunked clip detection process
  defp process_chunked_clip_detection(conn, project_id, user_prompt, chunks_metadata, processing_mode, user_id, credits_deducted, is_admin) do
    try do
      # Broadcast initial progress
      ProgressChannel.broadcast_progress(project_id, "starting", 0, "Initializing chunked clip detection...")

      # Process chunks based on their content type
      {chunk_transcripts, successful_chunks, failed_chunks} = case processing_mode do
        :pre_transcribed ->
          process_pre_transcribed_chunks(chunks_metadata, project_id)
        :raw_audio ->
          process_raw_audio_chunks(chunks_metadata, project_id)
      end

      IO.puts("[ClipsController] All chunks processed. #{length(chunk_transcripts)} results received")

      if length(failed_chunks) > 0 do
        IO.puts("[ClipsController] Warning: #{length(failed_chunks)} chunks failed to process")
        failed_chunks |> Enum.each(fn {:error, reason} ->
          IO.puts("[ClipsController] Failed chunk: #{inspect(reason)}")
        end)
      end

      if length(successful_chunks) == 0 do
        throw {:error, "All chunks failed to process"}
      end

      # Reconstruct timeline from chunks
      IO.puts("[ClipsController] Reconstructing timeline from #{length(chunk_transcripts)} successful chunks...")
      ProgressChannel.broadcast_progress(project_id, "analyzing", 85, "Reconstructing timeline and detecting clips...")

      reconstructed_transcript = reconstruct_timeline_from_chunks(chunk_transcripts)

      # Send to OpenRouter API with reconstructed transcript
      IO.puts("[ClipsController] Sending reconstructed transcript to OpenRouter API...")
      system_prompt = SystemPrompt.get()

      ai_result = OpenRouterAPI.generate_clips(reconstructed_transcript, system_prompt, user_prompt, project_id)
      IO.puts("[ClipsController] OpenRouter API call completed")

      case ai_result do
        {:ok, ai_response} ->
          IO.puts("[ClipsController] AI response received from OpenRouter")

          # The OpenRouter API now handles validation and retry internally
          # The response should already be validated and complete
          IO.puts("[ClipsController] AI response validation successful (handled by API)")

          # Enhanced validation using original chunk data
          IO.puts("[ClipsController] Starting enhanced clip validation with chunk data...")
          ProgressChannel.broadcast_progress(project_id, "validating", 90, "Validating clips with chunk timing data...")

          # Use the first successful chunk's original data for validation (most complete)
          first_successful_result = hd(successful_chunks)
          validation_chunk = case first_successful_result do
            {:ok, chunk_result} -> chunk_result
            _ -> throw {:error, "Invalid successful chunk structure"}
          end
          case ClipValidation.validate_and_correct_clips(ai_response["clips"], validation_chunk.original_whisper_response, true) do
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
                "validatedAt" => DateTime.utc_now() |> DateTime.to_iso8601(),
                "chunksProcessed" => length(successful_chunks),
                "chunksFailed" => length(failed_chunks)
              })

              # Step 6: Return enhanced response with chunk processing data
              total_processed = length(successful_chunks) + length(failed_chunks)
              ProgressChannel.broadcast_progress(project_id, "completed", 100,
                "Chunked clip detection completed! Processed #{length(successful_chunks)}/#{total_processed} chunks successfully.")

              # Get updated user balance after credit deduction (or show unlimited for admins)
              remaining_credits = if is_admin do
                %{
                  hours_remaining: :unlimited,
                  hours_used: 0.0
                }
              else
                {:ok, updated_balance} = Credits.get_user_balance(user_id)
                %{
                  hours_remaining: Decimal.to_float(updated_balance.hours_remaining),
                  hours_used: Decimal.to_float(updated_balance.hours_used)
                }
              end

              json(conn, %{
                success: true,
                clips: enhanced_response,
                transcript: reconstructed_transcript,
                processing_info: %{
                  used_chunked_processing: true,
                  total_chunks: total_processed,
                  successful_chunks: length(successful_chunks),
                  failed_chunks: length(failed_chunks),
                  completion_message: "Clip detection completed using chunked processing!",
                  credits_charged: credits_deducted,
                  remaining_credits: remaining_credits
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
              total_processed = length(successful_chunks) + length(failed_chunks)
              ProgressChannel.broadcast_progress(project_id, "completed", 100,
                "Chunked clip detection completed! Processed #{length(successful_chunks)}/#{total_processed} chunks.")

              # Get updated user balance after credit deduction (or show unlimited for admins)
              remaining_credits = if is_admin do
                %{
                  hours_remaining: :unlimited,
                  hours_used: 0.0
                }
              else
                {:ok, updated_balance} = Credits.get_user_balance(user_id)
                %{
                  hours_remaining: Decimal.to_float(updated_balance.hours_remaining),
                  hours_used: Decimal.to_float(updated_balance.hours_used)
                }
              end

              json(conn, %{
                success: true,
                clips: ai_response,
                transcript: reconstructed_transcript,
                processing_info: %{
                  used_chunked_processing: true,
                  total_chunks: total_processed,
                  successful_chunks: length(successful_chunks),
                  failed_chunks: length(failed_chunks),
                  completion_message: "Clip detection completed using chunked processing!",
                  credits_charged: credits_deducted,
                  remaining_credits: remaining_credits
                },
                validation: %{
                  qualityScore: 0.0,
                  issues: ["Enhanced validation failed"],
                  corrections: []
                }
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

    rescue
      error ->
        IO.puts("[ClipsController] Error in detect_chunked: #{inspect(error)}")
        # Broadcast error to frontend
        ProgressChannel.broadcast_progress(project_id, "error", 0, "Chunked clip detection failed. No credits were charged.")
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Chunked clip detection failed",
          details: Exception.message(error),
          noCreditsCharged: true
        })
    end
  end

  def detect(conn, %{"project_id" => project_id, "prompt" => user_prompt} = params) do
    IO.puts("[ClipsController] Starting clip detection for project #{project_id}")
    IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

    # Get user ID and admin status from token
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        IO.puts("[ClipsController] User authenticated: #{user_id}, Admin: #{is_admin}")

        # Check if we're using a cached transcript or fresh audio
        using_cached_transcript = Map.get(params, "using_cached_transcript", "false") == "true"
        is_first_run = not using_cached_transcript and Map.has_key?(params, "audio")

        IO.puts("[ClipsController] Using cached transcript: #{using_cached_transcript}")
        IO.puts("[ClipsController] First run: #{is_first_run}")

        # Calculate audio duration
        duration_hours = calculate_audio_duration_hours(params)
        IO.puts("[ClipsController] Audio duration: #{Float.round(duration_hours, 3)} hours")

        # Bypass credit deduction for admin users
        credits_deducted = if is_admin do
          IO.puts("[ClipsController] Admin user detected - bypassing credit charges")
          0.0
        else
          # Deduct credits before processing for regular users
          case deduct_credits_for_processing(user_id, duration_hours, is_first_run) do
            {:ok, credits} ->
              credits
            {:error, :insufficient_credits, remaining, needed} ->
              IO.puts("[ClipsController] Insufficient credits: have #{Float.round(remaining, 3)}, need #{Float.round(needed, 3)}")
              conn
              |> put_status(402)
              |> json(%{
                success: false,
                error: "Insufficient credits",
                details: "You have #{Float.round(remaining, 3)} credits remaining, but #{Float.round(needed, 3)} credits are required for this operation.",
                credits_required: needed,
                credits_remaining: remaining
              })
              |> then(&{:halt, &1})

            {:error, reason, details} ->
              IO.puts("[ClipsController] Credit deduction failed: #{inspect(reason)} - #{inspect(details)}")
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "Credit deduction failed",
                details: "Unable to process credits: #{inspect(details)}"
              })
              |> then(&{:halt, &1})
          end
        end

        # Continue with processing if not halted
        case credits_deducted do
          {:halt, response} -> response
          credits ->
            IO.puts("[ClipsController] Processing with credits deducted: #{Float.round(credits, 3)}")
            process_clip_detection(conn, params, user_id, credits, is_admin)
        end

      {:error, reason} ->
        IO.puts("[ClipsController] Authentication failed: #{inspect(reason)}")
        conn
        |> put_status(401)
        |> json(%{
          success: false,
          error: "Authentication required",
          details: "Please authenticate to use this service"
        })
    end
  end

  # Separate function to handle the actual clip detection process
  defp process_clip_detection(conn, params, user_id, credits_deducted, is_admin) do
    %{"project_id" => project_id, "prompt" => user_prompt} = params
    using_cached_transcript = Map.get(params, "using_cached_transcript", "false") == "true"

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

          ai_result = OpenRouterAPI.generate_clips(ai_transcript, system_prompt, user_prompt, project_id)
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

                      # Get updated user balance after credit deduction (or show unlimited for admins)
                      remaining_credits = if is_admin do
                        %{
                          hours_remaining: :unlimited,
                          hours_used: 0.0
                        }
                      else
                        {:ok, updated_balance} = Credits.get_user_balance(user_id)
                        %{
                          hours_remaining: Decimal.to_float(updated_balance.hours_remaining),
                          hours_used: Decimal.to_float(updated_balance.hours_used)
                        }
                      end

                      json(conn, %{
                        success: true,
                        clips: enhanced_response,
                        transcript: whisper_response,
                        processing_info: %{
                          used_cached_transcript: processing_type == "cached",
                          processing_type: processing_type,
                          completion_message: completion_message,
                          credits_charged: credits_deducted,
                          remaining_credits: remaining_credits
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

                      # Get updated user balance after credit deduction (or show unlimited for admins)
                      remaining_credits = if is_admin do
                        %{
                          hours_remaining: :unlimited,
                          hours_used: 0.0
                        }
                      else
                        {:ok, updated_balance} = Credits.get_user_balance(user_id)
                        %{
                          hours_remaining: Decimal.to_float(updated_balance.hours_remaining),
                          hours_used: Decimal.to_float(updated_balance.hours_used)
                        }
                      end

                      json(conn, %{
                        success: true,
                        clips: ai_response,
                        transcript: whisper_response,
                        processing_info: %{
                          used_cached_transcript: processing_type == "cached",
                          processing_type: processing_type,
                          completion_message: completion_message,
                          credits_charged: credits_deducted,
                          remaining_credits: remaining_credits
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

  # Determine chunk processing mode based on chunk content
  defp determine_chunk_processing_mode(chunks_metadata) do
    # Check the first chunk to determine the processing mode
    case chunks_metadata do
      [first_chunk | _] ->
        cond do
          # Check if chunks contain raw audio data (original design)
          Map.has_key?(first_chunk, "base64_data") ->
            :raw_audio

          # Check if chunks contain pre-transcribed data (current frontend behavior)
          Map.has_key?(first_chunk, "raw_json") ->
            :pre_transcribed

          # Default to raw audio if unsure
          true ->
            IO.puts("[ClipsController] Warning: Could not determine chunk type, defaulting to raw audio")
            :raw_audio
        end

      [] ->
        throw {:error, "No chunks provided"}
    end
  end

  # Process pre-transcribed chunks (contains raw_json, no transcription needed)
  defp process_pre_transcribed_chunks(chunks_metadata, project_id) do
    total_chunks = length(chunks_metadata)
    IO.puts("[ClipsController] Processing #{total_chunks} pre-transcribed chunks")
    ProgressChannel.broadcast_progress(project_id, "transcribing", 10, "Processing #{total_chunks} cached transcript chunks...")

    # Process chunks in parallel
    all_chunk_results = chunks_metadata
    |> Enum.with_index()
    |> Enum.map(fn {chunk_metadata, chunk_index} ->
      chunk_progress = 10 + ((chunk_index + 1) * 80 / total_chunks)
      ProgressChannel.broadcast_progress(project_id, "transcribing", trunc(chunk_progress),
        "Processing chunk #{chunk_index + 1}/#{total_chunks}...")

      process_pre_transcribed_chunk(chunk_metadata, chunk_index, project_id)
    end)

    # Separate successful and failed chunks
    {successful_chunks, failed_chunks} = Enum.split_with(all_chunk_results, &match?({:ok, _}, &1))

    # Extract successful results
    chunk_transcripts = successful_chunks |> Enum.map(fn {:ok, result} -> result end)

    {chunk_transcripts, successful_chunks, failed_chunks}
  end

  # Process raw audio chunks (contains base64_data, needs transcription)
  defp process_raw_audio_chunks(chunks_metadata, project_id) do
    total_chunks = length(chunks_metadata)
    IO.puts("[ClipsController] Processing #{total_chunks} raw audio chunks")
    ProgressChannel.broadcast_progress(project_id, "transcribing", 10, "Transcribing #{total_chunks} audio chunks...")

    # Process chunks in batches of 2 to manage API limits
    batch_size = 2
    chunks_with_index = chunks_metadata |> Enum.with_index()
    batches = chunks_with_index |> Enum.chunk_every(batch_size)

    all_chunk_results = batches
    |> Enum.with_index()
    |> Enum.flat_map(fn {batch, batch_index} ->
      IO.puts("[ClipsController] Processing batch #{batch_index + 1}/#{length(batches)} (#{length(batch)} chunks)")

      # Update progress for batch start
      batch_progress = 10 + (batch_index * 70 / length(batches))
      ProgressChannel.broadcast_progress(project_id, "transcribing", trunc(batch_progress),
        "Transcribing batch #{batch_index + 1}/#{length(batches)}...")

      # Process chunks in this batch in parallel
      batch
      |> Enum.map(fn {chunk_metadata, chunk_index} ->
        chunk_progress = batch_progress + ((chunk_index + 1) * (70 / length(batches)) / length(batch))
        ProgressChannel.broadcast_progress(project_id, "transcribing", trunc(chunk_progress),
          "Transcribing chunk #{chunk_index + 1}/#{total_chunks}...")

        process_single_chunk(chunk_metadata, chunk_index, project_id)
      end)
    end)

    # Separate successful and failed chunks
    {successful_chunks, failed_chunks} = Enum.split_with(all_chunk_results, &match?({:ok, _}, &1))

    # Extract successful results
    chunk_transcripts = successful_chunks |> Enum.map(fn {:ok, result} -> result end)

    {chunk_transcripts, successful_chunks, failed_chunks}
  end

  # Process a single pre-transcribed chunk
  defp process_pre_transcribed_chunk(chunk_metadata, chunk_index, _project_id) do
    try do
      chunk_id = Map.get(chunk_metadata, "chunk_id")
      raw_json = Map.get(chunk_metadata, "raw_json")
      start_time = Map.get(chunk_metadata, "start_time")
      end_time = Map.get(chunk_metadata, "end_time")

      IO.puts("[ClipsController] Processing pre-transcribed chunk #{chunk_index}: #{chunk_id} (#{start_time}s - #{end_time}s)")

      # Parse the pre-transcribed JSON data
      case Jason.decode(raw_json) do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} JSON parsed successfully")

          # Create result structure consistent with raw audio processing
          chunk_result = %{
            chunk_id: chunk_id,
            chunk_index: chunk_index,
            start_time: start_time,
            end_time: end_time,
            adjusted_whisper_response: whisper_response,  # Already has correct timestamps
            original_whisper_response: whisper_response,
            transcription: whisper_response
          }

          {:ok, chunk_result}

        {:error, reason} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} JSON parsing failed: #{inspect(reason)}")
          {:error, %{chunk_id: chunk_id, chunk_index: chunk_index, reason: "JSON parsing failed: #{inspect(reason)}"}}
      end

    rescue
      error ->
        IO.puts("[ClipsController] Error processing pre-transcribed chunk #{chunk_index}: #{inspect(error)}")
        {:error, %{chunk_id: "unknown", chunk_index: chunk_index, reason: Exception.message(error)}}
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

  # Process a single chunk and return transcribed result with timing adjustment
  defp process_single_chunk(chunk_metadata, chunk_index, _project_id) do
    try do
      chunk_id = Map.get(chunk_metadata, "chunk_id")
      base64_data = Map.get(chunk_metadata, "base64_data")
      start_time = Map.get(chunk_metadata, "start_time")
      end_time = Map.get(chunk_metadata, "end_time")

      IO.puts("[ClipsController] Processing chunk #{chunk_index}: #{chunk_id} (#{start_time}s - #{end_time}s)")

      # Decode base64 audio data
      audio_data = Base.decode64!(base64_data)

      # Create a temporary upload structure for WhisperAPI
      chunk_upload = %{
        filename: Map.get(chunk_metadata, "filename"),
        content_type: "audio/ogg",
        path: "/tmp/chunk_#{chunk_id}.ogg"
      }

      # Transcribe chunk using Whisper API
      case WhisperAPI.transcribe_binary(audio_data, chunk_upload) do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} transcription successful")

          # Adjust timestamps in the response by chunk start_time
          adjusted_response = adjust_timestamps_for_chunk(whisper_response, start_time)

          # Return result with original response for validation
          {:ok, %{
            chunk_id: chunk_id,
            chunk_index: chunk_index,
            start_time: start_time,
            end_time: end_time,
            adjusted_whisper_response: adjusted_response,
            original_whisper_response: whisper_response,
            transcription: adjusted_response
          }}

        {:error, reason} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} transcription failed: #{inspect(reason)}")
          {:error, %{chunk_id: chunk_id, chunk_index: chunk_index, reason: reason}}
      end

    rescue
      error ->
        IO.puts("[ClipsController] Error processing chunk #{chunk_index}: #{inspect(error)}")
        {:error, %{chunk_id: "unknown", chunk_index: chunk_index, reason: Exception.message(error)}}
    end
  end

  # Adjust timestamps in Whisper response by chunk offset
  defp adjust_timestamps_for_chunk(whisper_response, chunk_start_time) do
    IO.puts("[ClipsController] Adjusting timestamps for chunk starting at #{chunk_start_time}s")

    # Adjust segments
    adjusted_segments = case Map.get(whisper_response, "segments") do
      segments when is_list(segments) ->
        segments
        |> Enum.map(fn segment ->
          segment
          |> Map.put("start", Map.get(segment, "start", 0) + chunk_start_time)
          |> Map.put("end", Map.get(segment, "end", 0) + chunk_start_time)
        end)
      _ ->
        []
    end

    # Adjust words if available
    adjusted_words = case Map.get(whisper_response, "words") do
      words when is_list(words) ->
        words
        |> Enum.map(fn word ->
          word
          |> Map.put("start", Map.get(word, "start", 0) + chunk_start_time)
          |> Map.put("end", Map.get(word, "end", 0) + chunk_start_time)
        end)
      _ ->
        []
    end

    # Update duration to reflect the full timeline position
    original_duration = Map.get(whisper_response, "duration", 0)
    adjusted_duration = original_duration + chunk_start_time

    # Return adjusted response
    whisper_response
    |> Map.put("segments", adjusted_segments)
    |> Map.put("words", adjusted_words)
    |> Map.put("duration", adjusted_duration)
    |> Map.put("chunk_processing_metadata", %{
      "original_start_time" => chunk_start_time,
      "original_duration" => original_duration,
      "adjusted_duration" => adjusted_duration,
      "adjusted_at" => DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  # Calculate audio duration in hours from various sources
  defp calculate_audio_duration_hours(source) when is_map(source) do
    cond do
      # For audio uploads, extract duration from the filename or use default estimation
      Map.has_key?(source, "audio") ->
        audio_upload = source["audio"]
        estimate_duration_from_audio_upload(audio_upload)

      # For cached transcript, extract duration from transcript data
      Map.has_key?(source, "transcript") ->
        transcript_data = Jason.decode!(source["transcript"])
        get_duration_from_transcript_data(transcript_data)

      # For chunked processing, calculate from chunk metadata
      Map.has_key?(source, "chunks") ->
        calculate_duration_from_chunks(source["chunks"])

      true ->
        IO.puts("[ClipsController] Warning: Could not determine audio source for duration calculation")
        0.0
    end
  end

  # Estimate duration from audio upload (basic estimation based on file size)
  defp estimate_duration_from_audio_upload(audio_upload) do
    # For now, we'll use a simple estimation based on typical audio compression
    # In a production environment, you might want to use a library to get actual duration
    case audio_upload do
      %{path: path} when is_binary(path) ->
        # Basic estimation: assume 1MB = 1 minute of audio (rough approximation)
        file_size_mb = get_file_size_mb(path)
        estimated_minutes = file_size_mb * 1.0
        estimated_hours = estimated_minutes / 60.0
        IO.puts("[ClipsController] Estimated duration from file size: #{Float.round(estimated_hours, 3)} hours")
        estimated_hours

      _ ->
        IO.puts("[ClipsController] Warning: Could not estimate duration from audio upload")
        0.0
    end
  end

  # Get duration from transcript data (most accurate)
  defp get_duration_from_transcript_data(transcript_data) do
    case transcript_data do
      %{"raw_response" => raw_response_str} ->
        case Jason.decode(raw_response_str) do
          {:ok, raw_response} ->
            duration_seconds = Map.get(raw_response, "duration", 0.0)
            duration_hours = duration_seconds / 3600.0
            IO.puts("[ClipsController] Duration from transcript: #{Float.round(duration_hours, 3)} hours (#{duration_seconds}s)")
            duration_hours

          _ ->
            IO.puts("[ClipsController] Warning: Could not parse raw_response from transcript")
            0.0
        end

      %{"duration" => duration_seconds} when is_number(duration_seconds) ->
        duration_hours = duration_seconds / 3600.0
        IO.puts("[ClipsController] Duration from transcript: #{Float.round(duration_hours, 3)} hours (#{duration_seconds}s)")
        duration_hours

      _ ->
        IO.puts("[ClipsController] Warning: No duration found in transcript data")
        0.0
    end
  end

  # Calculate duration from chunk metadata
  defp calculate_duration_from_chunks(chunks_json) when is_binary(chunks_json) do
    case Jason.decode(chunks_json) do
      {:ok, chunks} when is_list(chunks) ->
        # Find the maximum end_time across all chunks
        max_end_time = chunks
        |> Enum.map(fn chunk -> Map.get(chunk, "end_time", 0.0) end)
        |> Enum.max()
        |> Kernel.||(0.0)

        duration_hours = max_end_time / 3600.0
        IO.puts("[ClipsController] Duration from chunks: #{Float.round(duration_hours, 3)} hours (#{max_end_time}s)")
        duration_hours

      _ ->
        IO.puts("[ClipsController] Warning: Could not parse chunks for duration calculation")
        0.0
    end
  end

  defp calculate_duration_from_chunks(_), do: 0.0

  # Get file size in MB (simplified version)
  defp get_file_size_mb(file_path) do
    case File.stat(file_path) do
      {:ok, stat} ->
        bytes = stat.size
        mb = bytes / (1024 * 1024)
        IO.puts("[ClipsController] File size: #{Float.round(mb, 2)} MB")
        mb

      _ ->
        IO.puts("[ClipsController] Warning: Could not get file size")
        0.0
    end
  end

  # Deduct credits based on processing type and duration
  defp deduct_credits_for_processing(user_id, duration_hours, is_first_run) do
    # Determine credit rate based on processing type
    credit_rate = if is_first_run, do: 1.0, else: 0.7

    credits_to_deduct = duration_hours * credit_rate

    IO.puts("[ClipsController] Credit deduction calculation:")
    IO.puts("[ClipsController]   Duration: #{Float.round(duration_hours, 3)} hours")
    IO.puts("[ClipsController]   Processing type: #{if is_first_run, do: "First run", else: "Followup run"}")
    IO.puts("[ClipsController]   Credit rate: #{credit_rate}x")
    IO.puts("[ClipsController]   Credits to deduct: #{Float.round(credits_to_deduct, 3)}")

    # Check if user has enough credits
    case Credits.get_user_balance(user_id) do
      {:ok, %{hours_remaining: remaining}} when remaining != :unlimited ->
        remaining_hours = Decimal.to_float(remaining)
        if remaining_hours < credits_to_deduct do
          {:error, :insufficient_credits, remaining_hours, credits_to_deduct}
        else
          # Deduct credits
          case Credits.deduct_credits(user_id, credits_to_deduct) do
            {:ok, _updated_credit} ->
              IO.puts("[ClipsController] Successfully deducted #{Float.round(credits_to_deduct, 3)} credits")
              {:ok, credits_to_deduct}

            {:error, reason} ->
              IO.puts("[ClipsController] Failed to deduct credits: #{inspect(reason)}")
              {:error, :deduction_failed, reason}
          end
        end

      {:ok, %{hours_remaining: :unlimited}} ->
        IO.puts("[ClipsController] User has unlimited credits, no deduction needed")
        {:ok, 0.0}
    end
  end

  # Get user ID and admin status from JWT token
  defp get_user_id_from_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        # Simple JWT decode without verification (for development)
        # In production, use proper JWT verification
        case Jason.decode(Base.url_decode64!(String.split(token, ".") |> Enum.at(1), padding: false)) do
          {:ok, claims} ->
            {:ok, claims["user_id"], claims["is_admin"] || false}
          _ ->
            {:error, :invalid_token}
        end

      _ ->
        {:error, :no_token}
    end
  end

  # Reconstruct timeline from multiple chunk transcripts
  defp reconstruct_timeline_from_chunks(chunk_transcripts) do
    IO.puts("[ClipsController] Reconstructing timeline from #{length(chunk_transcripts)} chunks")

    # Sort chunks by start_time to ensure proper order
    sorted_chunks = chunk_transcripts
    |> Enum.sort_by(&Map.get(&1, :start_time, 0))

    # Combine all segments from all chunks
    all_segments = sorted_chunks
    |> Enum.flat_map(fn chunk ->
      Map.get(chunk.adjusted_whisper_response, "segments", [])
    end)

    # Combine all words from all chunks
    all_words = sorted_chunks
    |> Enum.flat_map(fn chunk ->
      Map.get(chunk.adjusted_whisper_response, "words", [])
    end)

    # Calculate total duration
    total_duration = sorted_chunks
    |> Enum.map(fn chunk -> Map.get(chunk, :end_time, 0) end)
    |> Enum.max()
    |> Kernel.||(0)

    # Combine text from all chunks
    combined_text = sorted_chunks
    |> Enum.map_join(" ", fn chunk ->
      Map.get(chunk.adjusted_whisper_response, "text", "")
    end)

    # Create reconstructed transcript
    reconstructed_transcript = %{
      "duration" => total_duration,
      "text" => combined_text,
      "segments" => all_segments,
      "words" => all_words,
      "language" => "en", # Default language, could be detected from chunks
      "chunk_reconstruction_metadata" => %{
        "chunks_processed" => length(chunk_transcripts),
        "total_segments" => length(all_segments),
        "total_words" => length(all_words),
        "reconstructed_at" => DateTime.utc_now() |> DateTime.to_iso8601(),
        "chunk_ids" => Enum.map(sorted_chunks, &Map.get(&1, :chunk_id))
      }
    }

    IO.puts("[ClipsController] Timeline reconstruction completed:")
    IO.puts("[ClipsController]   Total duration: #{total_duration}s")
    IO.puts("[ClipsController]   Total segments: #{length(all_segments)}")
    IO.puts("[ClipsController]   Total words: #{length(all_words)}")

    reconstructed_transcript
  end
end