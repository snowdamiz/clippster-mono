defmodule ClippsterServer.AI.VideoPlanner do
  @moduledoc """
  The free planning chat before a video is built. The model talks with the user about what the
  video should say and how it should go, asking only what the description, the example and the
  media leave open, and keeps a scene plan up to date with `set_plan`. The latest plan and the
  chat go into the generate run's brief.

  Each message is answered statelessly: the visible chat is the conversation, so the run only
  carries the turn cap and the cost. The system prompt and session context are cached for an hour.
  """

  alias ClippsterServer.AI.{OpenRouterChat, VideoAgent, VideoAgentPrompts, VideoGenerationPolicy, VideoRun, VideoRuns, VideoSession}

  @phase "plan"
  @history_messages 30
  @max_attempts 3
  @max_beats 20
  @aspect_ratios ~w(16:9 9:16 1:1 4:5)
  @long_cache %{"type" => "ephemeral", "ttl" => "1h"}
  @default_message "Here's the plan. Change anything you like, or press Build when it looks right."

  @set_plan %{
    "type" => "function",
    "function" => %{
      "name" => "set_plan",
      "description" => "Save the whole scene plan the user sees. Call it whenever the plan is new or changes.",
      "parameters" => %{
        "type" => "object",
        "properties" => %{
          "plan" => %{
            "type" => "object",
            "properties" => %{
              "title" => %{"type" => "string", "description" => "Short working title."},
              "aspect" => %{"type" => "string", "enum" => @aspect_ratios, "description" => "Only without an example."},
              "tone" => %{"type" => "string", "description" => "A few words, for example \"bold, fast, playful\"."},
              "notes" => %{"type" => "string", "description" => "Facts and must-haves the user gave: names, dates, offers, the call to action."},
              "beats" => %{
                "type" => "array",
                "maxItems" => @max_beats,
                "items" => %{
                  "type" => "object",
                  "properties" => %{
                    "seconds" => %{"type" => "number"},
                    "kind" => %{"type" => "string", "enum" => ["scene", "footage"]},
                    "what" => %{"type" => "string", "description" => "What the viewer sees and how it moves."},
                    "words" => %{"type" => "string", "description" => "The words on screen, if any."},
                    "media" => %{"type" => "array", "items" => %{"type" => "string"}, "description" => "Media ids shown in this beat."}
                  },
                  "required" => ["seconds", "kind", "what"]
                }
              }
            },
            "required" => ["title", "beats"]
          }
        },
        "required" => ["plan"]
      }
    }
  }

  def phase, do: @phase

  @spec reply(VideoRun.t(), VideoSession.t(), String.t()) ::
          {:ok, %{message: String.t(), plan: map() | nil}} | {:error, :invalid, String.t()} | {:error, String.t()}
  def reply(%VideoRun{kind: "plan"} = run, %VideoSession{} = session, message) do
    if run.turns >= VideoGenerationPolicy.max_turns("plan") do
      {:error, :invalid, "This planning chat can't get any longer. Press Build to make the video."}
    else
      messages = [system_message(session) | chat(session, @history_messages)] ++ [user_message(session, message)]
      attempt(run, session, messages, 1)
    end
  end

  @doc "The plan-phase chat, oldest first, as plain role/content pairs."
  def chat(%VideoSession{messages: messages}, limit) when is_list(messages) do
    messages
    |> Enum.filter(&planning?/1)
    |> Enum.take(-limit)
    |> Enum.map(&%{"role" => &1.role, "content" => &1.content})
  end

  def chat(_session, _limit), do: []

  @doc "The newest plan from the chat, or nil."
  def latest_plan(%VideoSession{messages: messages}) when is_list(messages) do
    messages
    |> Enum.reverse()
    |> Enum.find_value(fn message -> planning?(message) && is_map(message.metadata["plan"]) && message.metadata["plan"] end)
  end

  def latest_plan(_session), do: nil

  defp planning?(%{metadata: %{"phase" => @phase}}), do: true
  defp planning?(_message), do: false

  # -- Model call --------------------------------------------------------------------

  defp attempt(run, session, messages, attempt) do
    model = VideoGenerationPolicy.plan_model()

    payload = %{
      "model" => model,
      "messages" => messages,
      "tools" => [@set_plan],
      "tool_choice" => "auto",
      "max_tokens" => VideoGenerationPolicy.plan_max_tokens(),
      "reasoning" => %{"effort" => VideoGenerationPolicy.plan_reasoning_effort()}
    }

    with {:ok, %{message: reply, usage: usage}} <- OpenRouterChat.complete(payload, title: "Clippster AI Video Planner") do
      VideoRuns.record_usage(run, model, "video_plan", usage)
      :ok = VideoRuns.count_turn(run)
      text = reply |> OpenRouterChat.message_text() |> String.trim()

      case Enum.find(reply["tool_calls"] || [], &(&1["function"]["name"] == "set_plan")) do
        nil ->
          finish(text, nil)

        call ->
          case validate_plan(arguments(call)["plan"], session) do
            {:ok, plan} ->
              finish(text, plan)

            {:error, errors} when attempt < @max_attempts ->
              assistant = reply |> Map.take(~w(content tool_calls reasoning_details)) |> Map.put("role", "assistant")
              result = %{"role" => "tool", "tool_call_id" => call["id"], "content" => "Plan not saved: " <> Enum.join(errors, " ")}
              attempt(run, session, messages ++ [assistant, result], attempt + 1)

            {:error, _errors} ->
              finish(text, nil)
          end
      end
    end
  end

  defp finish("", nil), do: {:error, "The AI returned an empty reply."}
  defp finish("", plan), do: {:ok, %{message: @default_message, plan: plan}}
  defp finish(text, plan), do: {:ok, %{message: text, plan: plan}}

  defp arguments(%{"function" => %{"arguments" => arguments}}) when is_binary(arguments) do
    case Jason.decode(arguments) do
      {:ok, decoded} when is_map(decoded) -> decoded
      _ -> %{}
    end
  end

  defp arguments(%{"function" => %{"arguments" => arguments}}) when is_map(arguments), do: arguments
  defp arguments(_call), do: %{}

  defp system_message(session) do
    %{
      "role" => "system",
      "content" => [
        %{"type" => "text", "text" => VideoAgentPrompts.plan_prompt(), "cache_control" => @long_cache},
        %{"type" => "text", "text" => VideoAgent.session_context(session), "cache_control" => @long_cache}
      ]
    }
  end

  defp user_message(session, message) do
    setup = %{
      "shape" => if(session.reference_blueprint, do: "example", else: session.aspect_ratio),
      "maxSeconds" => VideoGenerationPolicy.max_output_seconds(),
      "currentPlan" => latest_plan(session)
    }

    %{"role" => "user", "content" => "# Setup\n" <> VideoAgent.canonical_json(setup) <> "\n\n# Message\n" <> message}
  end

  # -- Plan validation -------------------------------------------------------------------

  @doc "Check a plan from `set_plan` and return it normalised, or the problems to send back."
  @spec validate_plan(term(), VideoSession.t()) :: {:ok, map()} | {:error, [String.t()]}
  def validate_plan(plan, %VideoSession{} = session) when is_map(plan) do
    media = Map.new(session.media_items || [], &{&1["id"], &1["kind"]})
    raw_beats = if is_list(plan["beats"]), do: plan["beats"], else: []
    beats = raw_beats |> Enum.with_index(1) |> Enum.map(fn {beat, n} -> validate_beat(beat, n, media) end)
    total = Float.round(Enum.sum(Enum.map(beats, fn {beat, _} -> beat["seconds"] || 0.0 end)) * 1.0, 1)
    max = VideoGenerationPolicy.max_output_seconds()
    aspect = plan["aspect"]

    errors =
      [
        text(plan["title"], 80) == nil && "Give the plan a title.",
        raw_beats == [] && "Add at least one beat.",
        length(raw_beats) > @max_beats && "Use at most #{@max_beats} beats.",
        total > max && "The beats add up to #{total} s; the video can be at most #{max} s.",
        aspect != nil && aspect not in @aspect_ratios && "aspect must be one of #{Enum.join(@aspect_ratios, ", ")}."
      ]
      |> Enum.filter(&is_binary/1)
      |> Kernel.++(Enum.flat_map(beats, &elem(&1, 1)))

    if errors == [] do
      {:ok,
       compact(%{
         "title" => text(plan["title"], 80),
         "aspect" => if(session.reference_blueprint, do: nil, else: aspect),
         "tone" => text(plan["tone"], 80),
         "notes" => text(plan["notes"], 1_000),
         "seconds" => total,
         "beats" => Enum.map(beats, &elem(&1, 0))
       })}
    else
      {:error, errors}
    end
  end

  def validate_plan(_plan, _session), do: {:error, ["plan must be an object."]}

  defp validate_beat(beat, n, media) when is_map(beat) do
    seconds = beat["seconds"]
    ids = if is_list(beat["media"]), do: Enum.filter(beat["media"], &is_binary/1), else: []
    footage = Enum.filter(ids, &(media[&1] in ~w(video photo)))

    errors =
      [
        not (is_number(seconds) and seconds >= 0.5 and seconds <= 30) && "Beat #{n}: seconds must be 0.5 to 30.",
        beat["kind"] not in ~w(scene footage) && "Beat #{n}: kind must be scene or footage.",
        text(beat["what"], 300) == nil && "Beat #{n}: say what the viewer sees.",
        beat["kind"] == "footage" and footage == [] && "Beat #{n}: footage needs the id of one of the user's videos or photos."
      ]
      |> Enum.filter(&is_binary/1)

    normalized =
      compact(%{
        "seconds" => if(is_number(seconds), do: Float.round(seconds * 1.0, 1)),
        "kind" => beat["kind"],
        "what" => text(beat["what"], 300),
        "words" => text(beat["words"], 200),
        "media" => if(footage == [], do: nil, else: Enum.uniq(footage))
      })

    {normalized, errors}
  end

  defp validate_beat(_beat, n, _media), do: {%{}, ["Beat #{n} must be an object."]}

  defp text(value, max) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> String.slice(trimmed, 0, max)
    end
  end

  defp text(_value, _max), do: nil

  defp compact(map), do: map |> Enum.reject(fn {_key, value} -> is_nil(value) end) |> Map.new()
end
