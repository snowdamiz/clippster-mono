defmodule ClippsterServer.AI.VideoAgentTest do
  use ClippsterServer.DataCase, async: false

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.AI.{AiUsageLog, VideoAgent, VideoGenerationPolicy, VideoRun, VideoRuns, VideoSessions}
  alias ClippsterServer.Repo

  setup do
    previous = Application.get_env(:clippster_server, :openrouter_http_client)
    previous_key = System.get_env("OPENROUTER_API_KEY")
    System.put_env("OPENROUTER_API_KEY", "test-key")
    test_pid = self()

    Application.put_env(:clippster_server, :openrouter_http_client, fn _url, body, _headers, _opts ->
      send(test_pid, {:openrouter_request, Jason.decode!(body)})
      [response | rest] = Process.get(:openrouter_responses, [])
      Process.put(:openrouter_responses, rest)
      {:ok, %{status_code: 200, body: Jason.encode!(response)}}
    end)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:clippster_server, :openrouter_http_client, previous),
        else: Application.delete_env(:clippster_server, :openrouter_http_client)

      if previous_key, do: System.put_env("OPENROUTER_API_KEY", previous_key), else: System.delete_env("OPENROUTER_API_KEY")
    end)

    user = email_user_fixture() |> with_credits!(100)

    {:ok, session} =
      VideoSessions.create_session(user.id, %{
        media_items: [
          %{"id" => "m1", "name" => "drive.mp4", "kind" => "video", "duration" => 40.0, "contentHash" => "h1", "path" => "C:/clips/drive.mp4"}
        ],
        reference_blueprint: %{"duration" => 12.0, "shots" => [%{"index" => 0, "start" => 0, "end" => 2.5}]},
        source_index: %{"h1" => %{"0" => %{"segments" => [%{"index" => 0, "start" => 0, "end" => 4, "description" => "Car on road"}]}}}
      })

    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "Make these match the example")
    %{user: user, session: session, run: run}
  end

  defp queue(responses), do: Process.put(:openrouter_responses, responses)

  defp completion(message, cost) do
    %{
      "choices" => [%{"message" => Map.put(message, "role", "assistant"), "finish_reason" => "stop"}],
      "usage" => %{
        "prompt_tokens" => 12_000,
        "completion_tokens" => 800,
        "total_tokens" => 12_800,
        "cost" => cost,
        "prompt_tokens_details" => %{"cached_tokens" => 9_000, "cache_write_tokens" => 3_000}
      }
    }
  end

  defp tool_call(id, name, args), do: %{"id" => id, "type" => "function", "function" => %{"name" => name, "arguments" => Jason.encode!(args)}}

  defp strip_breakpoints(messages) do
    Enum.map(messages, fn
      %{"content" => parts} = message when is_list(parts) -> %{message | "content" => Enum.map(parts, &Map.delete(&1, "cache_control"))}
      message -> message
    end)
  end

  defp breakpoints(payload) do
    for %{"content" => parts} when is_list(parts) <- payload["messages"], part <- parts, part["cache_control"], do: part["cache_control"]
  end

  test "runs a generate turn loop with a stable cached prefix", %{session: session, run: run} do
    queue([
      completion(
        %{
          "content" => nil,
          "reasoning_details" => [%{"type" => "reasoning.encrypted", "data" => "sig"}],
          "tool_calls" => [
            tool_call("call_1", "read_skill", %{"name" => "hyperframes-core/references/sub-compositions"}),
            tool_call("call_2", "write_file", %{"path" => "compositions/title.html", "content" => "<html></html>"})
          ]
        },
        0.5
      )
    ])

    assert {:tools, [%{"id" => "call_2", "name" => "write_file", "arguments" => %{"path" => "compositions/title.html"}}], "", run} =
             VideoAgent.turn(run, session, %{brief: %{"format" => %{"width" => 1920, "height" => 1080, "fps" => 30}, "candidates" => []}})

    assert_received {:openrouter_request, first}
    assert first["model"] == VideoGenerationPolicy.agent_model()
    assert first["reasoning"] == %{"effort" => "medium"}
    assert Enum.map(first["tools"], & &1["function"]["name"]) |> Enum.member?("finish")

    [system | _] = first["messages"]
    assert [%{"cache_control" => %{"ttl" => "1h"}}, %{"cache_control" => %{"ttl" => "1h"}, "text" => context}] = system["content"]
    refute context =~ "C:/clips", "local paths must not reach the model"
    assert context =~ "Car on road"
    assert length(breakpoints(first)) == 3

    queue([completion(%{"content" => "", "tool_calls" => [tool_call("call_3", "finish", %{"message" => "Here's your video."})]}, 0.25)])

    image = %{"label" => "1.0s yours vs example", "data" => Base.encode64("jpeg-bytes")}

    assert {:finish, "Here's your video.", run} =
             VideoAgent.turn(run, session, %{results: [%{"id" => "call_2", "content" => "Wrote compositions/title.html", "images" => [image]}]})

    assert_received {:openrouter_request, second}
    assert second["messages"] |> strip_breakpoints() |> Enum.take(length(first["messages"])) == strip_breakpoints(first["messages"])
    assert hd(second["messages"]) == hd(first["messages"])
    assert length(breakpoints(second)) == 4

    skill_result = Enum.find(second["messages"], &(&1["tool_call_id"] == "call_1"))
    assert skill_result["content"] =~ "sub-composition"
    assistant = Enum.find(second["messages"], &(&1["role"] == "assistant"))
    assert assistant["reasoning_details"] == [%{"type" => "reasoning.encrypted", "data" => "sig"}]
    last_user = List.last(second["messages"])
    assert Enum.any?(last_user["content"], &(&1["type"] == "image_url"))

    run = Repo.get!(VideoRun, run.id)
    assert run.turns == 2
    assert run.finish == %{"message" => "Here's your video."}
    assert Decimal.equal?(run.cost_usd, Decimal.new("0.75"))

    logs = Repo.all(from l in AiUsageLog, where: l.ai_video_run_id == ^run.id)
    assert length(logs) == 2
    assert Enum.all?(logs, &(&1.cached_tokens == 9_000 and &1.cache_write_tokens == 3_000))
  end

  test "rejects results that don't answer the pending calls", %{session: session, run: run} do
    queue([completion(%{"content" => nil, "tool_calls" => [tool_call("call_1", "check", %{})]}, 0.1)])
    assert {:tools, _, _, run} = VideoAgent.turn(run, session, %{brief: %{}})

    assert {:error, :invalid, _} = VideoAgent.turn(run, session, %{results: [%{"id" => "other", "content" => "x"}]})
    assert {:error, :invalid, _} = VideoAgent.turn(run, session, %{results: []})
  end

  test "nudges on the last turn and stops at the limit", %{session: session, run: run} do
    max_turns = VideoGenerationPolicy.max_turns("generate")
    run = run |> VideoRun.changeset(%{turns: max_turns - 1}) |> Repo.update!()

    queue([completion(%{"content" => nil, "tool_calls" => [tool_call("call_1", "check", %{})]}, 0.1)])
    assert {:tools, _, _, run} = VideoAgent.turn(run, session, %{brief: %{}})

    assert_received {:openrouter_request, payload}
    assert payload["messages"] |> List.last() |> Map.fetch!("content") |> Enum.any?(&(&1["text"] =~ "last turn"))

    assert {:limit, _run} = VideoAgent.turn(run, session, %{results: [%{"id" => "call_1", "content" => "ok"}]})
    refute_received {:openrouter_request, _}
  end

  test "a revision continues the whole conversation and sees the plan", %{user: user, session: session, run: run} do
    {:ok, _} = VideoRuns.fail(run, "Cancelled")
    plan = %{"title" => "Acme Launch", "seconds" => 20, "beats" => []}
    {:ok, _} = VideoSessions.create_message(session.id, "user", "A launch video for acme", %{"phase" => "plan"})
    {:ok, _} = VideoSessions.create_message(session.id, "assistant", "Here is the plan.", %{"phase" => "plan", "plan" => plan})
    {:ok, revise} = VideoRuns.start_agent_run(user.id, session, "revise", "Make it shorter")
    {:ok, _} = VideoSessions.create_message(session.id, "user", "Make it shorter", %{"run_id" => revise.id})

    queue([completion(%{"content" => nil, "tool_calls" => [tool_call("call_1", "check", %{})]}, 0.1)])
    assert {:tools, _, _, _} = VideoAgent.turn(revise, VideoSessions.with_messages(session), %{brief: %{}})

    assert_received {:openrouter_request, payload}
    sent = Jason.encode!(payload["messages"])
    assert sent =~ "A launch video for acme"
    assert sent =~ "Stopped. You weren't charged."
    assert sent =~ "Acme Launch"
    assert length(String.split(sent, "Make it shorter")) == 2, "the request is sent once, not repeated in the chat"
  end

  test "session context is canonical regardless of key order", %{session: session} do
    reordered = %{
      session
      | reference_blueprint: session.reference_blueprint |> Enum.reverse() |> Map.new(),
        media_items: Enum.map(session.media_items, &(&1 |> Enum.reverse() |> Map.new()))
    }

    assert VideoAgent.session_context(session) == VideoAgent.session_context(reordered)
    assert VideoAgent.canonical_json(%{"b" => 1, "a" => %{"d" => 2, "c" => 3}}) == ~s({"a":{"c":3,"d":2},"b":1})
  end
end
