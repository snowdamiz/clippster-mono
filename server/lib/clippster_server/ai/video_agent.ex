defmodule ClippsterServer.AI.VideoAgent do
  @moduledoc """
  The Opus video agent loop. The desktop client runs the workspace tools (edit, files, checks,
  stills); the server owns the conversation, calls OpenRouter and resolves `read_skill` itself.

  Prompt caching uses all four Anthropic breakpoints:

    1. system prompt (tools are cached with it) - 1 hour
    2. session context: example blueprint, media, source index - 1 hour
    3. the previous turn's final user message - 5 minutes
    4. the current final user message - 5 minutes

  The run brief (first user message) sits between 2 and 3. Every turn appends to the stored
  conversation, so each request's prefix is byte-identical to the previous request.
  """

  alias ClippsterServer.AI.{OpenRouterChat, VideoAgentPrompts, VideoGenerationPolicy, VideoRun, VideoRuns, VideoSession}

  @long_cache %{"type" => "ephemeral", "ttl" => "1h"}
  @short_cache %{"type" => "ephemeral"}

  @max_tool_result_chars 24_000
  @max_images_per_turn 24
  @max_image_base64_bytes 600_000
  @max_brief_bytes 400_000
  @recent_chat_messages 8

  @client_tools ~w(set_edit write_file read_file list_files delete_file check snapshot)

  @tools [
    %{
      "type" => "function",
      "function" => %{
        "name" => "set_edit",
        "description" =>
          "Submit the whole edit document (shots, music, overlays). It is validated and compiled into the root index.html. Returns validation errors or a summary of the compiled timeline.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{"document" => %{"type" => "object", "description" => "The full edit document."}},
          "required" => ["document"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "write_file",
        "description" => "Create or replace a composition file under compositions/ (.html only).",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "path" => %{"type" => "string", "description" => "For example compositions/title.html"},
            "content" => %{"type" => "string"}
          },
          "required" => ["path", "content"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "read_file",
        "description" => "Read a composition file, or index.html to see the compiled root.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{"path" => %{"type" => "string"}},
          "required" => ["path"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "list_files",
        "description" => "List the project's authored files.",
        "parameters" => %{"type" => "object", "properties" => %{}}
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "delete_file",
        "description" => "Delete a composition file that no overlay uses any more.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{"path" => %{"type" => "string"}},
          "required" => ["path"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "check",
        "description" =>
          "Lint the project, run it in a headless browser and audit layout and contrast at sampled times. Returns findings with fix hints.",
        "parameters" => %{"type" => "object", "properties" => %{}}
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "snapshot",
        "description" =>
          "Render stills at the given output times. Each still comes back beside the example's frame from the shot matched at that time.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "times" => %{
              "type" => "array",
              "items" => %{"type" => "number"},
              "maxItems" => 12,
              "description" => "Output times in seconds."
            }
          },
          "required" => ["times"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "read_skill",
        "description" =>
          "Load a reference skill by path without .md, for example hyperframes-core/references/sub-compositions or hyperframes-animation/SKILL.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{"name" => %{"type" => "string"}},
          "required" => ["name"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "finish",
        "description" => "End the run with your message to the user (1-3 plain sentences).",
        "parameters" => %{
          "type" => "object",
          "properties" => %{"message" => %{"type" => "string"}},
          "required" => ["message"]
        }
      }
    }
  ]

  @type turn_input :: %{optional(:brief) => map() | nil, optional(:results) => [map()]}
  @type outcome ::
          {:tools, [map()], String.t(), VideoRun.t()}
          | {:finish, String.t(), VideoRun.t()}
          | {:limit, VideoRun.t()}
          | {:error, :invalid, String.t()}
          | {:error, String.t()}

  def tools, do: @tools

  @doc """
  Advance a running agent run: append the client's tool results (or start the conversation from
  the brief), call the model, and return the next client tool calls or the final message.
  """
  @spec turn(VideoRun.t(), VideoSession.t(), turn_input()) :: outcome()
  def turn(%VideoRun{status: "running"} = run, %VideoSession{} = session, input) do
    with {:ok, messages} <- prepare(run, session, input) do
      loop(run, messages)
    end
  end

  def turn(%VideoRun{}, _session, _input), do: {:error, :invalid, "This run has already ended."}

  # -- Conversation ----------------------------------------------------------

  defp prepare(%VideoRun{messages: []} = run, session, input) do
    with {:ok, brief} <- validate_brief(Map.get(input, :brief)) do
      {:ok, initial_messages(session, run, brief)}
    end
  end

  defp prepare(%VideoRun{messages: messages}, _session, input) do
    append_results(messages, Map.get(input, :results) || [])
  end

  @doc false
  def initial_messages(%VideoSession{} = session, %VideoRun{} = run, brief) do
    [
      %{
        "role" => "system",
        "content" => [
          %{"type" => "text", "text" => VideoAgentPrompts.system_prompt(), "cache_control" => @long_cache},
          %{"type" => "text", "text" => session_context(session), "cache_control" => @long_cache}
        ]
      },
      user_message(["# Brief\n" <> canonical_json(brief_data(session, run, brief))])
    ]
  end

  @doc "The cached session block. Canonical JSON, so equal data always renders identical bytes."
  def session_context(%VideoSession{} = session) do
    media = Enum.map(session.media_items || [], &model_media/1)

    "# Session context\n" <>
      canonical_json(%{
        "example" => session.reference_blueprint,
        "media" => media,
        "sources" => model_sources(session)
      })
  end

  defp brief_data(_session, %VideoRun{kind: "generate"} = run, brief) do
    Map.merge(brief, %{
      "kind" => "generate",
      "request" => run.request || "",
      "maxSeconds" => VideoGenerationPolicy.max_output_seconds()
    })
  end

  defp brief_data(session, %VideoRun{kind: "revise"} = run, _brief) do
    %{
      "kind" => "revise",
      "request" => run.request || "",
      "maxSeconds" => VideoGenerationPolicy.max_output_seconds(),
      "recentChat" => recent_chat(session, run.request),
      "document" => session.document,
      "files" => (session.composition_files || %{}) |> Map.keys() |> Enum.sort()
    }
  end

  # The run's own request is the newest chat message; the brief carries it separately.
  defp recent_chat(%VideoSession{messages: messages}, request) when is_list(messages) do
    messages =
      case List.last(messages) do
        %{role: "user", content: ^request} -> Enum.drop(messages, -1)
        _ -> messages
      end

    messages
    |> Enum.take(-@recent_chat_messages)
    |> Enum.map(&%{"role" => &1.role, "content" => &1.content})
  end

  defp recent_chat(_session, _request), do: []

  defp model_media(item) do
    Map.take(item, ~w(id name kind duration width height hasAudio))
  end

  # Source labels are keyed by content hash; the model sees them per media id.
  defp model_sources(%VideoSession{media_items: items, source_index: index}) do
    index = index || %{}

    for %{"id" => id, "contentHash" => hash} <- items || [], is_map(index[hash]), into: %{} do
      segments =
        index[hash]
        |> Map.values()
        |> Enum.flat_map(&List.wrap(&1["segments"]))
        |> Enum.sort_by(&(&1["start"] || 0))

      {id, segments}
    end
  end

  defp validate_brief(brief) when is_map(brief) do
    if byte_size(Jason.encode!(brief)) <= @max_brief_bytes,
      do: {:ok, Map.take(brief, ~w(format candidates music))},
      else: {:error, :invalid, "The edit brief is too large."}
  end

  defp validate_brief(nil), do: {:ok, %{}}
  defp validate_brief(_), do: {:error, :invalid, "The edit brief must be an object."}

  defp append_results(messages, results) when is_list(results) do
    pending = pending_client_calls(messages)
    by_id = Map.new(results, &{&1["id"], &1})

    cond do
      pending == [] and results == [] and last_role(messages) == "user" ->
        {:ok, messages}

      Enum.sort(Map.keys(by_id)) != Enum.sort(Enum.map(pending, & &1["id"])) ->
        {:error, :invalid, "Tool results don't match the pending tool calls."}

      true ->
        results = Enum.map(pending, &by_id[&1["id"]])

        with {:ok, image_parts} <- image_parts(results) do
          tool_messages = Enum.map(results, &tool_message(&1["id"], &1["content"]))
          {:ok, messages ++ tool_messages ++ [user_message(["Tool results are above." | image_parts])]}
        end
    end
  end

  defp append_results(_messages, _results), do: {:error, :invalid, "Tool results must be a list."}

  defp pending_client_calls(messages) do
    case Enum.find_index(Enum.reverse(messages), &(&1["role"] == "assistant")) do
      nil ->
        []

      reverse_index ->
        index = length(messages) - 1 - reverse_index
        {before_and_assistant, after_assistant} = Enum.split(messages, index + 1)
        answered = for %{"role" => "tool", "tool_call_id" => id} <- after_assistant, into: MapSet.new(), do: id

        (List.last(before_and_assistant)["tool_calls"] || [])
        |> Enum.filter(&(&1["function"]["name"] in @client_tools))
        |> Enum.reject(&MapSet.member?(answered, &1["id"]))
    end
  end

  defp image_parts(results) do
    images = Enum.flat_map(results, &List.wrap(&1["images"]))

    cond do
      length(images) > @max_images_per_turn ->
        {:error, :invalid, "Too many stills in one turn."}

      Enum.any?(images, &(not valid_image?(&1))) ->
        {:error, :invalid, "Stills must be base64 JPEG images under 600 KB."}

      true ->
        {:ok,
         Enum.flat_map(images, fn %{"label" => label, "data" => data} ->
           [
             %{"type" => "text", "text" => to_string(label)},
             %{"type" => "image_url", "image_url" => %{"url" => "data:image/jpeg;base64," <> data}}
           ]
         end)}
    end
  end

  defp valid_image?(%{"label" => label, "data" => data}) when is_binary(data) do
    is_binary(label) and byte_size(data) <= @max_image_base64_bytes and Base.decode64(data) != :error
  end

  defp valid_image?(_), do: false

  # -- Model loop --------------------------------------------------------------

  defp loop(%VideoRun{} = run, messages) do
    max_turns = VideoGenerationPolicy.max_turns(run.kind)

    if run.turns >= max_turns do
      {:ok, run} = VideoRuns.save_messages(run, messages)
      {:limit, run}
    else
      messages = if run.turns == max_turns - 1, do: add_final_turn_nudge(messages), else: messages
      call_model(run, messages)
    end
  end

  defp call_model(run, messages) do
    model = VideoGenerationPolicy.agent_model()

    case OpenRouterChat.complete(request_payload(messages), title: "Clippster AI Video Editor") do
      {:ok, %{message: message, usage: usage}} ->
        VideoRuns.record_usage(run, model, "video_agent_#{run.kind}", usage)
        assistant = assistant_message(message)
        handle_reply(run, messages ++ [assistant], assistant)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp handle_reply(run, messages, assistant) do
    calls = assistant["tool_calls"] || []
    text = OpenRouterChat.message_text(assistant) |> String.trim()

    case Enum.find(calls, &(&1["function"]["name"] == "finish")) do
      %{} = finish ->
        message = finish |> call_arguments() |> Map.get("message") |> present_or(text)
        finish_run(run, messages, message)

      nil when calls == [] ->
        finish_run(run, messages, text)

      nil ->
        {client_calls, server_calls} = Enum.split_with(calls, &(&1["function"]["name"] in @client_tools))
        messages = messages ++ Enum.map(server_calls, &resolve_server_call/1)
        {:ok, run} = VideoRuns.save_turn(run, messages)

        if client_calls == [] do
          loop(run, messages ++ [user_message(["Continue."])])
        else
          {:tools, Enum.map(client_calls, &client_call/1), text, run}
        end
    end
  end

  defp finish_run(_run, _messages, ""), do: {:error, "The AI returned an empty reply."}

  defp finish_run(run, messages, message) do
    {:ok, run} = VideoRuns.save_turn(run, messages)
    {:ok, run} = VideoRuns.record_finish(run, %{"message" => message})
    {:finish, message, run}
  end

  defp resolve_server_call(%{"id" => id, "function" => %{"name" => "read_skill"}} = call) do
    content =
      case VideoAgentPrompts.skill(call_arguments(call)["name"]) do
        {:ok, skill} -> skill
        {:error, reason} -> reason
      end

    tool_message(id, content)
  end

  defp resolve_server_call(%{"id" => id, "function" => %{"name" => name}}) do
    tool_message(id, "Unknown tool #{inspect(name)}.")
  end

  defp client_call(%{"id" => id, "function" => %{"name" => name}} = call) do
    %{"id" => id, "name" => name, "arguments" => call_arguments(call)}
  end

  defp call_arguments(%{"function" => %{"arguments" => arguments}}) when is_binary(arguments) do
    case Jason.decode(arguments) do
      {:ok, decoded} when is_map(decoded) -> decoded
      _ -> %{}
    end
  end

  defp call_arguments(%{"function" => %{"arguments" => arguments}}) when is_map(arguments), do: arguments
  defp call_arguments(_), do: %{}

  defp add_final_turn_nudge(messages) do
    {head, [last]} = Enum.split(messages, -1)
    note = %{"type" => "text", "text" => "This is your last turn. Call finish now with your message to the user."}
    head ++ [Map.update!(last, "content", &(&1 ++ [note]))]
  end

  # -- Request shape ---------------------------------------------------------------

  @doc "The OpenRouter request for the stored conversation, with conversation cache breakpoints."
  def request_payload(messages) do
    %{
      "model" => VideoGenerationPolicy.agent_model(),
      "messages" => with_conversation_breakpoints(messages),
      "tools" => @tools,
      "tool_choice" => "auto",
      "max_tokens" => VideoGenerationPolicy.agent_max_tokens(),
      "reasoning" => %{"effort" => VideoGenerationPolicy.agent_reasoning_effort()}
    }
  end

  defp with_conversation_breakpoints(messages) do
    marked =
      messages
      |> Enum.with_index()
      |> Enum.filter(fn {message, _} -> message["role"] == "user" end)
      |> Enum.take(-2)
      |> MapSet.new(fn {_, index} -> index end)

    messages
    |> Enum.with_index()
    |> Enum.map(fn {message, index} ->
      if MapSet.member?(marked, index), do: mark_last_part(message), else: message
    end)
  end

  defp mark_last_part(%{"content" => parts} = message) do
    {head, [last]} = Enum.split(parts, -1)
    %{message | "content" => head ++ [Map.put(last, "cache_control", @short_cache)]}
  end

  defp user_message(parts) do
    %{
      "role" => "user",
      "content" => Enum.map(parts, fn
        text when is_binary(text) -> %{"type" => "text", "text" => text}
        part -> part
      end)
    }
  end

  defp tool_message(id, content) do
    %{"role" => "tool", "tool_call_id" => id, "content" => truncate(to_string(content || ""))}
  end

  # Reasoning details must be passed back unchanged for tool use with extended thinking.
  defp assistant_message(message) do
    message
    |> Map.take(~w(content tool_calls reasoning_details))
    |> Map.put("role", "assistant")
  end

  defp last_role(messages), do: messages |> List.last() |> Map.get("role")

  defp truncate(text) when byte_size(text) > @max_tool_result_chars,
    do: String.slice(text, 0, @max_tool_result_chars) <> "\n[truncated]"

  defp truncate(text), do: text

  defp present_or(value, fallback) when is_binary(value) do
    case String.trim(value) do
      "" -> fallback
      trimmed -> trimmed
    end
  end

  defp present_or(_value, fallback), do: fallback

  @doc "JSON with object keys sorted at every level."
  def canonical_json(data), do: data |> canonical() |> Jason.encode!()

  defp canonical(%{__struct__: _} = struct), do: struct

  defp canonical(map) when is_map(map) do
    map
    |> Enum.map(fn {key, value} -> {to_string(key), canonical(value)} end)
    |> Enum.sort_by(&elem(&1, 0))
    |> Jason.OrderedObject.new()
  end

  defp canonical(list) when is_list(list), do: Enum.map(list, &canonical/1)
  defp canonical(value), do: value
end
