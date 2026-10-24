defmodule ClippsterServer.AI.VideoRuns do
  @moduledoc """
  Paid AI video runs: credit charging and refunds, the stored agent conversation, and
  per-run cost tracking for every model call.
  """

  import Ecto.Query, warn: false
  require Logger

  alias ClippsterServer.{AI, Credits, Repo}
  alias ClippsterServer.AI.{OpenRouterChat, VideoGenerationPolicy, VideoRun, VideoSession}

  # A run whose client vanished (app closed, crash) is failed and refunded after this long.
  @stale_after_seconds 20 * 60

  @doc "Charge for and open a generate/revise run. Only one may run per session at a time."
  def start_agent_run(user_id, %VideoSession{} = session, kind, request) when kind in ~w(generate revise) do
    expire_stale_runs(session.id)
    cost = VideoGenerationPolicy.credit_cost(kind)

    Repo.transaction(fn ->
      with {:ok, _} <- Credits.deduct_credits(user_id, cost),
           {:ok, run} <-
             %VideoRun{}
             |> VideoRun.changeset(%{
               kind: kind,
               status: "running",
               request: request,
               credits_charged: cost,
               session_id: session.id,
               user_id: user_id
             })
             |> Repo.insert() do
        run
      else
        {:error, %Ecto.Changeset{errors: errors}} ->
          if Keyword.has_key?(errors, :session_id),
            do: Repo.rollback(:run_in_progress),
            else: Repo.rollback(:insufficient_credits)

        {:error, _} ->
          Repo.rollback(:insufficient_credits)
      end
    end)
    |> normalize_start(user_id)
  end

  @doc """
  Open an example-analysis run. Nothing is charged until the blueprint is delivered. The example
  is analysed as the first step of a new edit, so the balance must cover that edit too.
  """
  def start_reference_run(user_id, %VideoSession{} = session) do
    required = VideoGenerationPolicy.credit_cost("reference") + VideoGenerationPolicy.credit_cost("generate")

    if balance(user_id) >= required do
      %VideoRun{}
      |> VideoRun.changeset(%{
        kind: "reference",
        status: "running",
        session_id: session.id,
        user_id: user_id
      })
      |> Repo.insert()
    else
      {:error, :insufficient_credits, balance(user_id)}
    end
  end

  @doc "Charge the analysis fee and close the reference run."
  def charge_reference_run(%VideoRun{kind: "reference", status: "running"} = run) do
    cost = VideoGenerationPolicy.credit_cost("reference")

    Repo.transaction(fn ->
      case Credits.deduct_credits(run.user_id, cost) do
        {:ok, _} ->
          run
          |> VideoRun.changeset(%{status: "completed", credits_charged: cost})
          |> Repo.update!()

        {:error, _} ->
          Repo.rollback(:insufficient_credits)
      end
    end)
    |> normalize_start(run.user_id)
  end

  def get_user_run(run_id, user_id) do
    VideoRun
    |> where([r], r.id == ^run_id and r.user_id == ^user_id)
    |> Repo.one()
  end

  def running_agent_run(session_id) do
    VideoRun
    |> where([r], r.session_id == ^session_id and r.status == "running")
    |> where([r], r.kind in ["generate", "revise"])
    |> Repo.one()
  end

  @doc "Reserve one labelling call against the run's cap."
  def reserve_label_call(%VideoRun{id: id}, max) do
    case VideoRun
         |> where([r], r.id == ^id and r.status == "running" and r.label_calls < ^max)
         |> update([r], inc: [label_calls: 1], set: [updated_at: ^now()])
         |> Repo.update_all([]) do
      {1, _} -> :ok
      {0, _} -> {:error, :label_limit}
    end
  end

  @doc "Persist the conversation after a model turn."
  def save_turn(%VideoRun{} = run, messages) do
    run
    |> VideoRun.changeset(%{messages: messages, turns: run.turns + 1})
    |> Repo.update()
  end

  @doc "Persist the conversation without counting a model turn."
  def save_messages(%VideoRun{} = run, messages) do
    run
    |> VideoRun.changeset(%{messages: messages})
    |> Repo.update()
  end

  def record_finish(%VideoRun{} = run, finish) do
    run
    |> VideoRun.changeset(%{finish: finish})
    |> Repo.update()
  end

  @doc "Close a run successfully. `refund?` returns the credits when the run changed nothing."
  def complete(%VideoRun{} = run, refund?) do
    if refund?, do: refund(run)

    run
    |> VideoRun.changeset(%{status: "completed", refunded: refund? or run.refunded})
    |> Repo.update()
  end

  @doc "Fail a run. Credits come back unless the model already delivered a finished edit."
  def fail(%VideoRun{status: "running"} = run, reason) do
    refund? = is_nil(run.finish) and run.credits_charged > 0 and not run.refunded
    if refund?, do: refund(run)

    run
    |> VideoRun.changeset(%{
      status: "failed",
      error: String.slice(to_string(reason), 0, 2_000),
      refunded: refund? or run.refunded
    })
    |> Repo.update()
  end

  def fail(%VideoRun{} = run, _reason), do: {:ok, run}

  @doc "Fail and refund agent runs whose client stopped reporting back."
  def expire_stale_runs(session_id) do
    cutoff = DateTime.add(DateTime.utc_now(), -@stale_after_seconds, :second)

    VideoRun
    |> where([r], r.session_id == ^session_id and r.status == "running")
    |> where([r], r.updated_at < ^cutoff)
    |> Repo.all()
    |> Enum.each(&fail(&1, "The app stopped responding before the edit finished."))
  end

  @doc "Log one model call against the run and add its cost to the run total."
  def record_usage(%VideoRun{} = run, model, operation, usage) do
    attrs = OpenRouterChat.usage_log_attrs(usage)

    AI.log_usage(
      Map.merge(attrs, %{
        user_id: run.user_id,
        project_id: run.session_id && "ai-video-#{run.session_id}",
        provider: "openrouter",
        model: model,
        operation_type: operation,
        ai_video_run_id: run.id
      })
    )
    |> case do
      {:ok, _} -> :ok
      {:error, changeset} -> Logger.error("[VideoRuns] usage log failed: #{inspect(changeset.errors)}")
    end

    VideoRun
    |> where([r], r.id == ^run.id)
    |> update([r], inc: [cost_usd: ^attrs.cost_usd], set: [updated_at: ^now()])
    |> Repo.update_all([])

    :ok
  end

  @doc "Cost versus credits per run kind, for the admin economics report."
  def economics(since \\ nil) do
    VideoRun
    |> then(fn query -> if since, do: where(query, [r], r.inserted_at >= ^since), else: query end)
    |> group_by([r], r.kind)
    |> select([r], %{
      kind: r.kind,
      runs: count(r.id),
      failed: filter(count(r.id), r.status == "failed"),
      refunded: filter(count(r.id), r.refunded),
      credits_charged: coalesce(sum(fragment("CASE WHEN ? THEN 0 ELSE ? END", r.refunded, r.credits_charged)), 0),
      cost_usd: coalesce(sum(r.cost_usd), 0),
      avg_turns: avg(r.turns)
    })
    |> Repo.all()
  end

  defp refund(%VideoRun{credits_charged: credits, user_id: user_id}) when credits > 0 do
    case Credits.add_credits(user_id, credits) do
      {:ok, _} -> :ok
      error -> Logger.error("[VideoRuns] refund failed for user #{user_id}: #{inspect(error)}")
    end
  end

  defp refund(_run), do: :ok

  defp balance(user_id) do
    case Credits.get_user_balance(user_id) do
      {:ok, %{hours_remaining: remaining}} -> Decimal.to_float(remaining)
      _ -> 0.0
    end
  end

  defp normalize_start({:ok, run}, _user_id), do: {:ok, run}

  defp normalize_start({:error, :insufficient_credits}, user_id),
    do: {:error, :insufficient_credits, balance(user_id)}

  defp normalize_start({:error, reason}, _user_id), do: {:error, reason}

  defp now, do: DateTime.utc_now(:second)
end
