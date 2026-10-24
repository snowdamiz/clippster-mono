defmodule ClippsterServerWeb.AIVideoPlanTest do
  use ClippsterServerWeb.ConnCase, async: false

  import ClippsterServer.AccountsFixtures
  import Ecto.Query

  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.{Credits, Repo}
  alias ClippsterServer.AI.{VideoAgent, VideoRun, VideoRuns, VideoSessions}

  @media [%{"id" => "m1", "name" => "demo.mp4", "kind" => "video", "duration" => 30.0, "contentHash" => "h1"}]

  setup %{conn: conn} do
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

    user = email_user_fixture() |> Ecto.Changeset.change(is_admin: true) |> Repo.update!() |> with_credits!(50)
    {:ok, session} = VideoSessions.create_session(user.id, %{media_items: @media})
    %{conn: auth_conn(conn, user), user: user, session: session}
  end

  defp auth_conn(conn, user) do
    {:ok, token} =
      TokenGenerator.generate_token(%{
        "sub" => "#{user.provider}:#{user.provider_id}",
        "user_id" => user.id,
        "provider" => user.provider,
        "provider_id" => user.provider_id,
        "email" => user.email,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(1, :day) |> DateTime.to_unix()
      })

    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp queue(responses), do: Process.put(:openrouter_responses, responses)

  defp completion(message) do
    %{
      "choices" => [%{"message" => Map.put(message, "role", "assistant"), "finish_reason" => "stop"}],
      "usage" => %{"prompt_tokens" => 9_000, "completion_tokens" => 300, "total_tokens" => 9_300, "cost" => 0.02}
    }
  end

  defp set_plan(id, plan, text \\ nil) do
    completion(%{
      "content" => text,
      "tool_calls" => [%{"id" => id, "type" => "function", "function" => %{"name" => "set_plan", "arguments" => Jason.encode!(%{"plan" => plan})}}]
    })
  end

  defp plan(seconds) do
    %{
      "title" => "Acme launch",
      "aspect" => "9:16",
      "notes" => "Launches Nov 3. Call to action: acme.app",
      "beats" => [
        %{"seconds" => seconds, "kind" => "scene", "what" => "Logo slams in", "words" => "ACME IS HERE"},
        %{"seconds" => 6, "kind" => "footage", "what" => "The app in use", "media" => ["m1", "nope"]}
      ]
    }
  end

  defp balance(user) do
    {:ok, %{hours_remaining: remaining}} = Credits.get_user_balance(user.id)
    Decimal.to_float(remaining)
  end

  defp plan_runs(session), do: Repo.all(from r in VideoRun, where: r.session_id == ^session.id and r.kind == "plan")

  test "plans for free: retries an invalid plan, saves it, sets the shape and keeps one planning run", %{conn: conn, user: user, session: session} do
    queue([set_plan("call_1", plan(70)), set_plan("call_2", plan(3), "Here's a first plan for TikTok.")])

    planned = conn |> post(~p"/api/ai/video/sessions/#{session.id}/plan", %{message: "A launch video for Acme on TikTok"}) |> json_response(200)

    assert_received {:openrouter_request, first}
    assert [%{"cache_control" => %{"ttl" => "1h"}}, %{"cache_control" => %{"ttl" => "1h"}}] = hd(first["messages"])["content"]
    assert List.last(first["messages"])["content"] =~ ~s("currentPlan":null)
    assert_received {:openrouter_request, retry}
    assert List.last(retry["messages"])["content"] =~ "Plan not saved: The beats add up to 76.0 s"

    assert planned["aspect_ratio"] == "9:16"
    assert [%{"role" => "user", "metadata" => %{"phase" => "plan"}}, %{"role" => "assistant", "content" => content, "metadata" => metadata}] = planned["messages"]
    assert content == "Here's a first plan for TikTok."
    assert %{"title" => "Acme launch", "seconds" => 9.0, "beats" => [_, %{"media" => ["m1"]}]} = metadata["plan"]
    assert balance(user) == 50.0

    queue([completion(%{"content" => "Sure, it ends on acme.app."})])
    again = conn |> post(~p"/api/ai/video/sessions/#{session.id}/plan", %{message: "End on the link"}) |> json_response(200)

    assert_received {:openrouter_request, second}
    assert [_system, %{"role" => "user"}, %{"role" => "assistant", "content" => "Here's a first plan for TikTok."}, last] = second["messages"]
    assert last["content"] =~ ~s("title":"Acme launch")
    assert length(again["messages"]) == 4
    assert [%VideoRun{status: "running", turns: 3, credits_charged: 0}] = plan_runs(session)

    %{"run" => run} = conn |> post(~p"/api/ai/video/sessions/#{session.id}/runs", %{kind: "generate", request: "Build this video."}) |> json_response(200)
    assert [%VideoRun{status: "completed"}] = plan_runs(session)

    [_system, brief] = VideoAgent.initial_messages(VideoSessions.with_messages(VideoSessions.get_session!(session.id)), Repo.get!(VideoRun, run["id"]), %{})
    [%{"text" => "# Brief\n" <> json}] = brief["content"]
    data = Jason.decode!(json)
    assert data["plan"]["title"] == "Acme launch"
    assert Enum.map(data["planChat"], & &1["content"]) == ["A launch video for Acme on TikTok", "Here's a first plan for TikTok.", "End on the link", "Sure, it ends on acme.app."]
  end

  test "labels clips on the planning run before a build and on the build while it runs", %{conn: conn, session: session} do
    label = fn ->
      queue([completion(%{"content" => Jason.encode!(%{"segments" => [%{"index" => 0, "description" => "App demo", "quality" => "good"}]})})])

      conn
      |> post(~p"/api/ai/video/sessions/#{session.id}/label-source", %{
        content_hash: "h1",
        chunk_key: "0-0",
        chunk_start: 0,
        kind: "video",
        media: Base.encode64("mp4"),
        segments: [%{index: 0, start: 0, end: 4}]
      })
      |> json_response(200)
    end

    assert %{"segments" => [%{"description" => "App demo"}]} = label.()
    assert [%VideoRun{label_calls: 1}] = plan_runs(session)
    assert %{"h1" => %{"0-0" => %{"segments" => [_]}}} = VideoSessions.get_session!(session.id).source_index

    %{"run" => run} = conn |> post(~p"/api/ai/video/sessions/#{session.id}/runs", %{kind: "generate", request: "Go"}) |> json_response(200)
    label.()
    assert %VideoRun{label_calls: 1} = Repo.get!(VideoRun, run["id"])
  end

  test "planning needs credits for the build, an analyzed example and no running build", %{conn: conn, user: user, session: session} do
    {:ok, _} = Credits.deduct_credits(user.id, 45)
    poor = conn |> post(~p"/api/ai/video/sessions/#{session.id}/plan", %{message: "Hi"})
    assert json_response(poor, 402)["remaining"] == 5.0

    {:ok, _} = Credits.add_credits(user.id, 45)
    {:ok, _} = VideoSessions.update_session(session, %{reference: %{"path" => "a.mp4"}})
    unanalyzed = conn |> post(~p"/api/ai/video/sessions/#{session.id}/plan", %{message: "Hi"})
    assert json_response(unanalyzed, 422)["error"] =~ "analyzed"

    {:ok, _} = VideoSessions.update_session(VideoSessions.get_session!(session.id), %{reference: nil})
    {:ok, _} = VideoRuns.start_agent_run(user.id, session, "generate", "Go")
    assert json_response(conn |> post(~p"/api/ai/video/sessions/#{session.id}/plan", %{message: "Hi"}), 409)
    assert plan_runs(session) == []
  end
end
