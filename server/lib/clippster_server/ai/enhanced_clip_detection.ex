defmodule ClippsterServer.AI.EnhancedClipDetection do
  @moduledoc """
  VOD Enhanced clip detection: single-pass multimodal analysis per chunk
  (transcript + video with embedded audio) via OpenRouter.
  """

  alias ClippsterServer.AI.OpenRouterAPI

  require Logger

  @doc """
  Process one VOD chunk with video + transcript in a single AI pass.
  Returns `{:ok, clips, usage}` or `{:error, reason}`.
  """
  def process_chunk_enhanced(
        chunk_transcript,
        video_base64,
        system_prompt,
        user_prompt,
        project_id,
        chunk_index,
        total_chunks,
        chunk_start_time,
        chunk_end_time
      ) do
    Logger.info(
      "[EnhancedClipDetection] Chunk #{chunk_index + 1}/#{total_chunks} (#{Float.round(chunk_start_time, 1)}s-#{Float.round(chunk_end_time, 1)}s)"
    )

    OpenRouterAPI.generate_clips_enhanced(
      chunk_transcript,
      video_base64,
      system_prompt,
      user_prompt,
      project_id,
      chunk_start_time,
      chunk_end_time
    )
  end
end
