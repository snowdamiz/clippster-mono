defmodule ClippsterServerWeb.ClipsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI
  alias ClippsterServer.AI.WhisperAPI
  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServer.AI.SystemPrompt
  alias ClippsterServer.AI.MultimodalClipDetection
  alias ClippsterServer.AI.PromptRulesParser
  alias ClippsterServer.Analytics
  alias ClippsterServer.ClipValidation
  alias ClippsterServer.Credits
  alias ClippsterServerWeb.ProgressChannel

  require Logger

  @max_parallel_chunks 10
  # 3 minutes per chunk for normal mode
  @chunk_timeout_normal 180_000
  # 5 minutes per chunk for multimodal mode
  @chunk_timeout_multimodal 300_000

  # Helper to parse numeric strings that may be integers or floats
  defp parse_numeric_string(nil), do: nil
  defp parse_numeric_string(""), do: nil
  defp parse_numeric_string(val) when is_binary(val) do
    # Try to parse as integer first, then as float
    case Integer.parse(val) do
      {int_val, ""} -> int_val * 1.0
      _ ->
        case Float.parse(val) do
          {float_val, _} -> float_val
          :error -> nil
        end
    end
  end
  defp parse_numeric_string(val) when is_number(val), do: val * 1.0

  def detect_chunked(
        conn,
        %{"project_id" => project_id, "prompt" => user_prompt, "chunks" => chunks_json} = params
      ) do
    # Get user ID and admin status from token
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        IO.puts("[ClipsController] User authenticated: #{user_id}, Admin: #{is_admin}")

        # Check if AI is allowed for this user (skip for admins)
        ai_check = if is_admin, do: :ok, else: check_ai_allowed(user_id)

        case ai_check do
          {:error, message} ->
            IO.puts("[ClipsController] AI blocked for user #{user_id}: #{message}")

            conn
            |> put_status(403)
            |> json(%{
              success: false,
              error: "AI disabled",
              details: message
            })

          :ok ->
            # Parse chunks JSON since FormData sends it as a string
            chunks_metadata =
              case Jason.decode(chunks_json) do
                {:ok, parsed_chunks} when is_list(parsed_chunks) ->
                  parsed_chunks

                {:ok, _} ->
                  throw({:error, "chunks must be a list"})

                {:error, _} ->
                  throw({:error, "chunks must be valid JSON"})
              end

            # Check for multimodal mode
            multimodal_raw = Map.get(params, "multimodal")
            IO.puts("[ClipsController] Raw multimodal param: #{inspect(multimodal_raw)}")
            multimodal = multimodal_raw == "true"
            IO.puts("[ClipsController] Multimodal mode enabled: #{multimodal}")

            # Extract optional time range parameters
            start_time = parse_numeric_string(Map.get(params, "start_time")) || 0.0
            end_time = parse_numeric_string(Map.get(params, "end_time"))

            IO.puts("[ClipsController] Starting chunked clip detection for project #{project_id}")
            IO.puts("[ClipsController] Processing #{length(chunks_metadata)} chunks")
            IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

            if start_time > 0 or end_time != nil do
              IO.puts(
                "[ClipsController] Time range filter: #{start_time}s - #{inspect(end_time)}s"
              )
            end

            # Check if chunks array is empty
            if length(chunks_metadata) == 0 do
              IO.puts(
                "[ClipsController] No chunks provided - this indicates incomplete chunked transcript data"
              )

              throw(
                {:error,
                 "No chunks available for processing. The chunked transcript may be incomplete or not yet generated."}
              )
            end

            # Filter chunks by time range if specified
            filtered_chunks =
              if start_time > 0 or end_time != nil do
                chunks_metadata
                |> Enum.filter(fn chunk ->
                  chunk_start = Map.get(chunk, "start_time", 0)
                  chunk_end = Map.get(chunk, "end_time", 0)

                  # Include chunk if it overlaps with the requested time range
                  chunk_overlaps =
                    chunk_end > start_time and (end_time == nil or chunk_start < end_time)

                  if not chunk_overlaps do
                    IO.puts(
                      "[ClipsController] Filtering out chunk #{chunk_start}s-#{chunk_end}s (outside range)"
                    )
                  end

                  chunk_overlaps
                end)
              else
                chunks_metadata
              end

            if length(filtered_chunks) == 0 do
              IO.puts("[ClipsController] No chunks in specified time range")

              throw(
                {:error,
                 "No chunks available in the specified time range (#{start_time}s - #{inspect(end_time)}s)"}
              )
            end

            if length(filtered_chunks) < length(chunks_metadata) do
              IO.puts(
                "[ClipsController] Filtered to #{length(filtered_chunks)} chunks in time range"
              )
            end

            # Use filtered chunks for processing
            chunks_metadata = filtered_chunks

            # Determine processing mode based on chunk content
            processing_mode = determine_chunk_processing_mode(chunks_metadata)
            IO.puts("[ClipsController] Using processing mode: #{processing_mode}")

            # Determine if this is a first run (raw audio) or followup run (pre-transcribed)
            is_first_run = processing_mode == :raw_audio
            IO.puts("[ClipsController] First run: #{is_first_run}")

            # Calculate audio duration from FILTERED chunks (not total)
            duration_hours = calculate_duration_from_filtered_chunks(chunks_metadata)

            IO.puts(
              "[ClipsController] Audio duration (filtered): #{Float.round(duration_hours, 3)} hours"
            )

            # Extract optional organization_id for org credit deduction
            organization_id = Map.get(params, "organization_id") |> parse_org_id()

            # Bypass credit deduction for admin users
            credit_result =
              if is_admin do
                IO.puts("[ClipsController] Admin user detected - bypassing credit charges")
                {:ok, %{credits: 0.0, job_id: nil, credit_source: :unlimited}}
              else
                # Deduct credits and create job record for regular users
                # Apply 2x multiplier for multimodal mode
                case deduct_credits_and_create_job(user_id, duration_hours, is_first_run,
                       project_id: project_id,
                       organization_id: organization_id,
                       multimodal: multimodal
                     ) do
                  {:ok, result} ->
                    {:ok, result}

                  {:error, :insufficient_credits, remaining, needed} ->
                    IO.puts(
                      "[ClipsController] Insufficient credits: have #{Float.round(remaining, 3)}, need #{Float.round(needed, 3)}"
                    )

                    # Refund any transcription credits already charged for this project
                    # so the user is not billed for transcription when detection cannot proceed
                    {:ok, refunded} =
                      Credits.cancel_jobs_by_project_and_type(
                        project_id,
                        user_id,
                        "transcription",
                        "Detection step had insufficient credits"
                      )

                    IO.puts(
                      "[ClipsController] Refunded #{Float.round(refunded, 3)} transcription credits for project #{project_id}"
                    )

                    details_msg =
                      if refunded > 0 do
                        "You have #{Float.round(remaining + refunded, 3)} credits remaining (#{Float.round(refunded, 3)} transcription credits refunded), but #{Float.round(needed, 3)} credits are required for detection."
                      else
                        "You have #{Float.round(remaining, 3)} credits remaining, but #{Float.round(needed, 3)} credits are required for this operation."
                      end

                    {:halt,
                     conn
                     |> put_status(402)
                     |> json(%{
                       success: false,
                       error: "Insufficient credits",
                       details: details_msg,
                       credits_required: needed,
                       credits_remaining: remaining + refunded,
                       credits_refunded: refunded
                     })}

                  {:error, :not_a_member, details} ->
                    IO.puts("[ClipsController] User not a member of organization")

                    {:halt,
                     conn
                     |> put_status(403)
                     |> json(%{
                       success: false,
                       error: "Not authorized",
                       details: details
                     })}

                  {:error, reason, details} ->
                    IO.puts(
                      "[ClipsController] Credit deduction failed: #{inspect(reason)} - #{inspect(details)}"
                    )

                    {:halt,
                     conn
                     |> put_status(500)
                     |> json(%{
                       success: false,
                       error: "Credit deduction failed",
                       details: "Unable to process credits: #{inspect(details)}"
                     })}
                end
              end

            # Continue with processing if not halted
            case credit_result do
              {:halt, response} ->
                response

              {:ok, %{credits: credits, job_id: job_id, credit_source: credit_source}} ->
                IO.puts(
                  "[ClipsController] Processing with credits deducted: #{Float.round(credits, 3)}, job_id: #{inspect(job_id)}, source: #{credit_source}"
                )

                process_chunked_clip_detection(
                  conn,
                  project_id,
                  user_prompt,
                  chunks_metadata,
                  processing_mode,
                  user_id,
                  credits,
                  is_admin,
                  job_id,
                  multimodal
                )
            end
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
  defp process_chunked_clip_detection(
         conn,
         project_id,
         user_prompt,
         chunks_metadata,
         processing_mode,
         user_id,
         credits_deducted,
         is_admin,
         job_id,
         multimodal
       ) do
    operation = fn ->
      execute_chunked_clip_detection(
        project_id,
        user_prompt,
        chunks_metadata,
        processing_mode,
        user_id,
        multimodal
      )
    end

    case retry_with_backoff(operation, 3, project_id) do
      {:ok, result_map} ->
        # Mark job as completed
        complete_job(job_id)

        # Get updated user balance after credit deduction (or show unlimited for admins)
        remaining_credits =
          if is_admin do
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

        # Add credit info and job_id to result map
        final_result =
          result_map
          |> put_in([:processing_info, :credits_charged], credits_deducted)
          |> put_in([:processing_info, :remaining_credits], remaining_credits)
          |> put_in([:processing_info, :job_id], job_id)

        json(conn, final_result)

      {:error, reason} ->
        # Mark job as failed (but don't auto-refund - user must explicitly cancel)
        error_msg =
          case reason do
            %RuntimeError{message: msg} -> msg
            s when is_binary(s) -> s
            _ -> inspect(reason)
          end

        fail_job(job_id, error_msg)

        # Still refund credits on server errors (legacy behavior)
        refund_credits(user_id, credits_deducted, is_admin)

        ProgressChannel.broadcast_progress(
          project_id,
          "error",
          0,
          "Failed after retries: #{error_msg}. Credits have been refunded."
        )

        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Clip detection failed",
          details: error_msg,
          job_id: job_id,
          creditsRefunded: true
        })
    end
  end

  defp execute_chunked_clip_detection(
         project_id,
         user_prompt,
         chunks_metadata,
         processing_mode,
         user_id,
         multimodal
       ) do
    # Broadcast initial progress
    mode_label = if multimodal, do: "multimodal", else: "chunked"

    ProgressChannel.broadcast_progress(
      project_id,
      "starting",
      0,
      "Initializing #{mode_label} clip detection..."
    )

    # Process chunks based on their content type
    {chunk_transcripts, successful_chunks, failed_chunks} =
      case processing_mode do
        :pre_transcribed ->
          process_pre_transcribed_chunks(chunks_metadata, project_id)

        :raw_audio ->
          process_raw_audio_chunks(chunks_metadata, project_id, user_id)
      end

    IO.puts(
      "[ClipsController] All chunks processed. #{length(chunk_transcripts)} results received"
    )

    if length(failed_chunks) > 0 do
      IO.puts("[ClipsController] Warning: #{length(failed_chunks)} chunks failed to process")

      failed_chunks
      |> Enum.each(fn {:error, reason} ->
        IO.puts("[ClipsController] Failed chunk: #{inspect(reason)}")
      end)
    end

    if length(successful_chunks) == 0 do
      raise "All chunks failed to process"
    end

    # Sort chunks by start_time to ensure proper order
    sorted_chunks = chunk_transcripts |> Enum.sort_by(&Map.get(&1, :start_time, 0))

    # Reconstruct timeline from chunks (needed for validation and final output)
    IO.puts(
      "[ClipsController] Reconstructing timeline from #{length(sorted_chunks)} successful chunks..."
    )

    ProgressChannel.broadcast_progress(project_id, "analyzing", 30, "Reconstructing timeline...")

    reconstructed_transcript = reconstruct_timeline_from_chunks(sorted_chunks)

    # Process chunks with AI - either parallel normal mode or parallel multimodal mode
    # Use news + trends enriched system prompt for better context awareness
    system_prompt = SystemPrompt.get_with_full_context()
    total_chunks = length(sorted_chunks)

    {all_clips, total_usage_tokens} =
      if multimodal do
        # Multimodal mode: Each chunk processed by 3 models + decider, all chunks in parallel
        IO.puts("[ClipsController] Starting MULTIMODAL detection with #{total_chunks} chunks...")

        ProgressChannel.broadcast_progress(
          project_id,
          "analyzing",
          35,
          "Starting multimodal detection (3 AI models per chunk)..."
        )

        process_chunks_parallel_multimodal(
          sorted_chunks,
          system_prompt,
          user_prompt,
          project_id,
          user_id
        )
      else
        # Normal mode: All chunks processed in parallel by single model
        IO.puts("[ClipsController] Starting PARALLEL detection with #{total_chunks} chunks...")

        ProgressChannel.broadcast_progress(
          project_id,
          "analyzing",
          35,
          "Processing #{total_chunks} chunks in parallel..."
        )

        process_chunks_parallel_normal(
          sorted_chunks,
          system_prompt,
          user_prompt,
          project_id,
          user_id
        )
      end

    IO.puts("[ClipsController] All chunks processed. Total clips found: #{length(all_clips)}")
    IO.puts("[ClipsController] Total AI tokens used: #{total_usage_tokens}")

    # Merge overlapping clips from adjacent chunks (due to chunk overlap)
    IO.puts("[ClipsController] Merging overlapping clips from chunk boundaries...")
    ProgressChannel.broadcast_progress(project_id, "merging", 92, "Merging overlapping clips...")
    merged_clips = merge_overlapping_clips(all_clips)

    IO.puts(
      "[ClipsController] After merge: #{length(merged_clips)} clips (was #{length(all_clips)})"
    )

    # Advanced deduplication - catches 2-3 second variations and content duplicates
    IO.puts("[ClipsController] Running advanced duplicate detection...")
    ProgressChannel.broadcast_progress(project_id, "deduplicating", 93, "Removing duplicate clips...")
    deduplicated_clips = deduplicate_clips_advanced(merged_clips)

    # Quality filtering - remove clips below minimum virality threshold
    IO.puts("[ClipsController] Filtering clips by quality threshold...")
    ProgressChannel.broadcast_progress(project_id, "filtering", 94, "Filtering low-quality clips...")
    quality_filtered_clips = filter_by_minimum_virality(deduplicated_clips)

    IO.puts(
      "[ClipsController] After deduplication and quality filtering: #{length(quality_filtered_clips)} clips " <>
      "(removed #{length(merged_clips) - length(quality_filtered_clips)} clips)"
    )

    # Validation step - using the filtered clips and the reconstructed full transcript
    IO.puts("[ClipsController] Starting enhanced clip validation with full timeline data...")

    ProgressChannel.broadcast_progress(
      project_id,
      "validating",
      95,
      "Validating clips with timeline data..."
    )

    # Validate all clips against the reconstructed transcript
    case ClipValidation.validate_and_correct_clips(quality_filtered_clips, reconstructed_transcript, true) do
      {:ok, validation_result} ->
        IO.puts("[ClipsController] Enhanced validation completed")
        IO.puts("[ClipsController] Quality score: #{validation_result.qualityScore}")

        # Apply minimum duration filtering if specified in user prompt
        final_clips =
          case PromptRulesParser.parse_minimum_duration(user_prompt) do
            nil ->
              # No minimum duration rule found, use all validated clips
              validation_result.validatedClips

            min_duration ->
              # Filter clips by minimum duration
              IO.puts("[ClipsController] Applying minimum duration filter: #{min_duration}s")

              filtered =
                ClipValidation.filter_by_minimum_duration(
                  validation_result.validatedClips,
                  min_duration
                )

              removed_count = length(validation_result.validatedClips) - length(filtered)

              if removed_count > 0 do
                IO.puts("[ClipsController] Removed #{removed_count} clips below minimum duration")
              end

              filtered
          end

        # Prepare final response
        total_processed = length(successful_chunks) + length(failed_chunks)

        ProgressChannel.broadcast_progress(
          project_id,
          "completed",
          100,
          "Chunked clip detection completed! Found #{length(final_clips)} clips."
        )

        {:ok,
         %{
           success: true,
           clips: %{"clips" => final_clips},
           transcript: reconstructed_transcript,
           processing_info: %{
             used_chunked_processing: true,
             total_chunks: total_processed,
             successful_chunks: length(successful_chunks),
             failed_chunks: length(failed_chunks),
             completion_message: "Clip detection completed using chunked AI processing!"
           },
           validation: %{
             qualityScore: validation_result.qualityScore,
             issues: validation_result.issues,
             corrections: validation_result.corrections,
             clipsProcessed: length(final_clips)
           }
         }}

      _ ->
        IO.puts("[ClipsController] Enhanced validation failed, using original clips")

        total_processed = length(successful_chunks) + length(failed_chunks)

        ProgressChannel.broadcast_progress(
          project_id,
          "completed",
          100,
          "Chunked clip detection completed! Found #{length(all_clips)} clips."
        )

        {:ok,
         %{
           success: true,
           clips: %{"clips" => all_clips},
           transcript: reconstructed_transcript,
           processing_info: %{
             used_chunked_processing: true,
             total_chunks: total_processed,
             successful_chunks: length(successful_chunks),
             failed_chunks: length(failed_chunks),
             completion_message: "Clip detection completed using chunked AI processing!"
           },
           validation: %{
             qualityScore: 0.0,
             issues: ["Enhanced validation failed"],
             corrections: []
           }
         }}
    end
  end

  # Process all chunks in parallel using a single model (normal mode)
  defp process_chunks_parallel_normal(
         sorted_chunks,
         system_prompt,
         user_prompt,
         project_id,
         user_id
       ) do
    total_chunks = length(sorted_chunks)

    Logger.info("[ClipsController] Starting parallel normal processing of #{total_chunks} chunks")

    results =
      sorted_chunks
      |> Enum.with_index()
      |> Task.async_stream(
        fn {chunk, index} ->
          Logger.info(
            "[ClipsController] Processing chunk #{index + 1}/#{total_chunks} in parallel..."
          )

          # Prepare optimized transcript for this chunk
          ai_transcript = process_whisper_response_for_ai(chunk.adjusted_whisper_response)

          # Call AI for this chunk
          case OpenRouterAPI.generate_clips(ai_transcript, system_prompt, user_prompt, project_id) do
            {:ok, ai_response, usage} ->
              clips = ai_response["clips"] || []
              Logger.info("[ClipsController] Chunk #{index + 1}: Found #{length(clips)} clips")

              # Log usage for this chunk
              AI.log_usage(%{
                user_id: user_id,
                project_id: project_id,
                provider: "openrouter",
                model:
                  Map.get(usage, "model") || System.get_env("OPENROUTER_MODEL", "z-ai/glm-4.7"),
                input_tokens: Map.get(usage, "prompt_tokens"),
                output_tokens: Map.get(usage, "completion_tokens"),
                total_tokens: Map.get(usage, "total_tokens"),
                operation_type: "clip_generation_chunk"
              })

              {:ok, clips, Map.get(usage, "total_tokens", 0)}

            {:error, reason} ->
              Logger.warning(
                "[ClipsController] Error processing chunk #{index + 1}: #{inspect(reason)}"
              )

              {:error, reason}
          end
        end,
        max_concurrency: @max_parallel_chunks,
        timeout: @chunk_timeout_normal,
        on_timeout: :kill_task
      )
      |> Enum.reduce({[], 0}, fn result, {acc_clips, acc_tokens} ->
        case result do
          {:ok, {:ok, clips, tokens}} ->
            {acc_clips ++ clips, acc_tokens + tokens}

          {:ok, {:error, _reason}} ->
            {acc_clips, acc_tokens}

          {:exit, :timeout} ->
            Logger.warning("[ClipsController] Chunk processing timed out")
            {acc_clips, acc_tokens}

          {:exit, reason} ->
            Logger.warning("[ClipsController] Chunk processing exited: #{inspect(reason)}")
            {acc_clips, acc_tokens}
        end
      end)

    # Update progress after parallel processing completes
    ProgressChannel.broadcast_progress(
      project_id,
      "analyzing",
      90,
      "Parallel processing complete. Aggregating results..."
    )

    results
  end

  # Process all chunks in parallel using multimodal detection (3 models + decider per chunk)
  defp process_chunks_parallel_multimodal(
         sorted_chunks,
         system_prompt,
         user_prompt,
         project_id,
         user_id
       ) do
    total_chunks = length(sorted_chunks)

    Logger.info(
      "[ClipsController] Starting parallel MULTIMODAL processing of #{total_chunks} chunks"
    )

    Logger.info(
      "[ClipsController] Each chunk will be processed by #{length(MultimodalClipDetection.get_detection_models())} models + decider"
    )

    results =
      sorted_chunks
      |> Enum.with_index()
      |> Task.async_stream(
        fn {chunk, index} ->
          Logger.info(
            "[ClipsController] Multimodal processing chunk #{index + 1}/#{total_chunks}..."
          )

          # Prepare optimized transcript for this chunk
          ai_transcript = process_whisper_response_for_ai(chunk.adjusted_whisper_response)

          # Use multimodal detection for this chunk
          case MultimodalClipDetection.process_chunk_multimodal(
                 ai_transcript,
                 system_prompt,
                 user_prompt,
                 project_id,
                 index,
                 total_chunks
               ) do
            {:ok, clips, usage_info} ->
              Logger.info(
                "[ClipsController] Multimodal chunk #{index + 1}: Found #{length(clips)} clips"
              )

              # Log usage for each individual model used in multimodal detection
              per_model_usage = Map.get(usage_info, "per_model_usage", [])

              Enum.each(per_model_usage, fn model_usage ->
                AI.log_usage(%{
                  user_id: user_id,
                  project_id: project_id,
                  provider: "openrouter",
                  model: Map.get(model_usage, "model", "unknown"),
                  input_tokens: Map.get(model_usage, "input_tokens", 0),
                  output_tokens: Map.get(model_usage, "output_tokens", 0),
                  total_tokens: Map.get(model_usage, "total_tokens", 0),
                  operation_type: "clip_generation_multimodal_detector"
                })
              end)

              # Log usage for the decider model
              decider_model = Map.get(usage_info, "decider_model")

              if decider_model do
                AI.log_usage(%{
                  user_id: user_id,
                  project_id: project_id,
                  provider: "openrouter",
                  model: decider_model,
                  input_tokens: Map.get(usage_info, "decider_input_tokens", 0),
                  output_tokens: Map.get(usage_info, "decider_output_tokens", 0),
                  total_tokens: Map.get(usage_info, "decider_tokens", 0),
                  operation_type: "clip_generation_multimodal_decider"
                })
              end

              {:ok, clips, Map.get(usage_info, "total_tokens", 0)}

            {:error, reason} ->
              Logger.warning(
                "[ClipsController] Multimodal error on chunk #{index + 1}: #{inspect(reason)}"
              )

              {:error, reason}
          end
        end,
        max_concurrency: @max_parallel_chunks,
        timeout: @chunk_timeout_multimodal,
        on_timeout: :kill_task
      )
      |> Enum.reduce({[], 0}, fn result, {acc_clips, acc_tokens} ->
        case result do
          {:ok, {:ok, clips, tokens}} ->
            {acc_clips ++ clips, acc_tokens + tokens}

          {:ok, {:error, _reason}} ->
            {acc_clips, acc_tokens}

          {:exit, :timeout} ->
            Logger.warning("[ClipsController] Multimodal chunk processing timed out")
            {acc_clips, acc_tokens}

          {:exit, reason} ->
            Logger.warning(
              "[ClipsController] Multimodal chunk processing exited: #{inspect(reason)}"
            )

            {acc_clips, acc_tokens}
        end
      end)

    # Update progress after parallel processing completes
    ProgressChannel.broadcast_progress(
      project_id,
      "analyzing",
      90,
      "Multimodal processing complete. Aggregating results..."
    )

    results
  end

  # Split a transcript into time-based chunks for processing with overlap
  # Overlap ensures clips spanning chunk boundaries are properly detected
  # 90 seconds of overlap between chunks
  @chunk_overlap_seconds 90

  defp split_transcript_into_chunks(transcript, chunk_duration_seconds) do
    segments = transcript["segments"] || []
    total_duration = transcript["duration"] || 0

    # Calculate effective chunk boundaries with overlap
    # Each chunk covers: [chunk_start, chunk_start + chunk_duration + overlap]
    # Next chunk starts at: chunk_start + chunk_duration (so overlap region is shared)
    effective_chunk_duration = chunk_duration_seconds

    # Build chunks with overlap - use sliding window approach
    chunk_boundaries =
      build_chunk_boundaries(total_duration, effective_chunk_duration, @chunk_overlap_seconds)

    Logger.info(
      "[ClipsController] Building #{length(chunk_boundaries)} chunks with #{@chunk_overlap_seconds}s overlap"
    )

    # Assign segments to chunks (segments can belong to multiple chunks due to overlap)
    chunk_boundaries
    |> Enum.with_index()
    |> Enum.map(fn {{chunk_start, chunk_end}, index} ->
      # Get all segments that fall within this chunk's time range
      chunk_segments =
        Enum.filter(segments, fn segment ->
          seg_start = segment["start"] || 0
          seg_end = segment["end"] || seg_start
          # Include segment if it overlaps with chunk time range
          seg_start < chunk_end and seg_end > chunk_start
        end)

      chunk_text =
        chunk_segments
        |> Enum.map(&Map.get(&1, "text", ""))
        |> Enum.join(" ")

      actual_chunk_end =
        case List.last(chunk_segments) do
          nil -> chunk_end
          last_seg -> Map.get(last_seg, "end", chunk_end)
        end

      %{
        "segments" => chunk_segments,
        "text" => chunk_text,
        "duration" => actual_chunk_end - chunk_start,
        "language" => transcript["language"],
        "chunk_index" => index,
        "chunk_start_time" => chunk_start,
        "chunk_end_time" => actual_chunk_end,
        "has_overlap_before" => index > 0,
        "has_overlap_after" => index < length(chunk_boundaries) - 1,
        "overlap_seconds" => @chunk_overlap_seconds
      }
    end)
    |> Enum.filter(fn chunk -> length(chunk["segments"]) > 0 end)
  end

  # Build chunk boundary tuples with overlap
  defp build_chunk_boundaries(total_duration, chunk_duration, overlap) do
    # First chunk starts at 0
    # Each subsequent chunk starts at previous_start + chunk_duration - overlap
    # This creates overlapping regions between chunks
    build_chunk_boundaries_recursive(0, total_duration, chunk_duration, overlap, [])
    |> Enum.reverse()
  end

  defp build_chunk_boundaries_recursive(
         current_start,
         total_duration,
         chunk_duration,
         overlap,
         acc
       ) do
    if current_start >= total_duration do
      acc
    else
      chunk_end = min(current_start + chunk_duration + overlap, total_duration)
      next_start = current_start + chunk_duration

      # Only add chunk if it has meaningful duration
      if chunk_end - current_start > 10 do
        build_chunk_boundaries_recursive(
          next_start,
          total_duration,
          chunk_duration,
          overlap,
          [{current_start, chunk_end} | acc]
        )
      else
        acc
      end
    end
  end

  # Process transcript chunks in parallel with multimodal detection
  defp process_transcript_chunks_multimodal(
         transcript_chunks,
         system_prompt,
         user_prompt,
         project_id,
         user_id
       ) do
    total_chunks = length(transcript_chunks)

    Logger.info(
      "[ClipsController] Starting parallel MULTIMODAL processing of #{total_chunks} transcript chunks"
    )

    transcript_chunks
    |> Enum.with_index()
    |> Task.async_stream(
      fn {chunk_transcript, index} ->
        Logger.info(
          "[ClipsController] Multimodal processing transcript chunk #{index + 1}/#{total_chunks}..."
        )

        case MultimodalClipDetection.process_chunk_multimodal(
               chunk_transcript,
               system_prompt,
               user_prompt,
               project_id,
               index,
               total_chunks
             ) do
          {:ok, clips, usage_info} ->
            Logger.info(
              "[ClipsController] Multimodal chunk #{index + 1}: Found #{length(clips)} clips"
            )

            # Log usage for each individual model used in multimodal detection
            per_model_usage = Map.get(usage_info, "per_model_usage", [])

            Enum.each(per_model_usage, fn model_usage ->
              AI.log_usage(%{
                user_id: user_id,
                project_id: project_id,
                provider: "openrouter",
                model: Map.get(model_usage, "model", "unknown"),
                input_tokens: Map.get(model_usage, "input_tokens", 0),
                output_tokens: Map.get(model_usage, "output_tokens", 0),
                total_tokens: Map.get(model_usage, "total_tokens", 0),
                operation_type: "clip_generation_multimodal_detector"
              })
            end)

            # Log usage for the decider model
            decider_model = Map.get(usage_info, "decider_model")

            if decider_model do
              AI.log_usage(%{
                user_id: user_id,
                project_id: project_id,
                provider: "openrouter",
                model: decider_model,
                input_tokens: Map.get(usage_info, "decider_input_tokens", 0),
                output_tokens: Map.get(usage_info, "decider_output_tokens", 0),
                total_tokens: Map.get(usage_info, "decider_tokens", 0),
                operation_type: "clip_generation_multimodal_decider"
              })
            end

            {:ok, clips, Map.get(usage_info, "total_tokens", 0)}

          {:error, reason} ->
            Logger.warning(
              "[ClipsController] Multimodal error on transcript chunk #{index + 1}: #{inspect(reason)}"
            )

            {:error, reason}
        end
      end,
      max_concurrency: @max_parallel_chunks,
      timeout: @chunk_timeout_multimodal,
      on_timeout: :kill_task
    )
    |> Enum.reduce({[], 0}, fn result, {acc_clips, acc_tokens} ->
      case result do
        {:ok, {:ok, clips, tokens}} ->
          {acc_clips ++ clips, acc_tokens + tokens}

        {:ok, {:error, _reason}} ->
          {acc_clips, acc_tokens}

        {:exit, :timeout} ->
          Logger.warning("[ClipsController] Transcript chunk processing timed out")
          {acc_clips, acc_tokens}

        {:exit, reason} ->
          Logger.warning(
            "[ClipsController] Transcript chunk processing exited: #{inspect(reason)}"
          )

          {acc_clips, acc_tokens}
      end
    end)
  end

  def transcribe(conn, %{"project_id" => project_id} = params) do
    IO.puts("[ClipsController] Starting transcription only for project #{project_id}")

    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        if Map.has_key?(params, "audio") do
          audio_upload = params["audio"]

          duration_hours = calculate_audio_duration_hours(params)

          # Deduct credits and create job for tracking/refunds
          credit_result =
            if is_admin do
              {:ok, %{credits: 0.0, job_id: nil}}
            else
              case deduct_credits_for_transcription(user_id, duration_hours) do
                {:ok, credits} ->
                  # Create job record for refund tracking
                  case Credits.create_processing_job(user_id, credits, duration_hours,
                         project_id: project_id,
                         job_type: "transcription"
                       ) do
                    {:ok, job} ->
                      IO.puts(
                        "[ClipsController] Created transcription job #{job.id} for tracking (#{Float.round(credits, 3)} credits)"
                      )

                      {:ok, %{credits: credits, job_id: job.id}}

                    {:error, _} ->
                      {:ok, %{credits: credits, job_id: nil}}
                  end

                {:error, :insufficient_credits, remaining, needed} ->
                  {:halt,
                   conn
                   |> put_status(402)
                   |> json(%{
                     success: false,
                     error: "Insufficient credits",
                     details:
                       "Need #{Float.round(needed, 3)} credits, have #{Float.round(remaining, 3)}"
                   })}

                {:error, _reason, _} ->
                  {:halt,
                   conn
                   |> put_status(500)
                   |> json(%{success: false, error: "Credit deduction failed"})}
              end
            end

          case credit_result do
            {:halt, response} ->
              response

            {:ok, %{credits: credits, job_id: job_id}} ->
              IO.puts(
                "[ClipsController] Processing transcription with credits: #{Float.round(credits, 3)}, job_id: #{inspect(job_id)}"
              )

              case WhisperAPI.transcribe(audio_upload) do
                {:ok, response} ->
                  # Mark job as completed
                  complete_job(job_id)

                  duration = Map.get(response, "duration", 0)

                  AI.log_usage(%{
                    user_id: user_id,
                    project_id: project_id,
                    provider: "whisper",
                    model: "whisper-1",
                    duration_seconds: Decimal.new(to_string(duration)),
                    operation_type: "transcription_only"
                  })

                  json(conn, %{success: true, transcript: response, job_id: job_id})

                {:error, reason} ->
                  # Mark job as failed and refund
                  fail_job(job_id, inspect(reason))
                  refund_credits(user_id, credits, is_admin)

                  conn
                  |> put_status(500)
                  |> json(%{
                    success: false,
                    error: "Transcription failed: #{inspect(reason)}",
                    job_id: job_id
                  })
              end
          end
        else
          conn |> put_status(400) |> json(%{success: false, error: "No audio file provided"})
        end

      {:error, _} ->
        conn |> put_status(401) |> json(%{success: false, error: "Unauthorized"})
    end
  end

  def detect(conn, %{"project_id" => project_id, "prompt" => user_prompt} = params) do
    IO.puts("[ClipsController] Starting clip detection for project #{project_id}")
    IO.puts("[ClipsController] User prompt: #{String.slice(user_prompt, 0, 100)}...")

    # Get user ID and admin status from token
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        IO.puts("[ClipsController] User authenticated: #{user_id}, Admin: #{is_admin}")

        # Check if AI is allowed for this user (skip for admins)
        ai_check = if is_admin, do: :ok, else: check_ai_allowed(user_id)

        case ai_check do
          {:error, message} ->
            IO.puts("[ClipsController] AI blocked for user #{user_id}: #{message}")

            conn
            |> put_status(403)
            |> json(%{
              success: false,
              error: "AI disabled",
              details: message
            })

          :ok ->
            # Check if we're using a cached transcript or fresh audio
            using_cached_transcript =
              Map.get(params, "using_cached_transcript", "false") == "true"

            is_first_run = not using_cached_transcript and Map.has_key?(params, "audio")

            # Check for multimodal mode
            multimodal_raw = Map.get(params, "multimodal")

            IO.puts(
              "[ClipsController] Raw multimodal param in detect: #{inspect(multimodal_raw)}"
            )

            multimodal = multimodal_raw == "true"

            IO.puts("[ClipsController] Using cached transcript: #{using_cached_transcript}")
            IO.puts("[ClipsController] First run: #{is_first_run}")
            IO.puts("[ClipsController] Multimodal mode enabled: #{multimodal}")

            # Calculate audio duration
            duration_hours = calculate_audio_duration_hours(params)
            IO.puts("[ClipsController] Audio duration: #{Float.round(duration_hours, 3)} hours")

            # Extract optional organization_id for org credit deduction
            organization_id = Map.get(params, "organization_id") |> parse_org_id()

            # Bypass credit deduction for admin users
            credit_result =
              if is_admin do
                IO.puts("[ClipsController] Admin user detected - bypassing credit charges")
                {:ok, %{credits: 0.0, job_id: nil, credit_source: :unlimited}}
              else
                # Deduct credits and create job record for regular users
                # Apply 2x multiplier for multimodal mode
                case deduct_credits_and_create_job(user_id, duration_hours, is_first_run,
                       project_id: project_id,
                       organization_id: organization_id,
                       multimodal: multimodal
                     ) do
                  {:ok, result} ->
                    {:ok, result}

                  {:error, :insufficient_credits, remaining, needed} ->
                    IO.puts(
                      "[ClipsController] Insufficient credits: have #{Float.round(remaining, 3)}, need #{Float.round(needed, 3)}"
                    )

                    {:halt,
                     conn
                     |> put_status(402)
                     |> json(%{
                       success: false,
                       error: "Insufficient credits",
                       details:
                         "You have #{Float.round(remaining, 3)} credits remaining, but #{Float.round(needed, 3)} credits are required for this operation.",
                       credits_required: needed,
                       credits_remaining: remaining
                     })}

                  {:error, :not_a_member, details} ->
                    IO.puts("[ClipsController] User not a member of organization")

                    {:halt,
                     conn
                     |> put_status(403)
                     |> json(%{
                       success: false,
                       error: "Not authorized",
                       details: details
                     })}

                  {:error, reason, details} ->
                    IO.puts(
                      "[ClipsController] Credit deduction failed: #{inspect(reason)} - #{inspect(details)}"
                    )

                    {:halt,
                     conn
                     |> put_status(500)
                     |> json(%{
                       success: false,
                       error: "Credit deduction failed",
                       details: "Unable to process credits: #{inspect(details)}"
                     })}
                end
              end

            # Continue with processing if not halted
            case credit_result do
              {:halt, response} ->
                response

              {:ok, %{credits: credits, job_id: job_id, credit_source: credit_source}} ->
                IO.puts(
                  "[ClipsController] Processing with credits deducted: #{Float.round(credits, 3)}, job_id: #{inspect(job_id)}, source: #{credit_source}"
                )

                process_clip_detection(
                  conn,
                  params,
                  user_id,
                  credits,
                  is_admin,
                  job_id,
                  multimodal
                )
            end
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
  defp process_clip_detection(
         conn,
         params,
         user_id,
         credits_deducted,
         is_admin,
         job_id,
         multimodal
       ) do
    %{"project_id" => project_id} = params

    operation = fn ->
      execute_clip_detection(params, user_id, is_admin, multimodal)
    end

    case retry_with_backoff(operation, 3, project_id) do
      {:ok, result_map} ->
        # Mark job as completed
        complete_job(job_id)

        # Track analytics
        Analytics.track_event("clip_detection", user_id, %{
          project_id: project_id,
          credits_deducted: credits_deducted
        })

        Appsignal.increment_counter("clips.created", 1, %{project_id: to_string(project_id)})

        # Get updated user balance after credit deduction (or show unlimited for admins)
        remaining_credits =
          if is_admin do
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

        # Add credit info and job_id to result map
        final_result =
          result_map
          |> put_in([:processing_info, :credits_charged], credits_deducted)
          |> put_in([:processing_info, :remaining_credits], remaining_credits)
          |> put_in([:processing_info, :job_id], job_id)

        json(conn, final_result)

      {:error, reason} ->
        # Mark job as failed
        error_msg =
          case reason do
            %RuntimeError{message: msg} -> msg
            s when is_binary(s) -> s
            _ -> inspect(reason)
          end

        fail_job(job_id, error_msg)

        # Refund credits on server error
        refund_credits(user_id, credits_deducted, is_admin)

        ProgressChannel.broadcast_progress(
          project_id,
          "error",
          0,
          "Failed after retries: #{error_msg}. Credits have been refunded."
        )

        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Clip detection failed",
          details: error_msg,
          job_id: job_id,
          creditsRefunded: true
        })
    end
  end

  defp execute_clip_detection(params, user_id, _is_admin, multimodal) do
    %{"project_id" => project_id, "prompt" => user_prompt} = params
    using_cached_transcript = Map.get(params, "using_cached_transcript", "false") == "true"

    # Broadcast initial progress
    mode_label = if multimodal, do: "multimodal", else: "standard"

    ProgressChannel.broadcast_progress(
      project_id,
      "starting",
      0,
      "Initializing #{mode_label} clip detection..."
    )

    # Step 1: Get transcript data (either from cache or transcribe fresh audio)
    {whisper_result, processing_type} =
      cond do
        using_cached_transcript and Map.has_key?(params, "transcript") ->
          IO.puts("[ClipsController] Using cached transcript data...")

          ProgressChannel.broadcast_progress(
            project_id,
            "transcribing",
            40,
            "Using cached transcript..."
          )

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

          ProgressChannel.broadcast_progress(
            project_id,
            "transcribing",
            10,
            "Transcribing audio with Whisper..."
          )

          whisper_result = WhisperAPI.transcribe(audio_upload)

          # Log Whisper usage if successful
          case whisper_result do
            {:ok, response} ->
              duration = Map.get(response, "duration")

              AI.log_usage(%{
                user_id: user_id,
                project_id: project_id,
                provider: "whisper",
                model: "whisper-1",
                duration_seconds: Decimal.new(to_string(duration)),
                operation_type: "transcription"
              })

            _ ->
              :ok
          end

          IO.puts("[ClipsController] WhisperAPI call completed")

          ProgressChannel.broadcast_progress(
            project_id,
            "transcribing",
            40,
            "Audio transcription completed"
          )

          {whisper_result, "fresh"}

        true ->
          raise "Either audio file or transcript data must be provided"
      end

    case whisper_result do
      {:ok, whisper_response} ->
        IO.puts("[ClipsController] Whisper response received")
        IO.puts("[ClipsController] Whisper response keys: #{inspect(Map.keys(whisper_response))}")

        # Debug: Check if word-level data is available
        words_available =
          try do
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
                IO.puts(
                  "[ClipsController] extract_words_from_response returned unexpected type: #{inspect(words)}"
                )

                false
            end
          rescue
            error ->
              IO.puts("[ClipsController] Error during word extraction: #{inspect(error)}")

              IO.puts(
                "[ClipsController] Error type: #{inspect(Exception.format(:error, error, []))}"
              )

              false
          end

        IO.puts("[ClipsController] Word-level timestamps available: #{words_available}")

        # Step 2: Process verbose_json response - create optimized version for AI, keep full data for validation
        IO.puts("[ClipsController] Processing Whisper response with enhanced timing...")
        # Keep full enhanced response for validation
        full_enhanced_transcript = process_whisper_response_enhanced(whisper_response)
        # Create optimized version for AI (words stripped)
        ai_transcript = process_whisper_response_for_ai(full_enhanced_transcript)

        IO.puts(
          "[ClipsController] Full enhanced transcript keys: #{inspect(Map.keys(full_enhanced_transcript))}"
        )

        if full_enhanced_transcript["segments"] do
          IO.puts(
            "[ClipsController] First segment keys: #{inspect(Map.keys(hd(full_enhanced_transcript["segments"])))}"
          )
        end

        IO.puts("[ClipsController] AI transcript keys: #{inspect(Map.keys(ai_transcript))}")

        if ai_transcript["segments"] do
          IO.puts(
            "[ClipsController] AI first segment keys: #{inspect(Map.keys(hd(ai_transcript["segments"])))}"
          )
        end

        # Step 3: Send to OpenRouter API with system prompt using optimized transcript
        # Use news + trends enriched system prompt for better context awareness
        system_prompt = SystemPrompt.get_with_full_context()

        ai_result =
          if multimodal do
            # Multimodal mode: Use 3 models + decider for enhanced detection
            # Split large transcripts into chunks to avoid context length limits
            segments = ai_transcript["segments"] || []
            segment_count = length(segments)

            # Estimate tokens: ~4 chars per token, each segment has ~100 chars average
            # Split into chunks of ~15 minutes (900 seconds) to stay under context limits
            chunk_duration_seconds = 900
            total_duration = ai_transcript["duration"] || 0

            if total_duration > chunk_duration_seconds and segment_count > 100 do
              # Split transcript into time-based chunks
              IO.puts(
                "[ClipsController] Large transcript detected (#{segment_count} segments, #{Float.round(total_duration / 60, 1)} min)"
              )

              IO.puts(
                "[ClipsController] Splitting into #{Float.round(total_duration / chunk_duration_seconds, 0) |> trunc()} chunks for multimodal processing..."
              )

              transcript_chunks =
                split_transcript_into_chunks(ai_transcript, chunk_duration_seconds)

              total_chunks = length(transcript_chunks)

              IO.puts(
                "[ClipsController] Created #{total_chunks} transcript chunks for multimodal detection"
              )

              ProgressChannel.broadcast_progress(
                project_id,
                "analyzing",
                50,
                "Running multimodal detection on #{total_chunks} chunks..."
              )

              # Process chunks in parallel with multimodal detection
              {all_clips, total_tokens} =
                process_transcript_chunks_multimodal(
                  transcript_chunks,
                  system_prompt,
                  user_prompt,
                  project_id,
                  user_id
                )

              {:ok, %{"clips" => all_clips}, %{"total_tokens" => total_tokens}}
            else
              # Small transcript - process as single chunk
              IO.puts("[ClipsController] Using MULTIMODAL detection (3 models + decider)...")

              ProgressChannel.broadcast_progress(
                project_id,
                "analyzing",
                50,
                "Running multimodal detection with 3 AI models..."
              )

              case MultimodalClipDetection.process_chunk_multimodal(
                     ai_transcript,
                     system_prompt,
                     user_prompt,
                     project_id,
                     0,
                     1
                   ) do
                {:ok, clips, usage_info} ->
                  {:ok, %{"clips" => clips},
                   %{"total_tokens" => Map.get(usage_info, "total_tokens", 0)}}

                {:error, reason} ->
                  {:error, reason}
              end
            end
          else
            # Normal mode: Single model detection
            IO.puts("[ClipsController] Sending optimized transcript to OpenRouter API...")

            ProgressChannel.broadcast_progress(
              project_id,
              "analyzing",
              50,
              "Analyzing transcript for clip-worthy moments..."
            )

            OpenRouterAPI.generate_clips(ai_transcript, system_prompt, user_prompt, project_id)
          end

        IO.puts("[ClipsController] AI detection completed")
        ProgressChannel.broadcast_progress(project_id, "analyzing", 80, "AI analysis completed")

        case ai_result do
          {:ok, ai_response, usage} ->
            IO.puts("[ClipsController] AI response received from OpenRouter")
            IO.puts("[ClipsController] AI response structure: #{inspect(Map.keys(ai_response))}")

            # Log AI usage
            AI.log_usage(%{
              user_id: user_id,
              project_id: project_id,
              provider: "openrouter",
              model:
                Map.get(usage, "model") || System.get_env("OPENROUTER_MODEL", "z-ai/glm-4.7"),
              input_tokens: Map.get(usage, "prompt_tokens"),
              output_tokens: Map.get(usage, "completion_tokens"),
              total_tokens: Map.get(usage, "total_tokens"),
              operation_type: "clip_generation"
            })

            # Step 4: Validate AI response structure
            case validate_ai_response(ai_response) do
              :ok ->
                IO.puts("[ClipsController] AI response validation successful")

                # Handle empty clips array - no clip-worthy content found
                clips_list = ai_response["clips"] || []

                if length(clips_list) == 0 do
                  IO.puts(
                    "[ClipsController] No clips found in transcript - returning empty result"
                  )

                  ProgressChannel.broadcast_progress(
                    project_id,
                    "completed",
                    100,
                    "Analysis complete - no clip-worthy moments found in this segment"
                  )

                  {:ok,
                   %{
                     success: true,
                     clips: %{"clips" => []},
                     transcript: whisper_response,
                     processing_info: %{
                       used_cached_transcript: processing_type == "cached",
                       processing_type: processing_type,
                       completion_message: "No clip-worthy moments found in this segment"
                     },
                     validation: %{
                       qualityScore: 0.0,
                       issues: [],
                       corrections: [],
                       clipsProcessed: 0
                     }
                   }}
                else
                  # Step 5: Enhanced validation and correction using original Whisper response with word-level data
                  IO.puts("[ClipsController] Starting enhanced clip validation...")
                  IO.puts("[ClipsController] Using original Whisper response for validation...")

                  ProgressChannel.broadcast_progress(
                    project_id,
                    "validating",
                    85,
                    "Validating and correcting clip timestamps..."
                  )

                  case ClipValidation.validate_and_correct_clips(
                         clips_list,
                         whisper_response,
                         false
                       ) do
                    {:ok, validation_result} ->
                      IO.puts("[ClipsController] Enhanced validation completed")

                      IO.puts(
                        "[ClipsController] Quality score: #{validation_result.qualityScore}"
                      )

                      # Apply minimum duration filtering if specified in user prompt
                      final_clips =
                        case PromptRulesParser.parse_minimum_duration(user_prompt) do
                          nil ->
                            # No minimum duration rule found, use all validated clips
                            validation_result.validatedClips

                          min_duration ->
                            # Filter clips by minimum duration
                            IO.puts(
                              "[ClipsController] Applying minimum duration filter: #{min_duration}s"
                            )

                            filtered =
                              ClipValidation.filter_by_minimum_duration(
                                validation_result.validatedClips,
                                min_duration
                              )

                            removed_count =
                              length(validation_result.validatedClips) - length(filtered)

                            if removed_count > 0 do
                              IO.puts(
                                "[ClipsController] Removed #{removed_count} clips below minimum duration"
                              )
                            end

                            filtered
                        end

                      # Replace clips with validated and corrected versions
                      enhanced_response =
                        ai_response
                        |> Map.put("clips", final_clips)
                        |> Map.put("validation_metadata", %{
                          "qualityScore" => validation_result.qualityScore,
                          "issuesCount" => length(validation_result.issues),
                          "correctionsCount" => length(validation_result.corrections),
                          "validatedAt" => DateTime.utc_now() |> DateTime.to_iso8601()
                        })

                      # Step 6: Return enhanced response with validation data
                      ProgressChannel.broadcast_progress(
                        project_id,
                        "completed",
                        100,
                        "Clip detection completed successfully!"
                      )

                      completion_message =
                        if processing_type == "cached" do
                          "Clip detection completed using cached transcript!"
                        else
                          "Clip detection completed successfully!"
                        end

                      {:ok,
                       %{
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
                           clipsProcessed: length(final_clips)
                         }
                       }}

                    _ ->
                      IO.puts(
                        "[ClipsController] Enhanced validation failed, using original clips"
                      )

                      # Fall back to original clips if enhanced validation fails
                      completion_message =
                        if processing_type == "cached" do
                          "Clip detection completed using cached transcript!"
                        else
                          "Clip detection completed successfully!"
                        end

                      {:ok,
                       %{
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
                       }}
                  end
                end

              {:error, reason} ->
                IO.puts("[ClipsController] AI response validation failed: #{reason}")
                raise "Invalid AI response structure: #{reason}"
            end

          {:error, reason} ->
            IO.puts("[ClipsController] OpenRouter API failed: #{inspect(reason)}")
            raise "AI clip generation failed: #{inspect(reason)}"
        end

      {:error, reason} ->
        IO.puts("[ClipsController] Whisper API failed: #{inspect(reason)}")
        raise "Whisper transcription failed: #{inspect(reason)}"
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
            IO.puts(
              "[ClipsController] Warning: Could not determine chunk type, defaulting to raw audio"
            )

            :raw_audio
        end

      [] ->
        throw({:error, "No chunks provided"})
    end
  end

  # Process pre-transcribed chunks (contains raw_json, no transcription needed)
  defp process_pre_transcribed_chunks(chunks_metadata, project_id) do
    total_chunks = length(chunks_metadata)
    IO.puts("[ClipsController] Processing #{total_chunks} pre-transcribed chunks")

    ProgressChannel.broadcast_progress(
      project_id,
      "transcribing",
      10,
      "Processing #{total_chunks} cached transcript chunks..."
    )

    # Process chunks in parallel
    all_chunk_results =
      chunks_metadata
      |> Enum.with_index()
      |> Enum.map(fn {chunk_metadata, chunk_index} ->
        chunk_progress = 10 + (chunk_index + 1) * 80 / total_chunks

        ProgressChannel.broadcast_progress(
          project_id,
          "transcribing",
          trunc(chunk_progress),
          "Processing chunk #{chunk_index + 1}/#{total_chunks}..."
        )

        process_pre_transcribed_chunk(chunk_metadata, chunk_index, project_id)
      end)

    # Separate successful and failed chunks
    {successful_chunks, failed_chunks} = Enum.split_with(all_chunk_results, &match?({:ok, _}, &1))

    # Extract successful results
    chunk_transcripts = successful_chunks |> Enum.map(fn {:ok, result} -> result end)

    {chunk_transcripts, successful_chunks, failed_chunks}
  end

  # Process raw audio chunks (contains base64_data, needs transcription)
  defp process_raw_audio_chunks(chunks_metadata, project_id, user_id) do
    total_chunks = length(chunks_metadata)
    IO.puts("[ClipsController] Processing #{total_chunks} raw audio chunks")

    ProgressChannel.broadcast_progress(
      project_id,
      "transcribing",
      10,
      "Transcribing #{total_chunks} audio chunks..."
    )

    # Process chunks in batches of 2 to manage API limits
    batch_size = 2
    chunks_with_index = chunks_metadata |> Enum.with_index()
    batches = chunks_with_index |> Enum.chunk_every(batch_size)

    all_chunk_results =
      batches
      |> Enum.with_index()
      |> Enum.flat_map(fn {batch, batch_index} ->
        IO.puts(
          "[ClipsController] Processing batch #{batch_index + 1}/#{length(batches)} (#{length(batch)} chunks)"
        )

        # Update progress for batch start
        batch_progress = 10 + batch_index * 70 / length(batches)

        ProgressChannel.broadcast_progress(
          project_id,
          "transcribing",
          trunc(batch_progress),
          "Transcribing batch #{batch_index + 1}/#{length(batches)}..."
        )

        # Process chunks in this batch in parallel
        batch
        |> Enum.map(fn {chunk_metadata, chunk_index} ->
          chunk_progress =
            batch_progress + (chunk_index + 1) * (70 / length(batches)) / length(batch)

          ProgressChannel.broadcast_progress(
            project_id,
            "transcribing",
            trunc(chunk_progress),
            "Transcribing chunk #{chunk_index + 1}/#{total_chunks}..."
          )

          process_single_chunk(chunk_metadata, chunk_index, project_id, user_id)
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

      IO.puts(
        "[ClipsController] Processing pre-transcribed chunk #{chunk_index}: #{chunk_id} (#{start_time}s - #{end_time}s)"
      )

      # Parse the pre-transcribed JSON data
      case Jason.decode(raw_json) do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} JSON parsed successfully")

          # Adjust timestamps in the Whisper response by the chunk's start_time
          # Whisper returns timestamps relative to chunk start (0-based), but we need
          # absolute video timestamps for clip detection to work correctly
          adjusted_response = adjust_timestamps_for_chunk(whisper_response, start_time)

          # Create result structure consistent with raw audio processing
          chunk_result = %{
            chunk_id: chunk_id,
            chunk_index: chunk_index,
            start_time: start_time,
            end_time: end_time,
            adjusted_whisper_response: adjusted_response,
            original_whisper_response: whisper_response,
            transcription: adjusted_response
          }

          {:ok, chunk_result}

        {:error, reason} ->
          IO.puts(
            "[ClipsController] Chunk #{chunk_index} JSON parsing failed: #{inspect(reason)}"
          )

          {:error,
           %{
             chunk_id: chunk_id,
             chunk_index: chunk_index,
             reason: "JSON parsing failed: #{inspect(reason)}"
           }}
      end
    rescue
      error ->
        IO.puts(
          "[ClipsController] Error processing pre-transcribed chunk #{chunk_index}: #{inspect(error)}"
        )

        {:error,
         %{chunk_id: "unknown", chunk_index: chunk_index, reason: Exception.message(error)}}
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

    IO.puts(
      "[ClipsController] Enhanced #{length(enhanced_segments)} segments with timing analysis"
    )

    processed_response =
      whisper_response
      |> Map.put("segments", enhanced_segments)
      # Preserve words at top level for validation
      |> Map.put("words", words)

    IO.puts("[ClipsController] Enhanced processing complete")
    processed_response
  end

  # Extract word-level timestamps from Whisper response
  defp extract_words_from_response(whisper_response) do
    IO.puts(
      "[ClipsController] extract_words_from_response called with keys: #{inspect(Map.keys(whisper_response))}"
    )

    words =
      case whisper_response do
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
              IO.puts(
                "[ClipsController] First segment words is a list with #{length(words)} items"
              )

            words when is_map(words) ->
              IO.puts("[ClipsController] First segment words is a map: #{inspect(words)}")

            words when is_nil(words) ->
              IO.puts("[ClipsController] First segment words is nil")

            words ->
              IO.puts(
                "[ClipsController] First segment words is unexpected type: #{inspect(words)}"
              )
          end

          # Extract words from segments if available, with defensive programming
          extracted_words =
            segments
            |> Enum.reduce([], fn segment, acc ->
              case segment do
                %{"words" => words} when is_list(words) ->
                  IO.puts("[ClipsController] Found segment with #{length(words)} words")

                  # Debug: Show first few word entries
                  sample_words = Enum.take(words, 3)
                  IO.puts("[ClipsController] Sample words: #{inspect(sample_words)}")

                  # Filter out nil values and ensure word has required structure
                  valid_words =
                    Enum.filter(words, fn word ->
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
                  IO.puts(
                    "[ClipsController] Found segment with words that is not a list: #{inspect(words)}"
                  )

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

        cond do
          # Empty clips array is valid - means no clip-worthy content found
          is_list(clips) and length(clips) == 0 ->
            IO.puts(
              "[ClipsController] AI returned empty clips array - no clip-worthy content found"
            )

            :ok

          # Non-empty clips array - validate each clip structure
          is_list(clips) and length(clips) > 0 ->
            case validate_clips_structure(clips) do
              :ok -> :ok
              error -> error
            end

          # Not a list
          true ->
            {:error, "clips must be an array"}
        end

      error ->
        error
    end
  end

  defp validate_required_fields(map, required_fields) do
    missing_fields =
      Enum.filter(required_fields, fn field ->
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
      "id",
      "title",
      "filename",
      "type",
      "segments",
      "total_duration",
      "combined_transcript",
      "virality_score",
      "reason",
      "socialMediaPost"
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
            throw({:error, "Clip #{index} segments must be a non-empty array"})
          end

        error ->
          throw(error)
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

        error ->
          throw(error)
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
        throw({:error, "Clip #{clip_index} segment #{segment_index} #{field} must be a number"})
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

      enhanced_segment =
        segment
        |> Map.put("words", words_with_gaps)
        |> Map.put("internal_gaps", internal_gaps)
        |> Map.put("content_density_score", density_score)
        |> Map.put("speaking_rate", speaking_rate)
        |> Map.put("filler_word_count", length(filler_words))
        |> Map.put("total_word_count", length(words_with_gaps))
        |> Map.put("has_internal_dead_space", length(internal_gaps) > 0)

      IO.puts(
        "[ClipsController] Segment #{index}: density=#{Float.round(density_score, 2)}, rate=#{Float.round(speaking_rate, 1)}wpm, gaps=#{length(internal_gaps)}"
      )

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
      gap_after =
        if index < length(words) - 1 do
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
    # >1.5s is significant dead space
    extended_pause_threshold = 1.5
    # 0.8-1.5s are natural break points
    natural_break_threshold = 0.8

    words_with_gaps
    |> Enum.map(fn word ->
      gap = Map.get(word, "gap_after", 0.0)
      word_text = Map.get(word, "word", "")

      cond do
        gap > extended_pause_threshold ->
          severity =
            cond do
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
      words_per_minute = word_count / segment_duration * 60.0

      # Penalty for extended pauses
      total_pause_time =
        words_with_gaps
        |> Enum.map(&Map.get(&1, "gap_after", 0.0))
        # Only count pauses > 0.5s
        |> Enum.filter(&(&1 > 0.5))
        |> Enum.sum()

      pause_ratio = total_pause_time / segment_duration

      # Information value indicators (questions, exclamations, key terms)
      information_indicators = count_information_indicators(words_with_gaps)
      information_ratio = information_indicators / word_count

      # Calculate final density score (0.0 to 1.0)
      density_score =
        cond do
          # Very dense
          words_per_minute > 180 and pause_ratio < 0.2 -> 1.0
          # Dense
          words_per_minute > 150 and pause_ratio < 0.3 -> 0.9
          # Above average
          words_per_minute > 120 and pause_ratio < 0.4 -> 0.8
          # Average
          words_per_minute > 100 and pause_ratio < 0.5 -> 0.7
          # Below average
          words_per_minute > 80 and pause_ratio < 0.6 -> 0.6
          # Low density
          true -> 0.5
        end

      # Boost score for high information value
      final_score = min(1.0, density_score + information_ratio * 0.2)

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
      Float.round(word_count / segment_duration * 60.0, 1)
    else
      0.0
    end
  end

  # Count information value indicators in words
  defp count_information_indicators(words) do
    information_words = [
      # Questions
      "what",
      "why",
      "how",
      "when",
      "where",
      "who",
      # Strong adjectives
      "amazing",
      "incredible",
      "unbelievable",
      "perfect",
      "excellent",
      # Intensifiers
      "absolutely",
      "definitely",
      "literally",
      "actually",
      "basically",
      # Importance markers
      "important",
      "critical",
      "essential",
      "significant",
      "major"
    ]

    words
    |> Enum.map(&String.downcase(Map.get(&1, "word", "")))
    |> Enum.count(fn word ->
      # Question marks in transcripts
      String.contains?(word, "?") or
        Enum.any?(information_words, &String.contains?(word, &1))
    end)
  end

  # Identify filler words and hesitation markers
  defp identify_filler_words(words_with_gaps) do
    filler_patterns = [
      "um",
      "uh",
      "er",
      "ah",
      "like",
      "you know",
      "i mean",
      "sort of",
      "kind of",
      "actually",
      "basically",
      "literally"
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
    optimized_segments =
      case full_enhanced_transcript["segments"] do
        segments when is_list(segments) ->
          segments
          |> Enum.map(fn segment ->
            # Strip the words array but keep all enhanced analysis
            segment
            |> Map.delete("words")
            # Remove any nested verbose data
            |> Map.delete("verbose_json")
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

    IO.puts(
      "[ClipsController] Optimized transcript created with #{length(optimized_segments)} segments"
    )

    IO.puts("[ClipsController] Words array stripped to reduce AI payload size")

    optimized_transcript
  end

  # Process a single chunk and return transcribed result with timing adjustment
  defp process_single_chunk(chunk_metadata, chunk_index, project_id, user_id) do
    try do
      chunk_id = Map.get(chunk_metadata, "chunk_id")
      base64_data = Map.get(chunk_metadata, "base64_data")
      start_time = Map.get(chunk_metadata, "start_time")
      end_time = Map.get(chunk_metadata, "end_time")

      IO.puts(
        "[ClipsController] Processing chunk #{chunk_index}: #{chunk_id} (#{start_time}s - #{end_time}s)"
      )

      # Decode base64 audio data
      audio_data = Base.decode64!(base64_data)

      # Create a temporary upload structure for WhisperAPI
      chunk_upload = %{
        filename: Map.get(chunk_metadata, "filename"),
        content_type: "audio/ogg",
        path: "/tmp/chunk_#{chunk_id}.mp3"
      }

      # Transcribe chunk using Whisper API
      case WhisperAPI.transcribe_binary(audio_data, chunk_upload) do
        {:ok, whisper_response} ->
          IO.puts("[ClipsController] Chunk #{chunk_index} transcription successful")

          # Log Whisper usage
          duration = Map.get(whisper_response, "duration")

          AI.log_usage(%{
            user_id: user_id,
            project_id: project_id,
            provider: "whisper",
            model: "whisper-1",
            duration_seconds: Decimal.new(to_string(duration)),
            operation_type: "transcription_chunk"
          })

          # Adjust timestamps in the response by chunk start_time
          adjusted_response = adjust_timestamps_for_chunk(whisper_response, start_time)

          # Return result with original response for validation
          {:ok,
           %{
             chunk_id: chunk_id,
             chunk_index: chunk_index,
             start_time: start_time,
             end_time: end_time,
             adjusted_whisper_response: adjusted_response,
             original_whisper_response: whisper_response,
             transcription: adjusted_response
           }}

        {:error, reason} ->
          IO.puts(
            "[ClipsController] Chunk #{chunk_index} transcription failed: #{inspect(reason)}"
          )

          {:error, %{chunk_id: chunk_id, chunk_index: chunk_index, reason: reason}}
      end
    rescue
      error ->
        IO.puts("[ClipsController] Error processing chunk #{chunk_index}: #{inspect(error)}")

        {:error,
         %{chunk_id: "unknown", chunk_index: chunk_index, reason: Exception.message(error)}}
    end
  end

  # Adjust timestamps in Whisper response by chunk offset
  defp adjust_timestamps_for_chunk(whisper_response, chunk_start_time) do
    IO.puts("[ClipsController] Adjusting timestamps for chunk starting at #{chunk_start_time}s")

    # Adjust segments
    adjusted_segments =
      case Map.get(whisper_response, "segments") do
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
    adjusted_words =
      case Map.get(whisper_response, "words") do
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
      # For explicit duration passed from frontend (most accurate for uploads)
      Map.has_key?(source, "duration") ->
        case Float.parse(to_string(source["duration"])) do
          {duration_seconds, _} ->
            duration_minutes = duration_seconds / 60.0

            IO.puts(
              "[ClipsController] Duration from params: #{Float.round(duration_minutes, 3)} minutes (#{duration_seconds}s)"
            )

            duration_minutes

          :error ->
            IO.puts("[ClipsController] Warning: Could not parse duration param")
            # Fallback to other methods if parsing fails
            estimate_duration_from_other_sources(source)
        end

      true ->
        estimate_duration_from_other_sources(source)
    end
  end

  defp estimate_duration_from_other_sources(source) do
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
        IO.puts(
          "[ClipsController] Warning: Could not determine audio source for duration calculation"
        )

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

        IO.puts(
          "[ClipsController] Estimated duration from file size: #{Float.round(estimated_minutes, 3)} minutes"
        )

        estimated_minutes

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
            duration_minutes = duration_seconds / 60.0

            IO.puts(
              "[ClipsController] Duration from transcript: #{Float.round(duration_minutes, 3)} minutes (#{duration_seconds}s)"
            )

            duration_minutes

          _ ->
            IO.puts("[ClipsController] Warning: Could not parse raw_response from transcript")
            0.0
        end

      %{"duration" => duration_seconds} when is_number(duration_seconds) ->
        duration_minutes = duration_seconds / 60.0

        IO.puts(
          "[ClipsController] Duration from transcript: #{Float.round(duration_minutes, 3)} minutes (#{duration_seconds}s)"
        )

        duration_minutes

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
        max_end_time =
          chunks
          |> Enum.map(fn chunk -> Map.get(chunk, "end_time", 0.0) end)
          |> Enum.max()
          |> Kernel.||(0.0)

        duration_minutes = max_end_time / 60.0

        IO.puts(
          "[ClipsController] Duration from chunks: #{Float.round(duration_minutes, 3)} minutes (#{max_end_time}s)"
        )

        duration_minutes

      _ ->
        IO.puts("[ClipsController] Warning: Could not parse chunks for duration calculation")
        0.0
    end
  end

  defp calculate_duration_from_chunks(_), do: 0.0

  # Calculate duration from filtered chunks (already parsed list)
  # NOTE: This function is NO LONGER USED after the time-range-based chunking fix.
  # Chunks are now created ONLY for the selected time range, so their total duration
  # equals the selected duration. Keeping this for backward compatibility.
  defp calculate_duration_from_filtered_chunks(chunks) when is_list(chunks) do
    # Sum the duration of all chunks in the filtered list
    total_seconds =
      chunks
      |> Enum.reduce(0.0, fn chunk, acc ->
        chunk_start = Map.get(chunk, "start_time", 0.0)
        chunk_end = Map.get(chunk, "end_time", 0.0)
        chunk_duration = chunk_end - chunk_start
        acc + chunk_duration
      end)

    duration_minutes = total_seconds / 60.0

    IO.puts(
      "[ClipsController] Duration from filtered chunks: #{Float.round(duration_minutes, 3)} minutes (#{Float.round(total_seconds, 1)}s)"
    )

    duration_minutes
  end

  defp calculate_duration_from_filtered_chunks(_), do: 0.0

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

  # Deduct credits for transcription only (0.3 rate)
  # Credits are rounded up to whole minutes
  defp deduct_credits_for_transcription(user_id, duration_minutes) do
    credit_rate = 0.3
    credits_to_deduct = Float.ceil(duration_minutes * credit_rate)

    case Credits.get_user_balance(user_id) do
      {:ok, %{hours_remaining: remaining}} when remaining != :unlimited ->
        remaining_credits = Decimal.to_float(remaining)

        if remaining_credits < credits_to_deduct do
          {:error, :insufficient_credits, remaining_credits, credits_to_deduct}
        else
          case Credits.deduct_credits(user_id, credits_to_deduct) do
            {:ok, _} -> {:ok, credits_to_deduct}
            {:error, reason} -> {:error, :deduction_failed, reason}
          end
        end

      {:ok, %{hours_remaining: :unlimited}} ->
        {:ok, 0.0}
    end
  end

  # Deduct credits based on processing type and duration
  # Now supports optional organization_id for org credit deduction
  # Credits are rounded up to whole minutes
  # Multimodal mode applies a 2x multiplier
  defp deduct_credits_for_processing(
         user_id,
         duration_minutes,
         is_first_run,
         organization_id,
         multimodal
       ) do
    # Determine base credit rate based on processing type
    base_rate = if is_first_run, do: 1.0, else: 0.7

    # Apply 2x multiplier for multimodal mode
    credit_rate = if multimodal, do: base_rate * 2.0, else: base_rate

    credits_to_deduct = Float.ceil(duration_minutes * credit_rate)

    IO.puts("[ClipsController] Credit deduction calculation:")
    IO.puts("[ClipsController]   Duration: #{Float.round(duration_minutes, 3)} minutes")

    IO.puts(
      "[ClipsController]   Processing type: #{if is_first_run, do: "First run", else: "Followup run"}"
    )

    IO.puts("[ClipsController]   Multimodal mode: #{multimodal}")

    IO.puts(
      "[ClipsController]   Credit rate: #{credit_rate}x#{if multimodal, do: " (2x multimodal multiplier)", else: ""}"
    )

    IO.puts("[ClipsController]   Credits to deduct: #{Float.round(credits_to_deduct, 3)}")
    IO.puts("[ClipsController]   Organization context: #{inspect(organization_id)}")

    # First check if using org context
    if organization_id do
      # Use organization credits
      case Credits.deduct_credits_with_org_context(user_id, credits_to_deduct, organization_id) do
        {:ok, %{source: :organization, org_id: org_id}} ->
          IO.puts(
            "[ClipsController] Successfully deducted #{Float.round(credits_to_deduct, 3)} credits from org #{org_id}"
          )

          {:ok, credits_to_deduct, :organization}

        {:error, :insufficient_credits, remaining, needed} ->
          IO.puts("[ClipsController] Insufficient org credits: have #{remaining}, need #{needed}")
          {:error, :insufficient_credits, remaining, needed}

        {:error, :not_a_member} ->
          IO.puts("[ClipsController] User is not a member of organization #{organization_id}")
          {:error, :not_a_member, "User is not a member of the specified organization"}

        {:error, reason} ->
          IO.puts("[ClipsController] Failed to deduct org credits: #{inspect(reason)}")
          {:error, :deduction_failed, reason}
      end
    else
      # Use personal credits (original flow)
      case Credits.get_user_balance(user_id) do
        {:ok, %{hours_remaining: remaining}} when remaining != :unlimited ->
          remaining_hours = Decimal.to_float(remaining)

          if remaining_hours < credits_to_deduct do
            {:error, :insufficient_credits, remaining_hours, credits_to_deduct}
          else
            # Deduct credits
            case Credits.deduct_credits(user_id, credits_to_deduct) do
              {:ok, _updated_credit} ->
                IO.puts(
                  "[ClipsController] Successfully deducted #{Float.round(credits_to_deduct, 3)} personal credits"
                )

                {:ok, credits_to_deduct, :personal}

              {:error, reason} ->
                IO.puts("[ClipsController] Failed to deduct credits: #{inspect(reason)}")
                {:error, :deduction_failed, reason}
            end
          end

        {:ok, %{hours_remaining: :unlimited}} ->
          IO.puts("[ClipsController] User has unlimited credits, no deduction needed")
          {:ok, 0.0, :unlimited}
      end
    end
  end

  # Deducts credits and creates a processing job record for tracking.
  # Returns {:ok, %{credits: amount, job_id: id, credit_source: source}} on success.
  # The job_id can be used by the client to cancel and get a refund.
  # Supports optional organization_id for org credit deduction.
  # Supports multimodal mode with 2x credit multiplier.
  defp deduct_credits_and_create_job(user_id, duration_hours, is_first_run, opts) do
    project_id = Keyword.get(opts, :project_id)
    video_url = Keyword.get(opts, :video_url)
    job_type = Keyword.get(opts, :job_type, "clip_detection")
    organization_id = Keyword.get(opts, :organization_id)
    multimodal = Keyword.get(opts, :multimodal, false)

    # First deduct credits (with optional org context and multimodal multiplier)
    case deduct_credits_for_processing(
           user_id,
           duration_hours,
           is_first_run,
           organization_id,
           multimodal
         ) do
      {:ok, credits_deducted, credit_source}
      when is_number(credits_deducted) and credits_deducted > 0 ->
        # Create a processing job record for refund tracking
        job_opts = [
          project_id: project_id,
          video_url: video_url,
          job_type: job_type
        ]

        # Add organization_id to job if using org credits
        job_opts =
          if organization_id, do: [{:organization_id, organization_id} | job_opts], else: job_opts

        case Credits.create_processing_job(user_id, credits_deducted, duration_hours, job_opts) do
          {:ok, job} ->
            IO.puts(
              "[ClipsController] Created processing job #{job.id} for tracking (#{Float.round(credits_deducted, 3)} credits from #{credit_source})"
            )

            {:ok, %{credits: credits_deducted, job_id: job.id, credit_source: credit_source}}

          {:error, reason} ->
            IO.puts("[ClipsController] Warning: Failed to create job record: #{inspect(reason)}")
            # Still return success - job tracking is not critical
            {:ok, %{credits: credits_deducted, job_id: nil, credit_source: credit_source}}
        end

      {:ok, credits_deducted, credit_source}
      when credits_deducted == 0 or credits_deducted == 0.0 ->
        # Admin user or unlimited - no job needed
        {:ok, %{credits: 0.0, job_id: nil, credit_source: credit_source}}

      error ->
        error
    end
  end

  # Marks a processing job as completed.
  defp complete_job(nil), do: :ok

  defp complete_job(job_id) do
    case Credits.complete_processing_job(job_id) do
      {:ok, _job} ->
        IO.puts("[ClipsController] Marked job #{job_id} as completed")
        :ok

      {:error, reason} ->
        IO.puts("[ClipsController] Warning: Failed to mark job as completed: #{inspect(reason)}")
        # Non-critical error
        :ok
    end
  end

  # Marks a processing job as failed.
  defp fail_job(nil, _error), do: :ok

  defp fail_job(job_id, error) do
    case Credits.fail_processing_job(job_id, %{error: error}) do
      {:ok, _job} ->
        IO.puts("[ClipsController] Marked job #{job_id} as failed")
        :ok

      {:error, reason} ->
        IO.puts("[ClipsController] Warning: Failed to mark job as failed: #{inspect(reason)}")
        # Non-critical error
        :ok
    end
  end

  # Get user ID and admin status from JWT token
  defp get_user_id_from_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        # Simple JWT decode without verification (for development)
        # In production, use proper JWT verification
        case Jason.decode(
               Base.url_decode64!(String.split(token, ".") |> Enum.at(1), padding: false)
             ) do
          {:ok, claims} ->
            {:ok, claims["user_id"], claims["is_admin"] || false}

          _ ->
            {:error, :invalid_token}
        end

      _ ->
        {:error, :no_token}
    end
  end

  # Merge overlapping clips that were detected in adjacent chunks due to chunk overlap
  # This prevents duplicate clips and ensures clips spanning chunk boundaries are properly merged
  defp merge_overlapping_clips(clips) do
    Logger.info("[ClipsController] Merging overlapping clips from #{length(clips)} total clips")

    # Sort clips by start time
    sorted_clips =
      Enum.sort_by(clips, fn clip ->
        get_clip_start_time(clip)
      end)

    # Merge clips that have significant overlap (>50% of shorter clip's duration)
    merged =
      Enum.reduce(sorted_clips, [], fn clip, acc ->
        case find_overlapping_clip(clip, acc) do
          nil ->
            # No overlap, add clip to list
            [clip | acc]

          {overlapping_clip, rest} ->
            # Found overlap, merge clips (keep the longer one with expanded boundaries)
            merged_clip = merge_two_clips(overlapping_clip, clip)
            [merged_clip | rest]
        end
      end)
      |> Enum.reverse()

    Logger.info("[ClipsController] After merging: #{length(merged)} clips")
    merged
  end

  # Get the start time of a clip from its segments
  defp get_clip_start_time(clip) do
    segments = Map.get(clip, "segments", [])

    case segments do
      [first | _] -> Map.get(first, "start_time", 0)
      [] -> 0
    end
  end

  # Get the end time of a clip from its segments
  defp get_clip_end_time(clip) do
    segments = Map.get(clip, "segments", [])

    case List.last(segments) do
      nil -> 0
      last -> Map.get(last, "end_time", 0)
    end
  end

  # Find a clip in the accumulator that overlaps significantly with the given clip
  defp find_overlapping_clip(clip, acc) do
    clip_start = get_clip_start_time(clip)
    clip_end = get_clip_end_time(clip)
    clip_duration = clip_end - clip_start

    Enum.reduce_while(acc, nil, fn existing_clip, _result ->
      existing_start = get_clip_start_time(existing_clip)
      existing_end = get_clip_end_time(existing_clip)
      existing_duration = existing_end - existing_start

      # Calculate overlap
      overlap_start = max(clip_start, existing_start)
      overlap_end = min(clip_end, existing_end)
      overlap_duration = max(0, overlap_end - overlap_start)

      # Check if overlap is significant (>50% of shorter clip)
      shorter_duration = min(clip_duration, existing_duration)
      overlap_ratio = if shorter_duration > 0, do: overlap_duration / shorter_duration, else: 0

      if overlap_ratio > 0.5 do
        # Found significant overlap
        rest = Enum.filter(acc, fn c -> c != existing_clip end)
        {:halt, {existing_clip, rest}}
      else
        {:cont, nil}
      end
    end)
  end

  # Merge two overlapping clips, taking the union of their time ranges
  # Keeps the clip with higher virality score as the base, but expands boundaries
  defp merge_two_clips(clip1, clip2) do
    clip1_start = get_clip_start_time(clip1)
    clip1_end = get_clip_end_time(clip1)
    clip2_start = get_clip_start_time(clip2)
    clip2_end = get_clip_end_time(clip2)

    # Take the UNION of timestamps (wider boundaries = more context)
    merged_start = min(clip1_start, clip2_start)
    merged_end = max(clip1_end, clip2_end)
    merged_duration = merged_end - merged_start

    # Use the clip with higher virality score as base
    clip1_score = Map.get(clip1, "virality_score", 0) || 0
    clip2_score = Map.get(clip2, "virality_score", 0) || 0

    base_clip = if clip1_score >= clip2_score, do: clip1, else: clip2

    # Update the segments with merged boundaries
    # For simplicity, create a single continuous segment with merged boundaries
    merged_segments = [
      %{
        "start_time" => merged_start,
        "end_time" => merged_end,
        "duration" => merged_duration,
        "transcript" => get_merged_transcript(clip1, clip2)
      }
    ]

    # Combine transcripts
    combined_transcript = get_merged_transcript(clip1, clip2)

    Logger.info(
      "[ClipsController] Merged clips: #{clip1_start}-#{clip1_end} + #{clip2_start}-#{clip2_end} -> #{merged_start}-#{merged_end}"
    )

    base_clip
    |> Map.put("segments", merged_segments)
    |> Map.put("total_duration", merged_duration)
    |> Map.put("combined_transcript", combined_transcript)
    |> Map.put("type", "continuous")
    |> Map.put("merged_from_chunks", true)
  end

  # Get merged transcript from two clips, preferring the longer one
  defp get_merged_transcript(clip1, clip2) do
    t1 = Map.get(clip1, "combined_transcript", "")
    t2 = Map.get(clip2, "combined_transcript", "")

    if String.length(t1) >= String.length(t2), do: t1, else: t2
  end

  # Advanced duplicate detection using content similarity
  # Catches duplicates that time-overlap logic misses (2-3 second variations, shifted boundaries)
  defp deduplicate_clips_advanced(clips) do
    Logger.info("[ClipsController] Running advanced deduplication on #{length(clips)} clips")
    
    tier1_removed = 0
    tier2_removed = 0
    tier3_removed = 0
    
    # Process clips in order, removing duplicates as we find them
    {deduplicated, stats} = Enum.reduce(clips, {[], %{tier1: 0, tier2: 0, tier3: 0}}, fn clip, {acc, stats} ->
      # Check if this clip is a duplicate of any clip already in the accumulator
      case find_duplicate_clip(clip, acc) do
        nil ->
          # No duplicate found, add to accumulator
          {[clip | acc], stats}
        
        {duplicate_of, tier} ->
          # Found duplicate, log it and skip this clip
          clip_start = get_clip_start_time(clip)
          clip_end = get_clip_end_time(clip)
          dup_start = get_clip_start_time(duplicate_of)
          dup_end = get_clip_end_time(duplicate_of)
          clip_score = Map.get(clip, "virality_score", 0) || 0
          dup_score = Map.get(duplicate_of, "virality_score", 0) || 0
          
          Logger.info(
            "[ClipsController] Tier #{tier} duplicate detected: " <>
            "Clip #{clip_start}-#{clip_end} (score: #{clip_score}) is duplicate of " <>
            "#{dup_start}-#{dup_end} (score: #{dup_score}). Keeping higher score."
          )
          
          # Update stats
          new_stats = Map.update!(stats, String.to_atom("tier#{tier}"), &(&1 + 1))
          {acc, new_stats}
      end
    end)
    
    total_removed = stats.tier1 + stats.tier2 + stats.tier3
    
    Logger.info(
      "[ClipsController] Advanced deduplication complete: " <>
      "Removed #{total_removed} duplicates " <>
      "(Tier 1: #{stats.tier1}, Tier 2: #{stats.tier2}, Tier 3: #{stats.tier3}). " <>
      "#{length(deduplicated)} clips remaining."
    )
    
    Enum.reverse(deduplicated)
  end

  # Find if a clip is a duplicate of any clip in the accumulator
  # Returns {duplicate_clip, tier} or nil
  defp find_duplicate_clip(clip, acc) do
    clip_start = get_clip_start_time(clip)
    clip_end = get_clip_end_time(clip)
    clip_duration = clip_end - clip_start
    clip_transcript = Map.get(clip, "combined_transcript", "")
    clip_title = get_clip_title(clip)
    clip_score = Map.get(clip, "virality_score", 0) || 0
    
    Enum.reduce_while(acc, nil, fn existing_clip, _result ->
      existing_start = get_clip_start_time(existing_clip)
      existing_end = get_clip_end_time(existing_clip)
      existing_duration = existing_end - existing_start
      existing_transcript = Map.get(existing_clip, "combined_transcript", "")
      existing_title = get_clip_title(existing_clip)
      existing_score = Map.get(existing_clip, "virality_score", 0) || 0
      
      # Tier 1: Exact duplicate detection (±3s start/end, >90% transcript similarity)
      start_diff = abs(clip_start - existing_start)
      end_diff = abs(clip_end - existing_end)
      transcript_sim = calculate_transcript_similarity(clip_transcript, existing_transcript)
      
      if start_diff <= 3.0 and end_diff <= 3.0 and transcript_sim > 0.90 do
        # Keep the clip with higher virality score
        if clip_score > existing_score do
          # Current clip is better, but we can't replace in accumulator
          # So we skip this duplicate (the lower-scored one stays)
          {:cont, nil}
        else
          # Existing clip is better, skip current clip
          {:halt, {existing_clip, 1}}
        end
      else
        # Tier 2: Near-duplicate detection (>30% overlap, >75% transcript similarity, <30% duration diff)
        overlap_start = max(clip_start, existing_start)
        overlap_end = min(clip_end, existing_end)
        overlap_duration = max(0, overlap_end - overlap_start)
        shorter_duration = min(clip_duration, existing_duration)
        overlap_ratio = if shorter_duration > 0, do: overlap_duration / shorter_duration, else: 0
        duration_diff_ratio = abs(clip_duration - existing_duration) / max(clip_duration, existing_duration)
        
        if overlap_ratio > 0.30 and transcript_sim > 0.75 and duration_diff_ratio < 0.30 do
          # Keep the clip with higher virality score
          if clip_score > existing_score do
            {:cont, nil}
          else
            {:halt, {existing_clip, 2}}
          end
        else
          # Tier 3: Content-based duplicate detection (>85% transcript similarity, >70% title similarity)
          title_sim = calculate_transcript_similarity(clip_title, existing_title)
          
          if transcript_sim > 0.85 and title_sim > 0.70 do
            # Keep the clip with higher virality score
            if clip_score > existing_score do
              {:cont, nil}
            else
              {:halt, {existing_clip, 3}}
            end
          else
            # Not a duplicate
            {:cont, nil}
          end
        end
      end
    end)
  end

  # Calculate transcript similarity using Jaro distance
  # Returns a value between 0.0 (completely different) and 1.0 (identical)
  defp calculate_transcript_similarity(text1, text2) do
    # Normalize texts for comparison
    norm1 = normalize_text_for_comparison(text1)
    norm2 = normalize_text_for_comparison(text2)
    
    # Handle empty strings
    if norm1 == "" or norm2 == "" do
      0.0
    else
      # Use Jaro distance (built into Elixir String module)
      String.jaro_distance(norm1, norm2)
    end
  end

  # Normalize text for comparison (lowercase, remove punctuation, trim whitespace)
  defp normalize_text_for_comparison(text) when is_binary(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^\w\s]/, "")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end
  defp normalize_text_for_comparison(_), do: ""

  # Get clip title from clip map
  defp get_clip_title(clip) do
    Map.get(clip, "title", "") || ""
  end

  # Filter clips by minimum virality score
  # Removes clips below the quality threshold
  defp filter_by_minimum_virality(clips) do
    minimum_score = 50
    
    filtered = Enum.filter(clips, fn clip ->
      virality_score = Map.get(clip, "virality_score", 0) || 0
      virality_score >= minimum_score
    end)
    
    removed_count = length(clips) - length(filtered)
    
    if removed_count > 0 do
      Logger.info(
        "[ClipsController] Quality filter: Removed #{removed_count} clips below minimum virality score (#{minimum_score}). " <>
        "#{length(filtered)} clips remaining."
      )
      
      # Log examples of removed clips for debugging
      removed_clips = clips -- filtered
      Enum.take(removed_clips, 3)
      |> Enum.each(fn clip ->
        score = Map.get(clip, "virality_score", 0) || 0
        title = get_clip_title(clip)
        Logger.info("[ClipsController] Removed low-quality clip: \"#{title}\" (score: #{score})")
      end)
    end
    
    filtered
  end

  # Reconstruct timeline from multiple chunk transcripts
  defp reconstruct_timeline_from_chunks(chunk_transcripts) do
    IO.puts("[ClipsController] Reconstructing timeline from #{length(chunk_transcripts)} chunks")

    # Sort chunks by start_time to ensure proper order
    sorted_chunks =
      chunk_transcripts
      |> Enum.sort_by(&Map.get(&1, :start_time, 0))

    # Combine all segments from all chunks
    all_segments =
      sorted_chunks
      |> Enum.flat_map(fn chunk ->
        Map.get(chunk.adjusted_whisper_response, "segments", [])
      end)

    # Combine all words from all chunks
    all_words =
      sorted_chunks
      |> Enum.flat_map(fn chunk ->
        Map.get(chunk.adjusted_whisper_response, "words", [])
      end)

    # Calculate total duration
    total_duration =
      sorted_chunks
      |> Enum.map(fn chunk -> Map.get(chunk, :end_time, 0) end)
      |> Enum.max()
      |> Kernel.||(0)

    # Combine text from all chunks
    combined_text =
      sorted_chunks
      |> Enum.map_join(" ", fn chunk ->
        Map.get(chunk.adjusted_whisper_response, "text", "")
      end)

    # Create reconstructed transcript
    reconstructed_transcript = %{
      "duration" => total_duration,
      "text" => combined_text,
      "segments" => all_segments,
      "words" => all_words,
      # Default language, could be detected from chunks
      "language" => "en",
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

  # Helper functions for retry and refund

  defp retry_with_backoff(fun, retries, project_id) do
    try do
      fun.()
    rescue
      e ->
        handle_retry(e, fun, retries, project_id)
    catch
      :throw, {:error, reason} ->
        handle_retry(reason, fun, retries, project_id)

      kind, reason ->
        handle_retry("#{inspect(kind)}: #{inspect(reason)}", fun, retries, project_id)
    end
  end

  defp handle_retry(reason, fun, retries, project_id) do
    error_msg =
      case reason do
        %RuntimeError{message: msg} -> msg
        s when is_binary(s) -> s
        _ -> inspect(reason)
      end

    if retries > 0 do
      IO.puts("[ClipsController] Error: #{error_msg}. Retrying... (#{retries} attempts left)")

      ProgressChannel.broadcast_progress(
        project_id,
        "retrying",
        0,
        "Error: #{error_msg}. Auto-retrying in 2s... (#{retries} attempts left)"
      )

      Process.sleep(2000)
      retry_with_backoff(fun, retries - 1, project_id)
    else
      # Failed after all retries
      {:error, reason}
    end
  end

  defp refund_credits(user_id, amount, is_admin) do
    if !is_admin and amount > 0 do
      IO.puts("[ClipsController] Refunding #{amount} credits to user #{user_id}")

      case Credits.add_credits(user_id, amount) do
        {:ok, _} -> IO.puts("[ClipsController] Refund successful")
        {:error, e} -> IO.puts("[ClipsController] Refund failed: #{inspect(e)}")
      end
    end
  end

  # Parse organization_id from params, handling nil, empty string, and integers
  defp parse_org_id(nil), do: nil
  defp parse_org_id(""), do: nil
  defp parse_org_id(id) when is_integer(id), do: id

  defp parse_org_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {int_id, ""} -> int_id
      _ -> nil
    end
  end

  defp parse_org_id(_), do: nil

  # Deduct credits for real-time detection
  def deduct_realtime_credits(conn, %{"amount" => amount, "reason" => reason}) do
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        # Skip deduction for admins
        if is_admin do
          Logger.info("[ClipsController] Admin user - skipping credit deduction")
          json(conn, %{success: true, credits_deducted: 0})
        else
          case Credits.deduct_credits(user_id, amount) do
            {:ok, _} ->
              Logger.info("[ClipsController] Deducted #{amount} credits for: #{reason}")
              json(conn, %{success: true, credits_deducted: amount})

            {:error, :insufficient_credits} ->
              Logger.warning("[ClipsController] Insufficient credits for user #{user_id}")
              
              conn
              |> put_status(402)
              |> json(%{
                success: false,
                error: "Insufficient credits",
                details: "Not enough credits to continue real-time detection"
              })

            {:error, reason} ->
              Logger.error("[ClipsController] Credit deduction failed: #{inspect(reason)}")
              
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "Credit deduction failed",
                details: inspect(reason)
              })
          end
        end

      {:error, reason} ->
        Logger.warning("[ClipsController] Authentication failed: #{reason}")
        
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})
    end
  end

  # Real-time clip detection endpoint
  # Analyzes a rolling transcript buffer and returns detected clips
  def detect_realtime(conn, params) do
    %{
      "transcript" => transcript,
      "transcript_start" => transcript_start,
      "transcript_end" => transcript_end,
      "prompt" => user_prompt,
      "virality_threshold" => virality_threshold
    } = params
    
    audio_context = Map.get(params, "audio_context", "")
    pending_clip = Map.get(params, "pending_clip", nil)
    case get_user_id_from_token(conn) do
      {:ok, user_id, is_admin} ->
        Logger.info("[ClipsController] Real-time detection for user: #{user_id}")

        # Check if AI is allowed for this user (skip for admins)
        ai_check = if is_admin, do: :ok, else: check_ai_allowed(user_id)

        case ai_check do
          {:error, message} ->
            Logger.warning("[ClipsController] AI blocked for user #{user_id}: #{message}")

            conn
            |> put_status(403)
            |> json(%{
              success: false,
              error: "AI disabled",
              details: message
            })

          :ok ->
            Logger.info(
              "[ClipsController] Analyzing transcript: #{String.slice(transcript, 0, 100)}..."
            )

            # Build prompt for AI using existing system prompt
            # Use news + trends enriched system prompt for better context awareness
            system_prompt = SystemPrompt.get_with_full_context()

            # Format pending clip context for AI
            pending_clip_context = if pending_clip do
              """
              
              PENDING CLIP (ongoing scene being tracked):
              Title: "#{pending_clip["title"]}"
              Time Range: #{pending_clip["start_time"]}s - #{pending_clip["end_time"]}s
              Description: #{pending_clip["description"]}
              Context: #{pending_clip["context_summary"]}
              
              CONTEXT CHANGE DETECTION:
              Analyze if the current transcript is:
              1. SAME CONTEXT (continuation of pending clip):
                 - Same topic/scene/situation as pending clip
                 - Example: Airport lady still freaking out → SAME CONTEXT
                 - Example: Gambling session continues → SAME CONTEXT
                 - Action: Set context_change=false, update pending_clip end_time to #{transcript_end}
              
              2. NEW CONTEXT (different scene):
                 - Different topic/scene/situation from pending clip
                 - Example: Airport scene ends, now talking about gambling → NEW CONTEXT
                 - Example: Freakout ends, now calm conversation → NEW CONTEXT
                 - Action: Set context_change=true, create new pending_clip for the new scene
              
              If SAME CONTEXT: Return {"context_change": false, "pending_clip": {updated clip with new end_time}}
              If NEW CONTEXT: Return {"context_change": true, "pending_clip": {new clip data for the new scene}}
              """
            else
              """
              
              NO PENDING CLIP:
              This is the first detection or previous clip was saved.
              If you detect a clip-worthy moment, create a new pending_clip.
              Set context_change=false (no previous context to change from).
              """
            end
            
            # Format transcript for AI analysis
            audio_info = if audio_context != "", do: "\n\n#{audio_context}\n", else: ""
            
            formatted_transcript = """
            TRANSCRIPT (#{transcript_start}s - #{transcript_end}s):
            #{transcript}#{audio_info}#{pending_clip_context}
            You are a clip detector analyzing livestream content. Find moments that are entertaining, shareable, and worth clipping.

            AUDIO ANALYSIS GUIDANCE:
            - Volume spikes indicate screaming/yelling/excitement - STRONG clip signal
            - Multiple volume spikes in short time = very likely clip-worthy moment
            - Volume spikes + intense/emotional words = high-value clip
            - Use audio context to identify moments the transcript alone might miss
            
            WHAT QUALIFIES AS 85+ SCORE (CLIP-WORTHY):
            
            GAMING STREAMS:
            - Impressive clutch plays or skill moments (1v3+, comeback wins, tournament plays)
            - Rage/tilt moments with strong reactions (screaming, breaking things, tilting hard)
            - Hilarious fails or unexpected glitches that cause big reactions
            - Hype moments (big wins, insane RNG, perfect timing)
            - Drama with teammates or opponents (arguments, trash talk, beef)
            - Funny banter or roasts that land perfectly
            
            IRL STREAMS:
            - Confrontations or arguments (getting kicked out, disputes, drama)
            - Unexpected encounters (celebrities, crazy people, weird situations)
            - Funny or awkward social moments that are highly relatable
            - Wholesome moments with strong emotional payoff
            - Surprising reveals or announcements
            - Chaotic or unpredictable events
            
            ALL STREAMS:
            - Strong emotional reactions (genuine crying, explosive laughter, shock)
            - Drama or controversy (call-outs, hot takes, relationship stuff)
            - Genuinely funny comedy moments (not just chuckles, but actual hilarious content)
            - Meme-worthy or highly quotable moments
            - Moments fans would clip and share in Discord/Twitter
            - Content that makes you go "oh shit" or laugh out loud

            SCORING EXAMPLES (85+ THRESHOLD):
            - Score 95: "Streamer accidentally leaks they're dating another streamer"
            - Score 93: "Insane 1v5 ace clutch in ranked with crowd going wild"
            - Score 90: "Streamer breaks keyboard in rage after losing tournament"
            - Score 88: "IRL streamer gets confronted by security, kicked out"
            - Score 87: "Hilarious fail where streamer falls off chair screaming"
            - Score 86: "Streamer roasts toxic viewer so hard chat explodes"
            - Score 85: "Emotional moment where streamer cries after big donation"
            - Score 85: "Streamer has heated argument with teammate, drama unfolds"

            NOT CLIP-WORTHY (Below 85):
            - Normal conversation with chat (even if interesting)
            - Regular gameplay without standout moments
            - Mild reactions or generic excitement
            - Mundane IRL activities (walking, eating, shopping)
            - Standard wins/losses without special context
            - Filler content between highlights

            IMPORTANT: Score honestly. If it's not genuinely entertaining/shareable, don't force it to 85+.
            The threshold is #{virality_threshold}. Only return clips that meet or exceed this score.

            CRITICAL - NEW RESPONSE FORMAT (DO NOT USE OLD FORMAT):
            You MUST return JSON in this EXACT format:
            {
              "context_change": true/false,
              "pending_clip": {...} or null
            }
            
            DO NOT return {"clips": [...]} - that format is DEPRECATED.
            DO NOT return {"clips": [], "extensions": []} - that format is DEPRECATED.
            
            EXAMPLES:
            
            Example 1 - No clip detected:
            {"context_change": false, "pending_clip": null}
            
            Example 2 - First clip detected (no previous context):
            {
              "context_change": false,
              "pending_clip": {
                "title": "Airport Lady Freakout Begins",
                "description": "Woman starts yelling at airport staff",
                "start_time": #{transcript_start},
                "end_time": #{transcript_end},
                "virality_score": 88,
                "detection_reason": "Dramatic confrontation with volume spikes",
                "context_summary": "Airport freakout scene"
              }
            }
            
            Example 3 - Continuing same scene (extend end_time):
            {
              "context_change": false,
              "pending_clip": {
                "title": "Airport Lady Freakout Escalates",
                "description": "Woman continues yelling, security called",
                "start_time": 800,
                "end_time": #{transcript_end},
                "virality_score": 92,
                "detection_reason": "Escalating confrontation",
                "context_summary": "Airport freakout scene"
              }
            }
            
            Example 4 - NEW scene detected (context changed):
            {
              "context_change": true,
              "pending_clip": {
                "title": "Gambling Hot Streak",
                "description": "Streamer hits big win",
                "start_time": #{transcript_start},
                "end_time": #{transcript_end},
                "virality_score": 85,
                "detection_reason": "Exciting gambling moment",
                "context_summary": "Gambling session"
              }
            }
            
            RULES:
            - start_time and end_time are ABSOLUTE timestamps (seconds from stream start)
            - When extending a scene, keep the original start_time, update end_time to #{transcript_end}
            - Set context_change=true ONLY when the topic/scene completely changes
            - Set context_change=false when continuing the same scene OR when no clip detected
            """

            # Call OpenRouter API using existing generate_clips function
            case OpenRouterAPI.generate_clips(formatted_transcript, system_prompt, user_prompt) do
              {:ok, ai_response, _usage} ->
                # Log the full AI response for debugging
                Logger.info("[ClipsController] Full AI response: #{inspect(ai_response)}")
                
                # Parse AI response - extract the new pending clip data (ignore AI's context_change)
                ai_pending_clip = case ai_response do
                  # New format
                  %{"context_change" => _change, "pending_clip" => clip} ->
                    clip
                  
                  # Old format fallback - convert to new format
                  %{"clips" => clips} when is_list(clips) and length(clips) > 0 ->
                    first_clip = List.first(clips)
                    %{
                      "title" => Map.get(first_clip, "title", "Untitled"),
                      "description" => Map.get(first_clip, "description", ""),
                      "start_time" => get_clip_start_time(first_clip, transcript_start),
                      "end_time" => get_clip_end_time(first_clip, transcript_start, transcript_end),
                      "virality_score" => Map.get(first_clip, "virality_score", 85),
                      "detection_reason" => Map.get(first_clip, "reason", "") || Map.get(first_clip, "detection_reason", ""),
                      "context_summary" => String.slice(Map.get(first_clip, "title", ""), 0, 50)
                    }
                  
                  # No clips detected
                  _ ->
                    nil
                end

                # Server-side context change detection (don't trust AI's flag)
                # Compare existing pending clip with new detection using time overlap + semantic similarity
                # Max clip duration: 180 seconds (3 minutes) - force save if exceeded
                max_clip_duration = 180
                
                {context_change, final_pending_clip} = cond do
                  # No new clip detected by AI
                  is_nil(ai_pending_clip) ->
                    # If we have an existing pending clip and AI found nothing new,
                    # this might mean the context ended - but we need consecutive "nothing" detections
                    # For now, keep the existing pending clip (context continues until something new appears)
                    {false, pending_clip}
                  
                  # No existing pending clip - this is a new detection
                  is_nil(pending_clip) ->
                    Logger.info("[ClipsController] First clip detected: #{ai_pending_clip["title"]}")
                    {false, ai_pending_clip}
                  
                  # Both exist - compare them
                  true ->
                    # Check if pending clip has exceeded max duration
                    pending_duration = Map.get(pending_clip, "end_time", 0) - Map.get(pending_clip, "start_time", 0)
                    
                    if pending_duration >= max_clip_duration do
                      # Clip is too long - force save it and start new one
                      Logger.info("[ClipsController] Pending clip exceeded max duration (#{pending_duration}s >= #{max_clip_duration}s), forcing save")
                      {true, ai_pending_clip}
                    else
                      case should_merge_clips?(pending_clip, ai_pending_clip) do
                        {:merge, reason} ->
                          # Similar enough - merge/extend the pending clip
                          merged = merge_pending_clips(pending_clip, ai_pending_clip)
                          Logger.info("[ClipsController] Merging clips (#{reason}): #{merged["start_time"]}s - #{merged["end_time"]}s")
                          {false, merged}
                        
                        {:different, reason} ->
                          # Truly different context - save existing, start new
                          Logger.info("[ClipsController] Context change (#{reason})! Saving: '#{pending_clip["title"]}' -> Starting: '#{ai_pending_clip["title"]}'")
                          {true, ai_pending_clip}
                      end
                    end
                end

                Logger.info("[ClipsController] Context change: #{context_change}, Pending clip: #{if final_pending_clip, do: "#{final_pending_clip["title"]} (#{final_pending_clip["start_time"]}s - #{final_pending_clip["end_time"]}s)", else: "none"}")

                json(conn, %{
                  success: true,
                  context_change: context_change,
                  pending_clip: final_pending_clip
                })

              {:error, reason} ->
                Logger.error("[ClipsController] AI detection failed: #{inspect(reason)}")

                conn
                |> put_status(500)
                |> json(%{
                  success: false,
                  error: "Detection failed",
                  details: inspect(reason)
                })
            end
        end

      {:error, reason} ->
        Logger.warning("[ClipsController] Authentication failed: #{reason}")

        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})
    end
  end

  # Helper functions for converting old clip format to new pending_clip format
  defp get_clip_start_time(clip, transcript_start) do
    # Old format had relative start_time, convert to absolute
    case Map.get(clip, "segments") do
      [first_segment | _] -> Map.get(first_segment, "start_time", transcript_start)
      _ -> Map.get(clip, "start_time", transcript_start)
    end
  end

  defp get_clip_end_time(clip, transcript_start, transcript_end) do
    # Old format had duration, calculate end_time
    case Map.get(clip, "segments") do
      segments when is_list(segments) and length(segments) > 0 ->
        last_segment = List.last(segments)
        Map.get(last_segment, "end_time", transcript_end)
      _ ->
        start_time = get_clip_start_time(clip, transcript_start)
        duration = Map.get(clip, "total_duration") || Map.get(clip, "duration", 30)
        start_time + duration
    end
  end

  # Calculate time overlap ratio between two clips
  # Returns a value between 0.0 (no overlap) and 1.0 (complete overlap)
  defp calculate_time_overlap(existing_clip, new_clip) do
    existing_start = Map.get(existing_clip, "start_time", 0)
    existing_end = Map.get(existing_clip, "end_time", 0)
    new_start = Map.get(new_clip, "start_time", 0)
    new_end = Map.get(new_clip, "end_time", 0)

    # Calculate overlap
    overlap_start = max(existing_start, new_start)
    overlap_end = min(existing_end, new_end)
    overlap_duration = max(0, overlap_end - overlap_start)

    # Calculate the smaller clip's duration (use smaller to be more lenient)
    existing_duration = max(1, existing_end - existing_start)
    new_duration = max(1, new_end - new_start)
    smaller_duration = min(existing_duration, new_duration)

    # Return overlap as ratio of smaller clip
    overlap_duration / smaller_duration
  end

  # Calculate word-based similarity between two strings
  # Returns a value between 0.0 (no similarity) and 1.0 (identical)
  defp calculate_word_similarity(str1, str2) when is_binary(str1) and is_binary(str2) do
    words1 = str1 |> String.downcase() |> String.split(~r/\s+/, trim: true) |> MapSet.new()
    words2 = str2 |> String.downcase() |> String.split(~r/\s+/, trim: true) |> MapSet.new()

    if MapSet.size(words1) == 0 or MapSet.size(words2) == 0 do
      0.0
    else
      intersection = MapSet.intersection(words1, words2) |> MapSet.size()
      union = MapSet.union(words1, words2) |> MapSet.size()
      intersection / union
    end
  end
  defp calculate_word_similarity(_, _), do: 0.0

  # Determine if two clips should be MERGED (extended) vs saved separately
  # Returns {:merge, reason} if clips should be merged, {:different, reason} if truly different
  defp should_merge_clips?(existing_clip, new_clip) when is_map(existing_clip) and is_map(new_clip) do
    # Check title similarity
    existing_title = Map.get(existing_clip, "title", "") || ""
    new_title = Map.get(new_clip, "title", "") || ""
    title_similarity = calculate_word_similarity(existing_title, new_title)
    
    # Check context summary similarity
    existing_summary = Map.get(existing_clip, "context_summary", "") || ""
    new_summary = Map.get(new_clip, "context_summary", "") || ""
    context_similarity = calculate_word_similarity(existing_summary, new_summary)
    
    # Calculate time overlap
    time_overlap = calculate_time_overlap(existing_clip, new_clip)
    
    Logger.info("[ClipsController] Merge check: time_overlap=#{Float.round(time_overlap, 2)}, context_sim=#{Float.round(context_similarity, 2)}, title_sim=#{Float.round(title_similarity, 2)}")
    
    # MERGE if:
    # 1. Very high title similarity (>70%) - clearly same moment
    # 2. OR moderate title similarity (>30%) WITH significant time overlap (>40%) - related content, extend it
    # 3. OR any title similarity (>20%) WITH very high time overlap (>50%) - clearly same time period
    # 4. OR high context similarity (>50%) WITH any overlap - same broader topic
    cond do
      title_similarity > 0.7 ->
        {:merge, "high title similarity (#{Float.round(title_similarity, 2)})"}
      
      title_similarity > 0.3 and time_overlap > 0.4 ->
        {:merge, "moderate title similarity (#{Float.round(title_similarity, 2)}) with significant overlap (#{Float.round(time_overlap, 2)})"}
      
      title_similarity > 0.2 and time_overlap > 0.5 ->
        {:merge, "some title similarity (#{Float.round(title_similarity, 2)}) with very high overlap (#{Float.round(time_overlap, 2)})"}
      
      context_similarity > 0.5 and time_overlap > 0.1 ->
        {:merge, "context similarity (#{Float.round(context_similarity, 2)}) with overlap"}
      
      true ->
        {:different, "low similarity (title=#{Float.round(title_similarity, 2)}, context=#{Float.round(context_similarity, 2)}, overlap=#{Float.round(time_overlap, 2)})"}
    end
  end
  defp should_merge_clips?(_, _), do: {:different, "invalid clips"}

  # Merge two clips that represent the same context
  # Keeps earliest start_time, latest end_time, and best metadata
  defp merge_pending_clips(existing_clip, new_clip) do
    existing_start = Map.get(existing_clip, "start_time", 0)
    existing_end = Map.get(existing_clip, "end_time", 0)
    new_start = Map.get(new_clip, "start_time", 0)
    new_end = Map.get(new_clip, "end_time", 0)
    
    existing_score = Map.get(existing_clip, "virality_score", 0)
    new_score = Map.get(new_clip, "virality_score", 0)
    
    # Use metadata from whichever has higher virality score
    base_clip = if new_score > existing_score, do: new_clip, else: existing_clip
    
    %{
      "title" => Map.get(base_clip, "title"),
      "description" => Map.get(base_clip, "description"),
      "start_time" => min(existing_start, new_start),
      "end_time" => max(existing_end, new_end),
      "virality_score" => max(existing_score, new_score),
      "detection_reason" => Map.get(base_clip, "detection_reason"),
      "context_summary" => Map.get(base_clip, "context_summary")
    }
  end

  # Check if AI clip detection is allowed for a user
  # Returns :ok if allowed, or {:error, message} if blocked
  defp check_ai_allowed(user_id) do
    alias ClippsterServer.Accounts
    alias ClippsterServer.Organizations

    case Accounts.get_user(user_id) do
      nil ->
        {:error, "User not found"}

      user ->
        # Check if user was created by an organization
        case user.created_by_organization_id do
          nil ->
            # User was not created by an org, AI is allowed
            :ok

          org_id ->
            # User was created by an org, check org settings
            case Organizations.get_organization(org_id) do
              nil ->
                # Org doesn't exist anymore, allow AI
                :ok

              organization ->
                # Check if allow_ai is explicitly set to false
                settings = organization.settings || %{}
                allow_ai = Map.get(settings, "allow_ai", true)

                if allow_ai == false do
                  {:error, "AI clip detection has been disabled by your organization"}
                else
                  :ok
                end
            end
        end
    end
  end
end
