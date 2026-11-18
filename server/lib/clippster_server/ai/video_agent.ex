defmodule ClippsterServer.AI.VideoAgent do
  @moduledoc """
  The Opus video agent loop. The desktop client runs the workspace tools (edit, files, checks,
  stills); the server owns the conversation, calls OpenRouter and resolves `read_skill` itself.

  Prompt caching uses all four Anthropic breakpoints:

    1. system prompt (tools are cached with it) - 1 hour
    2. session context: example blueprint (if any), media, source index - 1 hour
    3. the previous turn's final user message - 5 minutes
    4. the current final user message - 5 minutes

  The run brief (first user message) sits between 2 and 3. Every turn appends to the stored
  conversation, so each request's prefix is byte-identical to the previous request.
  """

  alias ClippsterServer.AI.{
    OpenRouterChat,
    VideoAgentPrompts,
    VideoGenerationPolicy,
    VideoPlanner,
    VideoRun,
    VideoRuns,
    VideoSession
  }

  @long_cache %{"type" => "ephemeral", "ttl" => "1h"}
  @short_cache %{"type" => "ephemeral"}

  @max_tool_result_chars 24_000
  @max_images_per_turn 24
  @max_image_base64_bytes 600_000
  @max_brief_bytes 400_000
  @plan_chat_messages 30
  @chat_messages 40

  @client_tools ~w(set_edit write_file read_file list_files delete_file check snapshot read_source_window read_speech_window submit_playbook_package)

  @research_tools [%{"type" => "openrouter:web_search"}, %{"type" => "openrouter:web_fetch"}]

  @tools [
    %{
      "type" => "function",
      "function" => %{
        "name" => "set_edit",
        "description" =>
          "Submit the whole edit document (shots of footage or designed scenes, music, overlays). It is validated and compiled into the root index.html. Returns validation errors or a summary of the compiled timeline.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "document" => %{"type" => "object", "description" => "The full edit document."}
          },
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
            "path" => %{
              "type" => "string",
              "description" => "For example compositions/title.html"
            },
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
        "description" => "Delete a composition file that no scene or overlay uses any more.",
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
          "Render stills at the given output times. With an example, each still comes back beside the example's frame from the shot matched at that time.",
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
        "name" => "read_speech_window",
        "description" =>
          "Read timed speech and provisional speaker IDs in a selected 120-second source window. Use before cutting a conversation or assigning a camera to a speaker.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "mediaId" => %{"type" => "string"},
            "start" => %{"type" => "number"},
            "end" => %{"type" => "number"}
          },
          "required" => ["mediaId", "start", "end"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "read_source_window",
        "description" =>
          "Read detailed source labels in a selected 120-second time window. Use after choosing a promising window from a long recording before placing exact footage cuts.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "mediaId" => %{"type" => "string"},
            "start" => %{"type" => "number"},
            "end" => %{"type" => "number"}
          },
          "required" => ["mediaId", "start", "end"]
        }
      }
    },
    %{
      "type" => "function",
      "function" => %{
        "name" => "submit_playbook_package",
        "description" =>
          "For an automatic creator playbook clip, submit a funnel stage and outcome, structured claims, dated sources, public brand references, sponsor review, thumbnail concepts, platform copy with pinned comments, and unresolved review items before finishing. Reach clips need a bridge to a later stage. Research mentioned companies using official public sources where possible; record source URLs, logo references, colors, and rights questions separately from creator branding and sponsorship. Do not invent URLs, dates, sponsor codes, or endorsements. Every verified or partial claim needs a dated source URL listed in sources. Uncertain claims need a visible label.",
        "parameters" => %{
          "type" => "object",
          "properties" => %{
            "package" => %{
              "type" => "object",
              "properties" => %{
                "funnel" => %{
                  "type" => "object",
                  "properties" => %{
                    "stage" => %{"type" => "string", "enum" => ~w(reach trust sponsor creator_product)},
                    "reason" => %{"type" => "string"},
                    "bridge" => %{"type" => "string"},
                    "metric" => %{"type" => "string"}
                  },
                  "required" => ~w(stage reason metric)
                },
                "claims" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "time" => %{"type" => "number"},
                      "text" => %{"type" => "string"},
                      "verdict" => %{
                        "type" => "string",
                        "enum" =>
                          ~w(verified partial unconfirmed rumor opinion prediction not_found)
                      },
                      "sourceUrl" => %{"type" => "string"},
                      "publishedAt" => %{"type" => "string"},
                      "onScreenLabel" => %{"type" => "string"}
                    },
                    "required" => ~w(time text verdict)
                  }
                },
                "sources" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "url" => %{"type" => "string"},
                      "title" => %{"type" => "string"},
                      "publishedAt" => %{"type" => "string"},
                      "retrievedAt" => %{"type" => "string"}
                    },
                    "required" => ~w(url title retrievedAt)
                  }
                },
                "brandReferences" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "name" => %{"type" => "string"},
                      "sourceUrl" => %{"type" => "string"},
                      "logoUrl" => %{"type" => "string"},
                      "colors" => %{"type" => "array", "items" => %{"type" => "string"}},
                      "notes" => %{"type" => "string"}
                    },
                    "required" => ~w(name sourceUrl colors notes)
                  }
                },
                "footageReview" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "start" => %{"type" => "number"},
                      "end" => %{"type" => "number"},
                      "crop" => %{
                        "type" => "object",
                        "properties" => %{
                          "x" => %{"type" => "number"},
                          "y" => %{"type" => "number"},
                          "width" => %{"type" => "number"},
                          "height" => %{"type" => "number"}
                        },
                        "required" => ~w(x y width height)
                      },
                      "show" => %{"type" => "string"},
                      "hide" => %{"type" => "array", "items" => %{"type" => "string"}},
                      "note" => %{"type" => "string"}
                    },
                    "required" => ~w(start end show hide note)
                  }
                },
                "sponsors" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "name" => %{"type" => "string"},
                      "confirmed" => %{"type" => "boolean"},
                      "referralUrl" => %{"type" => "string"},
                      "code" => %{"type" => "string"},
                      "disclosure" => %{"type" => "string"},
                      "review" => %{"type" => "string"}
                    },
                    "required" => ~w(name confirmed)
                  }
                },
                "thumbnailConcepts" => %{"type" => "array", "items" => %{"type" => "string"}},
                "thumbnailHeadlines" => %{"type" => "array", "items" => %{"type" => "string"}, "minItems" => 2, "maxItems" => 4},
                "chapters" => %{
                  "type" => "array",
                  "items" => %{"type" => "object", "properties" => %{"time" => %{"type" => "number"}, "title" => %{"type" => "string"}}, "required" => ~w(time title)}
                },
                "platformCopy" => %{
                  "type" => "array",
                  "items" => %{
                    "type" => "object",
                    "properties" => %{
                      "platform" => %{"type" => "string"},
                      "title" => %{"type" => "string"},
                      "description" => %{"type" => "string"},
                      "tags" => %{"type" => "array", "items" => %{"type" => "string"}},
                      "pinnedComment" => %{"type" => "string"}
                    },
                    "required" => ~w(platform title description tags pinnedComment)
                  }
                },
                "reviewItems" => %{"type" => "array", "items" => %{"type" => "string"}}
              },
              "required" => ~w(funnel claims sources brandReferences footageReview sponsors thumbnailConcepts thumbnailHeadlines platformCopy reviewItems)
            }
          },
          "required" => ["package"]
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
        "description" =>
          "End the run with your message to the user. Usually 1-3 plain sentences; when the user requested upload copy, chapters, source notes, or thumbnail concepts, include the requested deliverables with links.",
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

  def tools, do: @tools ++ @research_tools

  @doc """
  Advance a running agent run: append the client's tool results (or start the conversation from
  the brief), call the model, and return the next client tool calls or the final message.
  """
  @spec turn(VideoRun.t(), VideoSession.t(), turn_input()) :: outcome()
  def turn(%VideoRun{status: "running"} = run, %VideoSession{} = session, input) do
    with {:ok, messages} <- prepare(run, session, input) do
      loop(run, messages, session.playbook_enabled)
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
          %{
            "type" => "text",
            "text" => VideoAgentPrompts.system_prompt(),
            "cache_control" => @long_cache
          },
          %{"type" => "text", "text" => session_context(session), "cache_control" => @long_cache}
        ]
      },
      user_message(["# Brief\n" <> canonical_json(brief_data(session, run, brief))])
    ]
  end

  @doc "The cached session block. Canonical JSON, so equal data always renders identical bytes."
  def session_context(%VideoSession{} = session) do
    media = Enum.map(session.media_items || [], &model_media/1)

    profile =
      if session.creator_profile_id,
        do:
          ClippsterServer.UserBranding.get_user_creator_profile(
            session.user_id,
            session.creator_profile_id
          ),
        else: nil

    playbook =
      if session.playbook_enabled do
        {:ok, skill} = VideoAgentPrompts.skill("creator-edit-playbook")
        {:ok, workflow} = VideoAgentPrompts.skill("creator-edit-playbook/references/original-creator-workflow")
        skill <> "\n\n# Original creator workflow (required for this edit)\n\n" <> workflow
      else
        nil
      end

    "# Session context\n" <>
      canonical_json(%{
        "example" => session.reference_blueprint,
        "motionGraphics" => session.motion_graphics,
        "creatorProfileId" => session.creator_profile_id,
        "creatorProfile" =>
          if(profile,
            do:
              Map.take(profile, [
                :name,
                :description,
                :platform_links,
                :clip_build_defaults,
                :layout_overlays,
                :video_playbook,
                :creator_skill_preferences
              ]),
            else: nil
          ),
        "creatorPlaybook" => playbook,
        "media" => media,
        "sources" => model_sources(session),
        "speech" => model_speech(session)
      })
  end

  defp brief_data(session, %VideoRun{kind: "generate"} = run, brief) do
    Map.merge(brief, %{
      "kind" => "generate",
      "request" => run.request || "",
      "maxSeconds" => VideoGenerationPolicy.max_output_seconds(),
      "plan" => VideoPlanner.latest_plan(session),
      "planChat" => VideoPlanner.chat(session, @plan_chat_messages)
    })
  end

  defp brief_data(session, %VideoRun{kind: "revise"} = run, _brief) do
    %{
      "kind" => "revise",
      "request" => run.request || "",
      "maxSeconds" => VideoGenerationPolicy.max_output_seconds(),
      "plan" => VideoPlanner.latest_plan(session),
      "chat" => chat_so_far(session, run.request),
      "document" => session.document,
      "files" => (session.composition_files || %{}) |> Map.keys() |> Enum.sort()
    }
  end

  # The whole conversation, planning included. The run's own request is the newest message; the
  # brief carries it separately.
  defp chat_so_far(%VideoSession{messages: messages}, request) when is_list(messages) do
    messages =
      case List.last(messages) do
        %{role: "user", content: ^request} -> Enum.drop(messages, -1)
        _ -> messages
      end

    messages
    |> Enum.take(-@chat_messages)
    |> Enum.map(&%{"role" => &1.role, "content" => &1.content})
  end

  defp chat_so_far(_session, _request), do: []

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

      {id, if(length(segments) > 180, do: summarize_source_windows(segments), else: segments)}
    end
  end

  defp summarize_source_windows(segments) do
    segments
    |> Enum.chunk_every(15)
    |> Enum.map(fn chunk ->
      descriptions =
        chunk
        |> Enum.map(&(&1["description"] || &1["subject"]))
        |> Enum.filter(&is_binary/1)
        |> Enum.uniq()
        |> Enum.take(3)

      %{
        "start" => hd(chunk)["start"],
        "end" => List.last(chunk)["end"],
        "summary" => Enum.join(descriptions, "; "),
        "detail" => "Use read_source_window for precise cuts"
      }
    end)
  end

  defp model_speech(%VideoSession{media_items: items, speech_index: index}) do
    index = index || %{}

    for %{"id" => id, "contentHash" => hash} <- items || [], is_list(index[hash]), into: %{} do
      windows =
        index[hash]
        |> Enum.chunk_by(&(trunc(&1["start"] || 0) |> div(60)))
        |> Enum.map(fn turns ->
          %{
            "start" => hd(turns)["start"],
            "end" => List.last(turns)["end"],
            "speakers" =>
              turns
              |> Enum.filter(& &1["speakerId"])
              |> Enum.uniq_by(& &1["speakerId"])
              |> Enum.map(&Map.take(&1, ~w(speakerId speakerName speakerPosition))),
            "sample" => turns |> Enum.map(& &1["text"]) |> Enum.join(" ") |> String.slice(0, 240)
          }
        end)

      {id, windows}
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

          {:ok,
           messages ++ tool_messages ++ [user_message(["Tool results are above." | image_parts])]}
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

        answered =
          for %{"role" => "tool", "tool_call_id" => id} <- after_assistant,
              into: MapSet.new(),
              do: id

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
             %{
               "type" => "image_url",
               "image_url" => %{"url" => "data:image/jpeg;base64," <> data}
             }
           ]
         end)}
    end
  end

  defp valid_image?(%{"label" => label, "data" => data}) when is_binary(data) do
    is_binary(label) and byte_size(data) <= @max_image_base64_bytes and
      Base.decode64(data) != :error
  end

  defp valid_image?(_), do: false

  # -- Model loop --------------------------------------------------------------

  defp loop(%VideoRun{} = run, messages, playbook_enabled) do
    max_turns = VideoGenerationPolicy.max_turns(run.kind) + if(playbook_enabled && run.kind == "generate", do: 8, else: 0)

    if run.turns >= max_turns do
      {:ok, run} = VideoRuns.save_messages(run, messages)
      {:limit, run}
    else
      messages =
        if playbook_enabled && run.kind == "generate" && run.turns >= VideoGenerationPolicy.max_turns(run.kind) - 1 && !saved_playbook_package?(messages),
          do: add_playbook_nudge(messages),
          else: if(run.turns == max_turns - 1, do: add_final_turn_nudge(messages), else: messages)
      call_model(run, messages, playbook_enabled)
    end
  end

  defp call_model(run, messages, playbook_enabled) do
    model = VideoGenerationPolicy.agent_model()

    case OpenRouterChat.complete(request_payload(messages), title: "Clippster AI Video Editor") do
      {:ok, %{message: message, usage: usage}} ->
        VideoRuns.record_usage(run, model, "video_agent_#{run.kind}", usage)
        assistant = assistant_message(message)
        handle_reply(run, messages ++ [assistant], assistant, playbook_enabled)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp handle_reply(run, messages, assistant, playbook_enabled) do
    calls = assistant["tool_calls"] || []
    text = OpenRouterChat.message_text(assistant) |> String.trim()
    {client_calls, server_calls} =
      Enum.split_with(calls, &(&1["function"]["name"] in @client_tools))

    cond do
      client_calls != [] ->
        # The model can submit set_edit and finish in one response. Execute the edit first;
        # finish is only accepted after the client confirms it saved successfully.
        messages = messages ++ Enum.map(server_calls, &resolve_server_call/1)
        {:ok, run} = VideoRuns.save_turn(run, messages)
        {:tools, Enum.map(client_calls, &client_call/1), text, run}

      finish = Enum.find(calls, &(&1["function"]["name"] == "finish")) ->
        message = finish |> call_arguments() |> Map.get("message") |> present_or(text)
        finish_or_continue(run, messages, message, playbook_enabled)

      calls == [] ->
        finish_or_continue(run, messages, text, playbook_enabled)

      true ->
        messages = messages ++ Enum.map(server_calls, &resolve_server_call/1)
        {:ok, run} = VideoRuns.save_turn(run, messages)
        loop(run, messages ++ [user_message(["Continue."])], playbook_enabled)
    end
  end

  defp finish_or_continue(%VideoRun{kind: "generate"} = run, messages, message, playbook_enabled) do
    saved_edit? = Enum.any?(messages, fn
      %{"role" => "tool", "content" => "Saved and compiled:" <> _} -> true
      _ -> false
    end)

    package_saved? = !playbook_enabled || saved_playbook_package?(messages)

    if saved_edit? && package_saved? do
      finish_run(run, messages, message)
    else
      messages = messages ++ deferred_finish_results(messages)
      {:ok, run} = VideoRuns.save_turn(run, messages)
      instruction = if saved_edit?,
        do: "The edit is saved, but the required creator playbook package is missing. Call submit_playbook_package with a valid package before finishing.",
        else: "No valid edit was saved. Call set_edit with a complete valid document, fix any validation errors, then finish."
      loop(run, messages ++ [user_message([instruction])], playbook_enabled)
    end
  end

  defp finish_or_continue(run, messages, message, _playbook_enabled), do: finish_run(run, messages, message)

  defp saved_playbook_package?(messages) do
    Enum.any?(messages, fn
      %{"role" => "tool", "content" => "Saved playbook package:" <> _} -> true
      _ -> false
    end)
  end

  defp deferred_finish_results(messages) do
    messages
    |> List.last()
    |> Map.get("tool_calls", [])
    |> Enum.filter(&(&1["function"]["name"] == "finish"))
    |> Enum.map(&tool_message(&1["id"], "Finish deferred: no valid edit has been saved yet."))
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

  defp resolve_server_call(%{"id" => id, "function" => %{"name" => "finish"}}),
    do: tool_message(id, "Finish deferred until the edit tool results are processed.")

  defp resolve_server_call(%{"id" => id, "function" => %{"name" => name}}) do
    tool_message(id, "Unknown tool #{inspect(name)}.")
  end

  defp client_call(%{"id" => id, "function" => %{"name" => name}} = call) do
    args = call_arguments(call)
    args = case name do
      "set_edit" -> Map.update(args, "document", nil, &decode_object_argument/1)
      "submit_playbook_package" -> Map.update(args, "package", nil, &decode_object_argument/1)
      _ -> args
    end
    %{"id" => id, "name" => name, "arguments" => args}
  end

  # Some providers encode object-valued tool parameters as JSON strings.
  # Decode only these structured parameters; keep validation and ordinary text intact.
  defp decode_object_argument(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_map(decoded) -> decoded
      _ -> value
    end
  end
  defp decode_object_argument(value), do: value

  defp call_arguments(%{"function" => %{"arguments" => arguments}}) when is_binary(arguments) do
    case Jason.decode(arguments) do
      {:ok, decoded} when is_map(decoded) -> decoded
      _ -> %{}
    end
  end

  defp call_arguments(%{"function" => %{"arguments" => arguments}}) when is_map(arguments),
    do: arguments

  defp call_arguments(_), do: %{}

  defp add_final_turn_nudge(messages) do
    {head, [last]} = Enum.split(messages, -1)

    note = %{
      "type" => "text",
      "text" => "This is your last turn. If you have not saved a valid edit, call set_edit now. Only call finish after the edit has been saved."
    }

    head ++ [Map.update!(last, "content", &(&1 ++ [note]))]
  end

  defp add_playbook_nudge(messages) do
    messages ++ [user_message(["The required creator playbook package has not been saved. Submit it now with submit_playbook_package. Include only sourced claims; flag uncertain details for review."])]
  end

  # -- Request shape ---------------------------------------------------------------

  @doc "The OpenRouter request for the stored conversation, with conversation cache breakpoints."
  def request_payload(messages) do
    %{
      "model" => VideoGenerationPolicy.agent_model(),
      "messages" => with_conversation_breakpoints(messages),
      "tools" => tools(),
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
      "content" =>
        Enum.map(parts, fn
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
