defmodule ClippsterServer.AI.VideoRunsTest do
  use ClippsterServer.DataCase, async: true

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.AI.{VideoRun, VideoRuns, VideoSessions}
  alias ClippsterServer.{Credits, Repo}

  setup do
    user = email_user_fixture() |> with_credits!(30)
    {:ok, session} = VideoSessions.create_session(user.id, %{})
    %{user: user, session: session}
  end

  defp balance(user) do
    {:ok, %{hours_remaining: remaining}} = Credits.get_user_balance(user.id)
    Decimal.to_float(remaining)
  end

  test "charges a generate run and allows only one agent run per session", %{user: user, session: session} do
    assert {:ok, %VideoRun{credits_charged: 10, request: "match it"}} = VideoRuns.start_agent_run(user.id, session, "generate", "match it")
    assert balance(user) == 20.0

    assert {:error, :run_in_progress} = VideoRuns.start_agent_run(user.id, session, "revise", "again")
    assert balance(user) == 20.0
  end

  test "reports the balance when credits run out", %{user: user, session: session} do
    {:ok, _} = Credits.deduct_credits(user.id, 25)
    assert {:error, :insufficient_credits, 5.0} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    assert balance(user) == 5.0
  end

  test "refunds failures before the edit was delivered, not after", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    assert {:ok, %VideoRun{status: "failed", refunded: true}} = VideoRuns.fail(run, "boom")
    assert balance(user) == 30.0

    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    {:ok, run} = VideoRuns.record_finish(run, %{"message" => "done"})
    assert {:ok, %VideoRun{status: "failed", refunded: false}} = VideoRuns.fail(run, "client crashed")
    assert balance(user) == 20.0
  end

  test "complete refunds a revision that changed nothing", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "revise", "x")
    assert balance(user) == 25.0
    assert {:ok, %VideoRun{status: "completed", refunded: true}} = VideoRuns.complete(run, true)
    assert balance(user) == 30.0
  end

  test "reference runs charge only when the blueprint is delivered", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_reference_run(user.id, session)
    assert balance(user) == 30.0
    assert {:ok, %VideoRun{status: "completed", credits_charged: 2}} = VideoRuns.charge_reference_run(run)
    assert balance(user) == 28.0
  end

  test "reference runs need enough credits for the edit that follows", %{user: user, session: session} do
    {:ok, _} = Credits.deduct_credits(user.id, 19)
    assert {:error, :insufficient_credits, 11.0} = VideoRuns.start_reference_run(user.id, session)
    {:ok, _} = Credits.add_credits(user.id, 1)
    assert {:ok, %VideoRun{kind: "reference"}} = VideoRuns.start_reference_run(user.id, session)
  end

  test "caps labelling calls per run", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    assert :ok = VideoRuns.reserve_label_call(run, 2)
    assert :ok = VideoRuns.reserve_label_call(run, 2)
    assert {:error, :label_limit} = VideoRuns.reserve_label_call(run, 2)
  end

  test "expires and refunds runs whose client went away", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    old = DateTime.add(DateTime.utc_now(:second), -3_600, :second)
    Repo.update_all(from(r in VideoRun, where: r.id == ^run.id), set: [updated_at: old])

    VideoRuns.expire_stale_runs(session.id)

    assert %VideoRun{status: "failed", refunded: true} = Repo.get!(VideoRun, run.id)
    assert balance(user) == 30.0
    assert {:ok, _} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
  end

  test "economics nets refunded credits against provider cost", %{user: user, session: session} do
    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "x")
    :ok = VideoRuns.record_usage(run, "anthropic/claude-opus-5.5", "video_agent_generate", %{"cost" => 1.5, "prompt_tokens" => 10})
    {:ok, _} = VideoRuns.complete(run, false)

    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "revise", "x")
    {:ok, _} = VideoRuns.fail(run, "boom")

    by_kind = Map.new(VideoRuns.economics(), &{&1.kind, &1})
    assert by_kind["generate"].credits_charged == 10
    assert Decimal.equal?(by_kind["generate"].cost_usd, Decimal.new("1.5"))
    assert by_kind["revise"].credits_charged == 0
    assert by_kind["revise"].refunded == 1
  end
end
