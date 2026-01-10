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
    "google/gemini-3-flash-preview",
    "z-ai/glm-4.7"
  ]

  @decider_model "google/gemini-3-pro-preview"

  @doc """
  Process a single chunk using multimodal detection.
  
  Runs 3 models in parallel, then uses a decider to synthesize results.
  Returns {:ok, clips, total_usage} or {:error, reason}.
  """
  def process_chunk_multimodal(chunk_transcript, system_prompt, user_prompt, project_id, chunk_index, total_chunks) do
    Logger.info("[MultimodalClipDetection] Processing chunk #{chunk_index + 1}/#{total_chunks} with #{length(@detection_models)} models")
    
    ProgressChannel.broadcast_progress(
      project_id, 
      "analyzing", 
      0, 
      "Chunk #{chunk_index + 1}/#{total_chunks}: Running #{length(@detection_models)} AI models in parallel..."
    )

    # Step 1: Run all detection models in parallel
    model_results = run_detection_models_parallel(chunk_transcript, system_prompt, user_prompt, project_id)
    
    # Count successful results
    successful_results = Enum.filter(model_results, fn
      {:ok, _, _, _} -> true
      _ -> false
    end)
    
    failed_count = length(@detection_models) - length(successful_results)
    
    if failed_count > 0 do
      Logger.warning("[MultimodalClipDetection] #{failed_count} model(s) failed for chunk #{chunk_index + 1}")
    end
    
    # Need at least 1 successful result to proceed
    if length(successful_results) == 0 do
      Logger.error("[MultimodalClipDetection] All models failed for chunk #{chunk_index + 1}")
      {:error, "All detection models failed"}
    else
      # Extract clips and usage from successful results
      model_clips_with_metadata = Enum.map(successful_results, fn {:ok, model, clips, usage} ->
        %{
          model: model,
          clips: clips,
          usage: usage
        }
      end)
      
      # Calculate total usage from detection models
      detection_usage = Enum.reduce(model_clips_with_metadata, 0, fn result, acc ->
        acc + Map.get(result.usage, "total_tokens", 0)
      end)
      
      ProgressChannel.broadcast_progress(
        project_id, 
        "analyzing", 
        0, 
        "Chunk #{chunk_index + 1}/#{total_chunks}: Synthesizing results from #{length(successful_results)} models..."
      )
      
      # Build per-model usage details for logging
      per_model_usage = Enum.map(model_clips_with_metadata, fn result ->
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
          
          Logger.info("[MultimodalClipDetection] Chunk #{chunk_index + 1} complete: #{length(final_clips)} clips, #{total_usage} tokens")
          
          {:ok, final_clips, %{
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
          Logger.error("[MultimodalClipDetection] Decider failed for chunk #{chunk_index + 1}: #{inspect(reason)}")
          
          # Fallback: use clips from the model with highest average virality score
          fallback_clips = select_best_model_clips(model_clips_with_metadata)
          
          {:ok, fallback_clips, %{
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
        
        case OpenRouterAPI.generate_clips_with_model(chunk_transcript, system_prompt, user_prompt, model, project_id) do
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
      timeout: 180_000,  # 3 minutes per model
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
    
    # Build the decider prompt with all model results
    decider_prompt = build_decider_prompt(model_clips_with_metadata, chunk_transcript)
    
    case OpenRouterAPI.decide_final_clips(decider_prompt, @decider_model, project_id) do
      {:ok, final_clips, usage} ->
        {:ok, final_clips, usage}
        
      {:error, reason} ->
        {:error, reason}
    end
  end

  # Build the prompt for the decider model.
  defp build_decider_prompt(model_clips_with_metadata, chunk_transcript) do
    # Format each model's results
    model_results_text = model_clips_with_metadata
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

    # Get transcript text for context
    transcript_text = case chunk_transcript do
      %{"text" => text} -> String.slice(text, 0, 2000)
      _ -> "[Transcript not available]"
    end

    """
    You are an expert video clip curator. Multiple AI models have analyzed the same transcript segment and identified potential viral clips. Your job is to synthesize their results into a single, optimal clip list.

    ## Transcript Context (truncated):
    #{transcript_text}

    ## Model Results:
    #{model_results_text}

    ## Your Task:
    Analyze the clips identified by each model and create a final, optimized clip list following these rules:

    1. **Consensus Clips**: Clips identified by 2+ models are likely high-quality. Include these with the best version (most accurate timestamps, best title, highest virality score).

    2. **Unique Valuable Clips**: Some models may find clips others missed. Include unique clips if they have:
       - Virality score >= 70
       - Clear reasoning for why it's engaging
       - Proper timestamp boundaries

    3. **Conflict Resolution**: When models disagree on timestamps for the same moment:
       - Prefer tighter, more focused clips (30-90 seconds ideal)
       - Choose timestamps that capture complete thoughts/sentences
       - Avoid cutting mid-sentence

    4. **Deduplication**: Remove overlapping clips that cover the same content. Keep the better version.

    5. **Quality Standards**: Each final clip must have:
       - Unique id (use format: "multimodal_clip_N")
       - Compelling title
       - Accurate start_time and end_time
       - virality_score (0-100)
       - reason explaining viral potential
       - socialMediaPost with caption and hashtags
       - combined_transcript
       - segments array with proper structure

    Return ONLY a valid JSON object with this structure:
    ```json
    {
      "clips": [
        {
          "id": "multimodal_clip_1",
          "title": "...",
          "filename": "...",
          "type": "continuous",
          "segments": [{"start_time": 0, "end_time": 60, "duration": 60, "transcript": "..."}],
          "total_duration": 60,
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

  # Fallback: Select clips from the model with the highest average virality score.
  defp select_best_model_clips(model_clips_with_metadata) do
    model_clips_with_metadata
    |> Enum.map(fn result ->
      avg_score = case result.clips do
        [] -> 0
        clips ->
          total = Enum.reduce(clips, 0, fn clip, acc ->
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
