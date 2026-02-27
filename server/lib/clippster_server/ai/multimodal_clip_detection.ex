defmodule ClippsterServer.AI.MultimodalClipDetection do
  @moduledoc """
  Multimodal clip detection module that orchestrates parallel AI model processing.

  In multimodal mode, each chunk is processed by 3 different AI models in parallel,
  then a 4th "decider" model synthesizes the results into a final clip list.

  Models used:
  - Claude Haiku 3.5 (Anthropic)
  - Gemini 3 Flash Preview (Google)
  - GPT-4o-mini (OpenAI)

  Decider: Gemini 3 Pro Preview (for reasoning)
  """

  alias ClippsterServer.AI.OpenRouterAPI
  alias ClippsterServerWeb.ProgressChannel

  require Logger

  @detection_models [
    "anthropic/claude-haiku-4.5",
    "google/gemini-3-pro-preview",
    "z-ai/glm-4.7",
    "x-ai/grok-4.1-fast"
  ]

  @decider_model "x-ai/grok-4.1-fast"

  @doc """
  Process a single chunk using multimodal detection.

  Runs 3 models in parallel, then uses a decider to synthesize results.
  Returns {:ok, clips, total_usage} or {:error, reason}.
  """
  def process_chunk_multimodal(
        chunk_transcript,
        system_prompt,
        user_prompt,
        project_id,
        chunk_index,
        total_chunks
      ) do
    Logger.info(
      "[MultimodalClipDetection] Processing chunk #{chunk_index + 1}/#{total_chunks} with #{length(@detection_models)} models"
    )

    ProgressChannel.broadcast_progress(
      project_id,
      "analyzing",
      0,
      "Chunk #{chunk_index + 1}/#{total_chunks}: Running #{length(@detection_models)} AI models in parallel..."
    )

    # Step 1: Run all detection models in parallel
    model_results =
      run_detection_models_parallel(chunk_transcript, system_prompt, user_prompt, project_id)

    # Count successful results
    successful_results =
      Enum.filter(model_results, fn
        {:ok, _, _, _} -> true
        _ -> false
      end)

    failed_count = length(@detection_models) - length(successful_results)

    if failed_count > 0 do
      Logger.warning(
        "[MultimodalClipDetection] #{failed_count} model(s) failed for chunk #{chunk_index + 1}"
      )
    end

    # Need at least 1 successful result to proceed
    if length(successful_results) == 0 do
      Logger.error("[MultimodalClipDetection] All models failed for chunk #{chunk_index + 1}")
      {:error, "All detection models failed"}
    else
      # Extract clips and usage from successful results
      model_clips_with_metadata =
        Enum.map(successful_results, fn {:ok, model, clips, usage} ->
          %{
            model: model,
            clips: clips,
            usage: usage
          }
        end)

      # Calculate total usage from detection models
      detection_usage =
        Enum.reduce(model_clips_with_metadata, 0, fn result, acc ->
          acc + Map.get(result.usage, "total_tokens", 0)
        end)

      ProgressChannel.broadcast_progress(
        project_id,
        "analyzing",
        0,
        "Chunk #{chunk_index + 1}/#{total_chunks}: Synthesizing results from #{length(successful_results)} models..."
      )

      # Build per-model usage details for logging
      per_model_usage =
        Enum.map(model_clips_with_metadata, fn result ->
          %{
            "model" => result.model,
            "input_tokens" => Map.get(result.usage, "prompt_tokens", 0),
            "output_tokens" => Map.get(result.usage, "completion_tokens", 0),
            "total_tokens" => Map.get(result.usage, "total_tokens", 0),
            "clips_found" => length(result.clips)
          }
        end)

      # Step 2: Run decider to synthesize results
      case run_decider(model_clips_with_metadata, chunk_transcript, project_id) do
        {:ok, final_clips, decider_usage} ->
          total_usage = detection_usage + Map.get(decider_usage, "total_tokens", 0)

          Logger.info(
            "[MultimodalClipDetection] Chunk #{chunk_index + 1} complete: #{length(final_clips)} clips, #{total_usage} tokens"
          )

          {:ok, final_clips,
           %{
             "total_tokens" => total_usage,
             "detection_tokens" => detection_usage,
             "decider_tokens" => Map.get(decider_usage, "total_tokens", 0),
             "models_used" => length(successful_results),
             "models_failed" => failed_count,
             "per_model_usage" => per_model_usage,
             "decider_model" => @decider_model,
             "decider_input_tokens" => Map.get(decider_usage, "prompt_tokens", 0),
             "decider_output_tokens" => Map.get(decider_usage, "completion_tokens", 0)
           }}

        {:error, reason} ->
          Logger.error(
            "[MultimodalClipDetection] Decider failed for chunk #{chunk_index + 1}: #{inspect(reason)}"
          )

          # Fallback: use clips from the model with highest average virality score
          fallback_clips = select_best_model_clips(model_clips_with_metadata)

          {:ok, fallback_clips,
           %{
             "total_tokens" => detection_usage,
             "detection_tokens" => detection_usage,
             "decider_tokens" => 0,
             "models_used" => length(successful_results),
             "models_failed" => failed_count,
             "used_fallback" => true,
             "per_model_usage" => per_model_usage
           }}
      end
    end
  end

  # Run all detection models in parallel using Task.async_stream.
  # Returns a list of results: {:ok, model, clips, usage} or {:error, model, reason}
  defp run_detection_models_parallel(chunk_transcript, system_prompt, user_prompt, project_id) do
    @detection_models
    |> Task.async_stream(
      fn model ->
        Logger.info("[MultimodalClipDetection] Starting model: #{model}")

        case OpenRouterAPI.generate_clips_with_model(
               chunk_transcript,
               system_prompt,
               user_prompt,
               model,
               project_id
             ) do
          {:ok, ai_response, usage} ->
            clips = Map.get(ai_response, "clips", [])
            Logger.info("[MultimodalClipDetection] Model #{model} found #{length(clips)} clips")
            {:ok, model, clips, usage}

          {:error, reason} ->
            Logger.warning("[MultimodalClipDetection] Model #{model} failed: #{inspect(reason)}")
            {:error, model, reason}
        end
      end,
      max_concurrency: 3,
      # 3 minutes per model
      timeout: 180_000,
      on_timeout: :kill_task
    )
    |> Enum.map(fn
      {:ok, result} -> result
      {:exit, :timeout} -> {:error, "unknown", "timeout"}
      {:exit, reason} -> {:error, "unknown", reason}
    end)
  end

  # Run the decider model to synthesize results from multiple detection models.
  defp run_decider(model_clips_with_metadata, chunk_transcript, project_id) do
    Logger.info("[MultimodalClipDetection] Running decider model: #{@decider_model}")

    # Identify consensus clips before building the prompt
    consensus_analysis = identify_consensus_clips(model_clips_with_metadata)

    # Log consensus findings
    Logger.info(
      "[MultimodalClipDetection] Consensus analysis: #{length(consensus_analysis.unanimous)} unanimous, #{length(consensus_analysis.consensus)} consensus clips"
    )

    # Build the decider prompt with all model results and consensus analysis
    decider_prompt =
      build_decider_prompt(model_clips_with_metadata, chunk_transcript, consensus_analysis)

    case OpenRouterAPI.decide_final_clips(decider_prompt, @decider_model, project_id) do
      {:ok, final_clips, usage} ->
        # Validate that unanimous clips are included
        validated_clips = validate_unanimous_clips(final_clips, consensus_analysis.unanimous)
        {:ok, validated_clips, usage}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Identify consensus clips across multiple models.
  # Returns a map with:
  # - unanimous: clips found by ALL models
  # - consensus: clips found by 2+ models (but not all)
  # - unique: clips found by only 1 model
  defp identify_consensus_clips(model_clips_with_metadata) do
    total_models = length(model_clips_with_metadata)

    # Flatten all clips with their source model
    all_clips_with_source =
      model_clips_with_metadata
      |> Enum.flat_map(fn result ->
        Enum.map(result.clips, fn clip ->
          {clip, result.model}
        end)
      end)

    # Group clips by overlap (clips with >50% timestamp overlap are considered the same)
    clip_groups = group_overlapping_clips(all_clips_with_source)

    # Categorize groups by how many models found them
    unanimous =
      clip_groups
      |> Enum.filter(fn group -> length(group.models) == total_models end)
      |> Enum.map(fn group -> select_best_clip_version(group.clips) end)

    consensus =
      clip_groups
      |> Enum.filter(fn group ->
        length(group.models) >= 2 and length(group.models) < total_models
      end)
      |> Enum.map(fn group ->
        %{
          clip: select_best_clip_version(group.clips),
          model_count: length(group.models),
          models: group.models
        }
      end)

    unique =
      clip_groups
      |> Enum.filter(fn group -> length(group.models) == 1 end)
      |> Enum.map(fn group -> select_best_clip_version(group.clips) end)

    %{
      unanimous: unanimous,
      consensus: consensus,
      unique: unique,
      total_models: total_models
    }
  end

  # Group clips that overlap by >50% in time
  defp group_overlapping_clips(clips_with_source) do
    # Start with each clip as its own group
    initial_groups =
      Enum.map(clips_with_source, fn {clip, model} ->
        %{
          clips: [clip],
          models: [model]
        }
      end)

    # Merge overlapping groups
    merge_overlapping_groups(initial_groups)
  end

  # Recursively merge groups that contain overlapping clips
  defp merge_overlapping_groups(groups) do
    case find_overlapping_pair(groups) do
      nil ->
        # No more overlaps, return final groups
        groups

      {idx1, idx2} ->
        # Merge the two overlapping groups
        group1 = Enum.at(groups, idx1)
        group2 = Enum.at(groups, idx2)

        merged = %{
          clips: group1.clips ++ group2.clips,
          models: Enum.uniq(group1.models ++ group2.models)
        }

        # Remove old groups and add merged group, then recurse
        new_groups =
          groups
          |> Enum.with_index()
          |> Enum.reject(fn {_g, i} -> i == idx1 or i == idx2 end)
          |> Enum.map(fn {g, _i} -> g end)
          |> Kernel.++([merged])

        merge_overlapping_groups(new_groups)
    end
  end

  # Find a pair of groups that have overlapping clips
  defp find_overlapping_pair(groups) do
    groups
    |> Enum.with_index()
    |> Enum.find_value(fn {group1, idx1} ->
      groups
      |> Enum.with_index()
      |> Enum.find_value(fn {group2, idx2} ->
        if idx2 > idx1 and groups_overlap?(group1, group2) do
          {idx1, idx2}
        else
          nil
        end
      end)
    end)
  end

  # Check if any clips in group1 overlap with any clips in group2
  defp groups_overlap?(group1, group2) do
    Enum.any?(group1.clips, fn clip1 ->
      Enum.any?(group2.clips, fn clip2 ->
        clips_overlap?(clip1, clip2)
      end)
    end)
  end

  # Check if two clips overlap by >50% of the shorter clip's duration
  defp clips_overlap?(clip1, clip2) do
    start1 = get_clip_start_time(clip1)
    end1 = get_clip_end_time(clip1)
    start2 = get_clip_start_time(clip2)
    end2 = get_clip_end_time(clip2)

    # Calculate overlap
    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)
    overlap_duration = max(0, overlap_end - overlap_start)

    # Calculate shorter clip duration
    duration1 = end1 - start1
    duration2 = end2 - start2
    shorter_duration = min(duration1, duration2)

    # Overlap is >50% of shorter clip
    shorter_duration > 0 and overlap_duration / shorter_duration > 0.5
  end

  # Extract start time from a clip (handles both single segment and multi-segment clips)
  defp get_clip_start_time(clip) do
    case clip do
      %{"segments" => [first | _]} -> Map.get(first, "start_time", 0)
      _ -> 0
    end
  end

  # Extract end time from a clip
  defp get_clip_end_time(clip) do
    case clip do
      %{"segments" => segments} when is_list(segments) and length(segments) > 0 ->
        last_segment = List.last(segments)
        Map.get(last_segment, "end_time", 0)

      _ ->
        0
    end
  end

  # Select the best version of a clip from multiple versions (highest virality score)
  defp select_best_clip_version(clips) do
    clips
    |> Enum.max_by(fn clip -> Map.get(clip, "virality_score", 0) end, fn -> List.first(clips) end)
  end

  # Build the consensus analysis section for the decider prompt
  defp build_consensus_section(consensus_analysis) do
    unanimous_count = length(consensus_analysis.unanimous)
    consensus_count = length(consensus_analysis.consensus)
    unique_count = length(consensus_analysis.unique)

    unanimous_text =
      if unanimous_count > 0 do
        clips_json = Jason.encode!(consensus_analysis.unanimous, pretty: true)

        """
        ### Unanimous Clips (Found by ALL #{consensus_analysis.total_models} models) - MANDATORY
        These #{unanimous_count} clip(s) MUST be included in your final output:
        ```json
        #{clips_json}
        ```
        """
      else
        "### Unanimous Clips: None (no clips found by all models)\n"
      end

    consensus_text =
      if consensus_count > 0 do
        consensus_info =
          Enum.map(consensus_analysis.consensus, fn item ->
            """
            - #{Map.get(item.clip, "title", "Untitled")} (#{item.model_count}/#{consensus_analysis.total_models} models: #{Enum.join(item.models, ", ")})
              Time: #{get_clip_start_time(item.clip)}s - #{get_clip_end_time(item.clip)}s
              Virality: #{Map.get(item.clip, "virality_score", 0)}/100
            """
          end)
          |> Enum.join("\n")

        """
        ### Consensus Clips (Found by 2+ models) - HIGH PRIORITY
        These #{consensus_count} clip(s) should be strongly considered:
        #{consensus_info}
        """
      else
        "### Consensus Clips: None\n"
      end

    unique_text = "### Unique Clips (Found by only 1 model): #{unique_count} clip(s)\n"

    """
    ## Consensus Analysis (Pre-computed)

    #{unanimous_text}
    #{consensus_text}
    #{unique_text}
    """
  end

  # Build the prompt for the decider model.
  defp build_decider_prompt(model_clips_with_metadata, chunk_transcript, consensus_analysis) do
    # Format consensus analysis section
    consensus_section = build_consensus_section(consensus_analysis)

    # Format each model's results
    model_results_text =
      model_clips_with_metadata
      |> Enum.with_index(1)
      |> Enum.map(fn {result, index} ->
        clips_json = Jason.encode!(result.clips, pretty: true)

        """
        ## Model #{index}: #{result.model}
        Found #{length(result.clips)} clips:
        ```json
        #{clips_json}
        ```
        """
      end)
      |> Enum.join("\n\n")

    # Get FULL transcript text for context - no truncation to ensure complete context for clip boundary decisions
    # The decider needs full context to make accurate decisions about clip boundaries
    transcript_text =
      case chunk_transcript do
        # Pass full transcript, no truncation
        %{"text" => text} -> text
        _ -> "[Transcript not available]"
      end

    """
    You are an expert video clip curator. Multiple AI models have analyzed the same transcript segment and identified potential viral clips. Your job is to synthesize their results into a single, optimal clip list.

    ## Transcript Context:
    #{transcript_text}

    #{consensus_section}

    ## Model Results:
    #{model_results_text}

    ## Your Task:
    Analyze the clips identified by each model and create a final, optimized clip list following these rules:

    1. **MANDATORY UNANIMOUS CLIPS**: Clips found by ALL #{consensus_analysis.total_models} models MUST be included in your final output. These represent the highest-confidence detections. You may refine timestamps or improve the title/description, but you MUST NOT skip them.

    2. **Consensus Clips (2+ models)**: Clips identified by multiple models are likely high-quality. Include these with the best version (most accurate timestamps, best title, highest virality score).

    3. **Unique Valuable Clips**: Some models may find clips others missed. Include unique clips if they have:
       - Virality score >= 60
       - Clear reasoning for why it's engaging
       - Proper timestamp boundaries

    4. **Conflict Resolution - PREFER LONGER CLIPS**: When models disagree on timestamps for the same moment:
       - **PREFER the LONGEST version** that captures full context (use the UNION of timestamps, not intersection)
       - It is better to include extra context than to cut off important setup or punchlines
       - Target duration range: 30 seconds to 180 seconds (longer is fine for storytelling)
       - Choose timestamps that capture complete thoughts/sentences with proper setup
       - Avoid cutting mid-sentence or mid-thought
       - Include the "breathing room" - don't end clips abruptly

    5. **Deduplication**: Remove overlapping clips that cover the same content. Keep the LONGER, more complete version.

    6. **Duration Guidance**:
       - Acceptable range: 10 seconds to 180 seconds
       - Short punchy clips (10-30s) are good for memes/reactions
       - Medium clips (30-90s) are good for highlights
       - Long clips (90-180s) are good for storytelling and full context
       - When in doubt, GO LONGER to capture full context

    7. **Quality Standards**: Each final clip must have:
       - Unique id (use format: "multimodal_clip_N")
       - Compelling title
       - Accurate start_time and end_time
       - virality_score (0-100)
       - reason explaining viral potential
       - socialMediaPost with caption and hashtags
       - combined_transcript
       - segments array with proper structure

    **CRITICAL**: Do NOT default to short clips. If models found a 2-3 minute clip, that's likely because the full context is needed. Preserve it.

    Return ONLY a valid JSON object with this structure:
    ```json
    {
      "clips": [
        {
          "id": "multimodal_clip_1",
          "title": "...",
          "filename": "...",
          "type": "continuous",
          "segments": [{"start_time": 0, "end_time": 120, "duration": 120, "transcript": "..."}],
          "total_duration": 120,
          "combined_transcript": "...",
          "virality_score": 85,
          "reason": "...",
          "socialMediaPost": "..."
        }
      ],
      "synthesis_notes": "Brief explanation of how you combined the results"
    }
    ```
    """
  end

  # Validate that all unanimous clips are included in the final output.
  # If any are missing, add them back.
  defp validate_unanimous_clips(final_clips, unanimous_clips) do
    if length(unanimous_clips) == 0 do
      # No unanimous clips to validate
      final_clips
    else
      # Check each unanimous clip to see if it's represented in final output
      missing_clips =
        Enum.filter(unanimous_clips, fn unanimous_clip ->
          not clip_exists_in_final?(unanimous_clip, final_clips)
        end)

      if length(missing_clips) > 0 do
        Logger.warning(
          "[MultimodalClipDetection] Decider skipped #{length(missing_clips)} unanimous clip(s). Adding them back."
        )

        # Add missing clips with unique IDs
        next_id = length(final_clips) + 1

        restored_clips =
          missing_clips
          |> Enum.with_index(next_id)
          |> Enum.map(fn {clip, idx} ->
            # Update the clip ID to avoid conflicts
            Map.put(clip, "id", "multimodal_clip_#{idx}_restored")
          end)

        final_clips ++ restored_clips
      else
        Logger.info("[MultimodalClipDetection] All unanimous clips validated successfully.")
        final_clips
      end
    end
  end

  # Check if a clip exists in the final output (by timestamp overlap)
  defp clip_exists_in_final?(clip, final_clips) do
    Enum.any?(final_clips, fn final_clip ->
      clips_overlap?(clip, final_clip)
    end)
  end

  # Fallback: Select clips from the model with the highest average virality score.
  defp select_best_model_clips(model_clips_with_metadata) do
    model_clips_with_metadata
    |> Enum.map(fn result ->
      avg_score =
        case result.clips do
          [] ->
            0

          clips ->
            total =
              Enum.reduce(clips, 0, fn clip, acc ->
                acc + (Map.get(clip, "virality_score", 0) || 0)
              end)

            total / length(clips)
        end

      {result.clips, avg_score}
    end)
    |> Enum.max_by(fn {_clips, score} -> score end, fn -> {[], 0} end)
    |> elem(0)
  end

  @doc """
  Get the list of detection models used.
  """
  def get_detection_models, do: @detection_models

  @doc """
  Get the decider model used.
  """
  def get_decider_model, do: @decider_model
end
