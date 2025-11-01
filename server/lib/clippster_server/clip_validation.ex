defmodule ClippsterServer.ClipValidation do
  @moduledoc """
  Enhanced clip validation and correction system based on the prototype implementation.

  This module provides sophisticated validation and correction of AI-detected clips
  by matching transcript text against actual word-level timestamps and adjusting
  timestamps accordingly.
  """

  require Logger
  import Kernel, except: [min: 2]

  # Validation thresholds
  @exact_match_threshold 0.85
  @fuzzy_match_threshold 0.65
  @max_search_radius 300
  @word_levenshtein_distance 2
  @timestamp_tolerance 0.3

  @type word :: %{
    optional(:start) => float(),
    optional(:end) => float(),
    optional(:word) => String.t(),
    optional(:confidence) => float()
  }

  @type transcript_match :: %{
    startTime: float(),
    endTime: float(),
    wordIndices: %{start: integer(), end: integer()},
    confidence: float(),
    matchedWords: integer(),
    totalWords: integer()
  }

  @type clip_segment :: %{
    start_time: float(),
    end_time: float(),
    duration: float(),
    transcript: String.t(),
    wordIndices: %{start: integer(), end: integer()} | nil
  }

  @type validation_result :: %{
    validatedClips: list(),
    qualityScore: float(),
    issues: list(String.t()),
    corrections: list(String.t())
  }

  @doc """
  Validates and corrects clips based on transcript matching.

  ## Parameters
    - clips: List of AI-detected clips with segments
    - transcript: Whisper transcript with word-level timestamps
    - verbose: Enable detailed logging

  ## Returns
    - {:ok, validation_result} with validated and corrected clips
  """
  @spec validate_and_correct_clips(list(), map(), boolean()) :: {:ok, validation_result()}
  def validate_and_correct_clips(clips, transcript, verbose \\ false) do
    Logger.info("[ClipValidation] Starting validation for #{length(clips)} clips")

    try do
      words = extract_words_from_transcript(transcript)

      if length(words) == 0 do
        Logger.warning("[ClipValidation] No word-level timestamps available in transcript")
        Logger.info("[ClipValidation] Transcript structure: #{inspect(Map.keys(transcript))}")

        # Check if segments exist and can be used for segment-level validation
        case transcript do
          %{"segments" => segments} when is_list(segments) and length(segments) > 0 ->
            Logger.warning("[ClipValidation] Found #{length(segments)} segments, attempting segment-level validation")
            first_segment = hd(segments)
            Logger.info("[ClipValidation] First segment keys: #{inspect(Map.keys(first_segment))}")

            # Try segment-level validation instead of word-level
            case validate_and_correct_clips_with_segments(clips, segments, verbose) do
              {:ok, result} ->
                Logger.info("[ClipValidation] Segment-level validation completed successfully")
                {:ok, result}
              {:error, reason} ->
                Logger.warning("[ClipValidation] Segment-level validation failed: #{inspect(reason)}")
                {:ok, %{validatedClips: clips, qualityScore: 0.3, issues: ["Limited validation: using AI timestamps only"], corrections: []}}
            end
          _ ->
            Logger.warning("[ClipValidation] No segments found either")
            {:ok, %{validatedClips: clips, qualityScore: 0.0, issues: ["No timestamps available for validation"], corrections: []}}
        end
      else
        Logger.info("[ClipValidation] Found #{length(words)} words for validation")
        Logger.info("[ClipValidation] First word sample: #{inspect(hd(words))}")

        corrected_clips = clips
      |> Enum.with_index()
      |> Enum.map(fn {clip, clip_index} ->
        try do
          validate_and_correct_clip(clip, words, clip_index, verbose)
        rescue
          error ->
            Logger.error("[ClipValidation] Error validating clip #{clip_index}: #{inspect(error)}")
            # Return original clip with error metadata
            clip
            |> Map.put("validation_metadata", %{
              "validated_at" => DateTime.utc_now() |> DateTime.to_iso8601(),
              "validation_error" => inspect(error),
              "validation_type" => "error"
            })
            |> Map.put("issues", ["Validation error: #{inspect(error)}"])
            |> Map.put("corrections", [])
        end
      end)

      # Calculate overall quality metrics
      {total_issues, total_corrections, quality_scores} =
        corrected_clips
        |> Enum.reduce({[], [], []}, fn clip_result, {issues_acc, corrections_acc, scores_acc} ->
          try do
            {issues, corrections, quality_score} = {
              Map.get(clip_result, "issues", []),
              Map.get(clip_result, "corrections", []),
              Map.get(clip_result, "qualityScore", 0.0)
            }

            {issues_acc ++ issues, corrections_acc ++ corrections, scores_acc ++ [quality_score]}
          rescue
            error ->
              Logger.error("[ClipValidation] Error processing clip results: #{inspect(error)}")
              {issues_acc ++ ["Processing error"], corrections_acc ++ [], scores_acc ++ [0.0]}
          end
        end)

      avg_quality_score = if length(quality_scores) > 0 do
        Enum.sum(quality_scores) / length(quality_scores)
      else
        0.0
      end

      validation_result = %{
        validatedClips: corrected_clips,
        qualityScore: avg_quality_score,
        issues: total_issues,
        corrections: total_corrections
      }

      Logger.info("[ClipValidation] Validation completed. Quality score: #{Float.round(avg_quality_score, 2)}")
      Logger.info("[ClipValidation] Issues found: #{length(total_issues)}, Corrections applied: #{length(total_corrections)}")

      {:ok, validation_result}
      end
    rescue
      error ->
        Logger.error("[ClipValidation] Validation failed: #{inspect(error)}")
        {:ok, %{validatedClips: clips, qualityScore: 0.0, issues: ["Validation failed"], corrections: []}}
    end
  end

  @doc """
  Validates and corrects a single clip.
  """
  @spec validate_and_correct_clip(map(), list(word()), integer(), boolean()) :: map()
  def validate_and_correct_clip(clip, words, clip_index, verbose) do
    Logger.debug("[ClipValidation] Validating clip #{clip_index}: #{clip["title"] || "Untitled"}")

    _issues = []
    _corrections = []

    # Validate and correct each segment
    {validated_segments, segment_issues, segment_corrections} =
      clip["segments"]
      |> Enum.with_index()
      |> Enum.map(fn {segment, segment_index} ->
        validate_and_correct_segment(segment, words, clip_index, segment_index, verbose)
      end)
      |> Enum.reduce({[], [], []}, fn {segment, issues, corrections}, {segments_acc, issues_acc, corrections_acc} ->
        {[segment | segments_acc], issues_acc ++ issues, corrections_acc ++ corrections}
      end)

    # Reverse segments to maintain order
    validated_segments = Enum.reverse(validated_segments)

    # Recalculate clip duration based on corrected segments
    corrected_clip = calculate_clip_duration(clip, validated_segments)

    # Add validation metadata
    corrected_clip
    |> Map.put("validation_metadata", %{
      "validated_at" => DateTime.utc_now() |> DateTime.to_iso8601(),
      "word_count_in_transcript" => length(words),
      "segments_validated" => length(validated_segments)
    })
    |> Map.put("issues", segment_issues)
    |> Map.put("corrections", segment_corrections)
    |> Map.put("qualityScore", calculate_clip_quality_score(segment_issues, segment_corrections))
  end

  @doc """
  Validates and corrects a single clip segment.
  """
  @spec validate_and_correct_segment(map(), list(word()), integer(), integer(), boolean()) :: {map(), list(String.t()), list(String.t())}
  def validate_and_correct_segment(segment, words, clip_index, segment_index, verbose) do
    transcript_text = segment["transcript"]

    if verbose do
      Logger.debug("[ClipValidation] Segment #{clip_index}.#{segment_index}: \"#{String.slice(transcript_text, 0, 50)}...\"")
    end

    # Try to find exact match in transcript with additional error handling
    match_result = find_transcript_match(transcript_text, words, segment["start_time"], verbose)

    if verbose do
      Logger.debug("[ClipValidation] Match result: #{inspect(match_result)}")
    end

    try do
      case match_result do
      nil ->
        if verbose do
          Logger.warning("[ClipValidation] No match found for segment #{clip_index}.#{segment_index}")
        end
        # Return original segment with issues
        {
          segment,
          ["No transcript match found for segment"],
          []
        }

      match ->
        # Handle the match case with defensive nil checking
        confidence = if match != nil, do: Map.get(match, :confidence, 0.0), else: 0.0

        if match != nil and confidence < @fuzzy_match_threshold do
          if verbose do
            Logger.warning("[ClipValidation] Low confidence match (#{Float.round(confidence * 100, 1)}%) for segment #{clip_index}.#{segment_index}")
          end
          # Return original segment with issues
          {
            segment,
            ["Low confidence match (#{Float.round(confidence * 100, 1)}%)"],
            []
          }
        else
          if match != nil and verbose do
            Logger.info("[ClipValidation] Match found (#{Float.round(confidence * 100, 1)}% confidence)")
            Logger.debug("[ClipValidation] Original: #{segment["start_time"]} - #{segment["end_time"]}")
            Logger.debug("[ClipValidation] Corrected: #{Map.get(match, :startTime, "?")} - #{Map.get(match, :endTime, "?")}")
          end

          # Apply corrections with defensive handling of match fields
          corrected_segment = if match != nil do
            try do
              # Extract values step by step to identify exactly where the error occurs
              start_time = Map.get(match, :startTime, segment["start_time"])
              end_time = Map.get(match, :endTime, segment["end_time"])
              duration = end_time - start_time
              word_indices = Map.get(match, :wordIndices, [])

              Logger.debug("[ClipValidation] Building corrected_segment with: start_time=#{start_time}, end_time=#{end_time}, word_indices=#{inspect(word_indices)}")

              # Use Map.merge instead of map update syntax to avoid potential key type issues
              corrected_segment = Map.merge(segment, %{
                "start_time" => start_time,
                "end_time" => end_time,
                "duration" => duration,
                "wordIndices" => word_indices
              })

              corrected_segment
            rescue
              error ->
                Logger.error("[ClipValidation] Error creating corrected_segment: #{inspect(error)}")
                Logger.error("[ClipValidation] match: #{inspect(match)}")
                Logger.error("[ClipValidation] segment: #{inspect(segment)}")
                Logger.error("[ClipValidation] segment keys: #{inspect(Map.keys(segment))}")

                # Try to identify which field is causing the issue
                if match != nil do
                  Logger.error("[ClipValidation] match keys: #{inspect(Map.keys(match))}")
                  Logger.error("[ClipValidation] match.wordIndices: #{inspect(Map.get(match, :wordIndices, "NOT_FOUND"))}")
                end

                segment
            end
          else
            segment
          end

          # Add validation confidence as metadata with defensive handling
          corrected_segment =
            try do
              Map.put(corrected_segment, "validation_confidence", confidence)
            rescue
              error ->
                Logger.error("[ClipValidation] Error adding validation_confidence: #{inspect(error)}")
                Logger.error("[ClipValidation] confidence: #{inspect(confidence)}")
                Logger.error("[ClipValidation] corrected_segment before error: #{inspect(corrected_segment)}")
                corrected_segment  # Return original segment if error occurs
            end

          issues = []
          _corrections = []

          # Detect if significant correction was made (with defensive handling)
          try do
            match_start_time = if match != nil, do: Map.get(match, :startTime, segment["start_time"]), else: segment["start_time"]
            match_end_time = if match != nil, do: Map.get(match, :endTime, segment["end_time"]), else: segment["end_time"]

            time_diff_start = abs(segment["start_time"] - match_start_time)
            time_diff_end = abs(segment["end_time"] - match_end_time)

            corrections = cond do
              time_diff_start > 1.0 or time_diff_end > 1.0 ->
                ["Significant timestamp correction applied (#{Float.round(time_diff_start, 2)}s/#{Float.round(time_diff_end, 2)}s)"]

              time_diff_start > 0.3 or time_diff_end > 0.3 ->
                ["Minor timestamp correction applied"]

              true ->
                ["Timestamp validation passed"]
            end

            {corrected_segment, issues, corrections}
          rescue
            error ->
              Logger.error("[ClipValidation] Error in correction detection: #{inspect(error)}")
              Logger.error("[ClipValidation] match: #{inspect(match)}")
              Logger.error("[ClipValidation] segment: #{inspect(segment)}")
              {segment, ["Correction detection error: #{inspect(error)}"], []}
          end
        end
      end
    rescue
      error ->
        Logger.error("[ClipValidation] Unexpected error in validate_and_correct_segment: #{inspect(error)}")
        Logger.error("[ClipValidation] segment: #{inspect(segment)}")
        Logger.error("[ClipValidation] words count: #{length(words)}")
        {segment, ["Unexpected validation error: #{inspect(error)}"], []}
    end
  end

  @doc """
  Finds transcript match for given text using multi-phase matching strategy.
  """
  @spec find_transcript_match(String.t(), list(word()), float(), boolean()) :: transcript_match() | nil
  def find_transcript_match(text, words, time_hint \\ nil, verbose \\ false) do
    target_words = normalize_text_to_words(text)
    total_words = length(target_words)

    if total_words == 0 do
      nil
    else
      if verbose do
        Logger.debug("[ClipValidation] Finding match for: #{inspect(target_words)}")
      end

      # Try exact match first
      case find_exact_match(target_words, words, time_hint, verbose) do
        nil ->
          # Try fuzzy match
          find_fuzzy_match(target_words, words, time_hint, verbose)

        match -> match
      end
    end
  end

  @doc """
  Finds exact match for target words in transcript.
  """
  @spec find_exact_match(list(String.t()), list(word()), float(), boolean()) :: transcript_match() | nil
  def find_exact_match(target_words, transcript_words, time_hint \\ nil, verbose \\ false) do
    total_target_words = length(target_words)

    # If we have a time hint, use binary search to find starting position
    start_index = if time_hint do
      find_word_position_at_time(transcript_words, time_hint)
    else
      0
    end

    # Search radius around the hint position
    search_start = max(0, start_index - @max_search_radius)
    search_end = Enum.min([length(transcript_words) - total_target_words, start_index + @max_search_radius])

    if verbose do
      Logger.debug("[ClipValidation] Exact match search: #{search_start} to #{search_end}")
    end

    # Scan through possible positions and collect matches
    matches =
      for i <- search_start..search_end do
        # Check if we have enough words for comparison
        if i + total_target_words <= length(transcript_words) do
          candidate_words = transcript_words
          |> Enum.slice(i, total_target_words)
          |> Enum.map(&normalize_word(&1["word"]))

          match_count = count_word_matches(target_words, candidate_words, false)
          match_percentage = match_count / total_target_words

          if match_percentage >= @exact_match_threshold do
            word_indices = %{start: i, end: i + total_target_words - 1}
            start_word = Enum.at(transcript_words, i)
            end_word = Enum.at(transcript_words, i + total_target_words - 1)

            %{
              startTime: start_word["start"],
              endTime: end_word["end"],
              wordIndices: word_indices,
              confidence: match_percentage,
              matchedWords: match_count,
              totalWords: total_target_words
            }
          end
        end
      end
      |> Enum.filter(&(&1 != nil))

    # Return the match with highest confidence
    case matches do
      [] -> nil
      _ -> Enum.max_by(matches, & &1.confidence)
    end
  end

  @doc """
  Finds fuzzy match allowing for word variations and typos.
  """
  @spec find_fuzzy_match(list(String.t()), list(word()), float(), boolean()) :: transcript_match() | nil
  def find_fuzzy_match(target_words, transcript_words, time_hint \\ nil, verbose \\ false) do
    total_target_words = length(target_words)

    # Use same binary search strategy
    start_index = if time_hint do
      find_word_position_at_time(transcript_words, time_hint)
    else
      0
    end

    search_start = max(0, start_index - @max_search_radius)
    search_end = Enum.min([length(transcript_words) - total_target_words, start_index + @max_search_radius])

    if verbose do
      Logger.debug("[ClipValidation] Fuzzy match search: #{search_start} to #{search_end}")
    end

    # Scan with fuzzy matching and find best match
    matches =
      for i <- search_start..search_end do
        if i + total_target_words <= length(transcript_words) do
          candidate_words = transcript_words
          |> Enum.slice(i, total_target_words)
          |> Enum.map(&normalize_word(&1["word"]))

          match_count = count_word_matches(target_words, candidate_words, true)
          match_percentage = match_count / total_target_words

          if match_percentage >= @fuzzy_match_threshold do
            word_indices = %{start: i, end: i + total_target_words - 1}
            start_word = Enum.at(transcript_words, i)
            end_word = Enum.at(transcript_words, i + total_target_words - 1)

            %{
              startTime: start_word["start"],
              endTime: end_word["end"],
              wordIndices: word_indices,
              confidence: match_percentage,
              matchedWords: match_count,
              totalWords: total_target_words
            }
          end
        end
      end
      |> Enum.filter(&(&1 != nil))

    # Return the match with highest confidence
    case matches do
      [] -> nil
      _ -> Enum.max_by(matches, & &1.confidence)
    end
  end

  # Helper functions

  defp extract_words_from_transcript(transcript) do
    case transcript do
      %{"words" => words} when is_list(words) -> words
      %{"verbose_json" => %{"words" => words}} when is_list(words) -> words
      %{"segments" => segments} when is_list(segments) ->
        # Extract words from segments if available
        segments
        |> Enum.flat_map(fn segment ->
          Map.get(segment, "words", [])
        end)
        |> Enum.filter(fn word ->
          # Filter out nil values and ensure word has required structure
          word != nil and is_map(word) and Map.has_key?(word, "start") and Map.has_key?(word, "end") and Map.has_key?(word, "word")
        end)
      _ ->
        []
    end
  end

  defp find_word_position_at_time(words, target_time) do
    # Binary search to find word at given time
    Enum.reduce_while(words, 0, fn word, index ->
      cond do
        word["start"] >= target_time ->
          {:halt, index}
        true ->
          {:cont, index + 1}
      end
    end)
  end

  defp normalize_text_to_words(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^\w\s']/, "") # Remove punctuation except apostrophes
    |> String.split(~r/\s+/, trim: true)
    |> Enum.map(&normalize_word/1)
  end

  defp normalize_word(word) do
    word
    |> String.downcase()
    |> String.replace("'", "") # Handle contractions like "don't" -> "dont"
  end

  defp count_word_matches(target_words, candidate_words, allow_levenshtein) do
    target_words
    |> Enum.with_index()
    |> Enum.count(fn {target_word, index} ->
      case Enum.at(candidate_words, index) do
        nil -> false
        candidate_word when candidate_word == target_word -> true
        candidate_word when allow_levenshtein ->
          levenshtein_distance(target_word, candidate_word) <= @word_levenshtein_distance
        _ -> false
      end
    end)
  end

  defp levenshtein_distance(s, t) do
    # Simple Levenshtein distance implementation
    s_len = String.length(s)
    t_len = String.length(t)

    cond do
      s_len == 0 -> t_len
      t_len == 0 -> s_len
      true ->
        # For performance, use a simplified version that only handles small distances
        if abs(s_len - t_len) > @word_levenshtein_distance do
          @word_levenshtein_distance + 1
        else
          calculate_levenshtein_distance(s, t, @word_levenshtein_distance)
        end
    end
  end

  defp calculate_levenshtein_distance(s, t, max_distance) do
    # Simple and fast Levenshtein distance implementation for short strings
    # Since we only care about small differences (≤2), we can use a simpler approach
    s_len = String.length(s)
    t_len = String.length(t)

    # Quick check for large differences
    if abs(s_len - t_len) > max_distance do
      max_distance + 1
    else
      # Use a recursive approach with memoization for small strings
      calculate_distance_recursive(s, t, 0, max_distance)
    end
  end

  defp calculate_distance_recursive("", t, current_distance, max_distance) do
    distance = current_distance + String.length(t)
    if distance <= max_distance, do: distance, else: max_distance + 1
  end

  defp calculate_distance_recursive(s, "", current_distance, max_distance) do
    distance = current_distance + String.length(s)
    if distance <= max_distance, do: distance, else: max_distance + 1
  end

  defp calculate_distance_recursive(<<s_char::utf8, s_rest::binary>>, <<t_char::utf8, t_rest::binary>>, current_distance, max_distance) do
    if current_distance > max_distance do
      max_distance + 1
    else
      # Calculate cost of substitution
      cost = if s_char == t_char, do: 0, else: 1

      # Calculate three operations
      delete_cost = calculate_distance_recursive(s_rest, <<t_char::utf8, t_rest::binary>>, current_distance + 1, max_distance)
      insert_cost = calculate_distance_recursive(<<s_char::utf8, s_rest::binary>>, t_rest, current_distance + 1, max_distance)
      substitute_cost = calculate_distance_recursive(s_rest, t_rest, current_distance + cost, max_distance)

      Enum.min([delete_cost, insert_cost, substitute_cost])
    end
  end

  defp calculate_clip_duration(clip, validated_segments) do
    if length(validated_segments) > 0 do
      first_segment = hd(validated_segments)
      last_segment = List.last(validated_segments)

      total_duration = last_segment["end_time"] - first_segment["start_time"]

      clip
      |> Map.put("segments", validated_segments)
      |> Map.put("total_duration", total_duration)
    else
      clip
    end
  end

  defp calculate_clip_quality_score(issues, corrections) do
    # Simple quality score based on issues and corrections
    base_score = 1.0
    issue_penalty = length(issues) * 0.1
    correction_penalty = length(corrections) * 0.05

    max(0.0, base_score - issue_penalty - correction_penalty)
  end

  @doc """
  Validates clips using segment-level timestamps instead of word-level.
  This is a fallback when word-level data is not available.
  """
  defp validate_and_correct_clips_with_segments(clips, segments, verbose) do
    Logger.info("[ClipValidation] Starting segment-level validation for #{length(clips)} clips")

    try do
      # Validate each clip by aligning with segment boundaries
      {validated_clips, all_issues, all_corrections} =
        clips
        |> Enum.with_index()
        |> Enum.map(fn {clip, clip_index} ->
          validate_clip_with_segments(clip, segments, clip_index, verbose)
        end)
        |> Enum.reduce({[], [], []}, fn {validated_clip, issues, corrections}, {clips_acc, issues_acc, corrections_acc} ->
          {[validated_clip | clips_acc], issues_acc ++ issues, corrections_acc ++ corrections}
        end)
        |> then(fn {clips_acc, issues_acc, corrections_acc} ->
          {Enum.reverse(clips_acc), issues_acc, corrections_acc}
        end)

      # Calculate quality score (lower for segment-level validation)
      base_score = 0.6  # Start lower since we can't do word-level precision
      issue_penalty = length(all_issues) * 0.05
      correction_penalty = length(all_corrections) * 0.03
      quality_score = max(0.0, base_score - issue_penalty - correction_penalty)

      result = %{
        validatedClips: validated_clips,
        qualityScore: quality_score,
        issues: all_issues,
        corrections: all_corrections
      }

      Logger.info("[ClipValidation] Segment-level validation completed. Quality score: #{Float.round(quality_score, 2)}")
      {:ok, result}

    rescue
      error ->
        Logger.error("[ClipValidation] Segment-level validation failed: #{inspect(error)}")
        {:error, "Segment validation error: #{inspect(error)}"}
    end
  end

  @doc """
  Validates a single clip against segment boundaries.
  """
  defp validate_clip_with_segments(clip, segments, clip_index, verbose) do
    Logger.debug("[ClipValidation] Validating clip #{clip_index} against #{length(segments)} segments")

    issues = []
    corrections = []

    # Validate each segment in the clip
    {validated_segments, segment_issues, segment_corrections} =
      clip["segments"]
      |> Enum.with_index()
      |> Enum.map(fn {segment, segment_index} ->
        validate_segment_with_segments(segment, segments, clip_index, segment_index, verbose)
      end)
      |> Enum.reduce({[], [], []}, fn {validated_segment, issues, corrections}, {segments_acc, issues_acc, corrections_acc} ->
        {[validated_segment | segments_acc], issues_acc ++ issues, corrections_acc ++ corrections}
      end)
      |> then(fn {segments_acc, issues_acc, corrections_acc} ->
        {Enum.reverse(segments_acc), issues_acc, corrections_acc}
      end)

    # Update clip with validated segments
    validated_clip = clip
    |> Map.put("segments", validated_segments)
    |> Map.put("validation_metadata", %{
      "validated_at" => DateTime.utc_now() |> DateTime.to_iso8601(),
      "validation_type" => "segment_level",
      "segments_count" => length(segments)
    })

    all_issues = segment_issues ++ issues

    # Add segment-level specific issues if any
    quality_issues = if length(all_issues) > 0 do
      all_issues
    else
      ["Segment-level validation only (word timestamps not provided by transcription service)"]
    end

    {
      validated_clip,
      quality_issues,
      segment_corrections ++ corrections
    }
  end

  @doc """
  Validates a single clip segment against the available transcript segments.
  """
  defp validate_segment_with_segments(clip_segment, transcript_segments, clip_index, segment_index, verbose) do
    if verbose do
      Logger.debug("[ClipValidation] Validating segment #{clip_index}.#{segment_index}: #{clip_segment["start_time"]} - #{clip_segment["end_time"]}")
    end

    issues = []
    corrections = []

    # Check if the clip segment falls within any transcript segment boundaries
    # This is a simple validation - we just check if the timestamps are reasonable
    {start_time, end_time} = {clip_segment["start_time"], clip_segment["end_time"]}

    # Basic temporal validation
    {start_issues, start_corrections, validated_start} =
      cond do
        start_time < 0 ->
          {[%{negative_timestamp: true}], [%{corrected: "Fixed negative start time"}], 0.0}
        start_time > 1000 ->  # More than 16 minutes is suspicious for typical clips
          {[%{suspicious_timestamp: true}], [], start_time}
        true ->
          {[], [], start_time}
      end

    {end_issues, end_corrections, validated_end} =
      cond do
        end_time <= start_time ->
          {[%{invalid_duration: true}], [%{corrected: "Fixed invalid duration"}], start_time + 5.0}
        end_time > 2000 ->  # More than 33 minutes is suspicious
          {[%{suspicious_timestamp: true}], [], end_time}
        true ->
          {[], [], end_time}
      end

    # Check if clip overlaps with transcript segments
    overlap_issues = check_segment_overlap(start_time, end_time, transcript_segments)

    # Apply corrections if any
    validated_segment = if length(start_corrections) > 0 or length(end_corrections) > 0 do
      %{
        clip_segment |
        "start_time" => validated_start,
        "end_time" => validated_end,
        "duration" => validated_end - validated_start,
        "validation_type" => "segment_level"
      }
    else
      Map.put(clip_segment, "validation_type", "segment_level")
    end

    all_issues = issues ++ start_issues ++ end_issues ++ overlap_issues
    all_corrections = corrections ++ start_corrections ++ end_corrections

    {
      validated_segment,
      all_issues,
      all_corrections
    }
  end

  @doc """
  Checks if a clip segment overlaps with available transcript segments.
  """
  defp check_segment_overlap(clip_start, clip_end, transcript_segments) do
    overlapping_segments = Enum.count(transcript_segments, fn segment ->
      segment_start = segment["start"]
      segment_end = segment["end"]

      # Check if there's any overlap
      not (clip_end <= segment_start or clip_start >= segment_end)
    end)

    if overlapping_segments == 0 do
      [%{no_transcript_overlap: true}]
    else
      []
    end
  end
end