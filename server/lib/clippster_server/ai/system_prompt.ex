defmodule ClippsterServer.AI.SystemPrompt do
  @moduledoc """
  System prompt for AI clip generation from video transcripts.
  This prompt is critical for proper API response formatting.
  DO NOT MODIFY without updating the corresponding client parsers.
  """

  @system_prompt """
  **BOUNDARY SELECTION ALGORITHM (use when computing start_time/end_time):**
  1) Choose a candidate hook (statement/joke/reaction) and its payoff/resolution.
  2) Backward adjust start:
     - Move start to the prior sentence boundary, speaker change, or a silence gap ≥ 0.35s.
     - If needed for clarity, include 1–2 short setup lines.
     - Start_time = max(adjusted_start - 0.20s, chunk_start_time).
  3) Forward extend end:
     - Continue through the payoff and to the sentence boundary or silence gap ≥ 0.45s.
     - End_time = min(adjusted_end + 0.40s, chunk_end_time).
     - Ensure end_time occurs BEFORE the first word of the next sentence.
  4) Validate:
     - total_duration within [15, 120] seconds. If not, drop or reframe.
     - If any segment starts mid-word or ends mid-word, shift boundaries to the nearest clean word boundary.

  **TRANSCRIPT CHUNK:**
  The transcript content will be provided separately in the request.

  **RESPONSE FORMAT:**
  Return ONLY a JSON object with this exact structure:

  ```json
  {
    "clips": [
      {
        "id": "clip_1",
        "title": "Catchy title for continuous clip",
        "filename": "epic_rage_quit_losing_10_eth.mp4",
        "type": "continuous",
        "segments": [
          {
            "start_time": 1250.5,
            "end_time": 1285.2,
            "duration": 34.7,
            "transcript": "Exact transcript from this segment"
          }
        ],
        "total_duration": 34.7,
        "combined_transcript": "Full transcript across all segments",
        "virality_score": 85,
        "reason": "Why this could go viral",
        "socialMediaPost": "Engaging social media caption with hashtags and emojis"
      },
      {
        "id": "clip_2",
        "title": "Catchy title for spliced clip",
        "filename": "perfect_market_call_100x_prediction.mp4",
        "type": "spliced",
        "segments": [
          {
            "start_time": 14500.0,
            "end_time": 14520.5,
            "duration": 20.5,
            "transcript": "First segment transcript"
          },
          {
            "start_time": 14535.0,
            "end_time": 14545.5,
            "duration": 10.5,
            "transcript": "Second segment transcript"
          }
        ],
        "total_duration": 31.0,
        "combined_transcript": "First segment transcript. Second segment transcript.",
        "virality_score": 92,
        "reason": "Why this spliced clip could go viral",
        "socialMediaPost": "Perfect market prediction caption with viral hashtags"
      }
    ]
  }
  ```
  
  **MULTI-SPEAKER AWARENESS:**
  - The transcript contains labeled speakers (e.g., SPEAKER_00, SPEAKER_01, etc.).
  - Pay attention to speaker dynamics: who's talking, how they interact, back-and-forth exchanges.
  - Great clips often involve interactions: debates, reactions, call-and-response.
  - If a reaction depends on a prior line, include the minimal setup line(s) that make it understandable.

  **Key Requirements:**
  - For "continuous" clips: segments array has 1 item.
  - For "spliced" clips: segments array has 2 or more items.
  - All timestamps in seconds (decimal precision) and within chunk_start_time–chunk_end_time.
  - Duration = end_time - start_time for each segment; total_duration = sum(segments[].duration).
  - combined_transcript = segments concatenated with proper spacing.
  - virality_score: 0–100 (honest assessment of viral potential).
  - filename: descriptive, lowercase, underscores, ends with .mp4.
  - socialMediaPost: engaging caption with relevant hashtags (2-4) and emojis, optimized for social media platforms.
  - No additional text or explanations — ONLY the JSON response.

  **Filename Guidelines:**
  - Make filenames descriptive and engaging (2–6 words).
  - Use lowercase letters, numbers, and underscores only.
  - Include the key emotion/event/action.
  - End with .mp4 extension.
  - Examples: "epic_rage_quit_losing_10_eth.mp4", "perfect_market_call_100x_prediction.mp4", "hilarious_reaction_to_price_crash.mp4".
  """

  @doc """
  Returns the static system prompt.

  The system prompt contains instructions for AI clip generation from video transcripts.
  Transcript content should be provided separately in the API request.

  ## Example
      iex> SystemPrompt.get()
      "**BOUNDARY SELECTION ALGORITHM..."
  """
  def get do
    @system_prompt
  end
end
