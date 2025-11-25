defmodule ClippsterServer.AI do
  @moduledoc """
  The AI context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.AI.AiUsageLog

  @doc """
  Logs AI usage.
  """
  def log_usage(attrs \\ %{}) do
    %AiUsageLog{}
    |> AiUsageLog.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Returns aggregated AI usage statistics and recent logs.
  """
  def get_usage_stats do
    # Aggregate total tokens
    total_tokens =
      AiUsageLog
      |> select([l], sum(l.total_tokens))
      |> Repo.one() || 0

    # Aggregate total duration
    total_duration =
      AiUsageLog
      |> select([l], sum(l.duration_seconds))
      |> Repo.one() || Decimal.new(0)

    # Aggregate by provider
    provider_stats =
      AiUsageLog
      |> group_by([l], l.provider)
      |> select([l], %{
        provider: l.provider,
        count: count(l.id),
        total_tokens: sum(l.total_tokens),
        total_duration: sum(l.duration_seconds)
      })
      |> Repo.all()

    # Aggregate by provider and model
    model_stats =
      AiUsageLog
      |> group_by([l], [l.provider, l.model])
      |> select([l], %{
        provider: l.provider,
        model: l.model,
        count: count(l.id),
        total_tokens: sum(l.total_tokens),
        total_duration: sum(l.duration_seconds)
      })
      |> Repo.all()

    # Aggregate by operation type
    operation_stats =
      AiUsageLog
      |> group_by([l], l.operation_type)
      |> select([l], %{
        operation: l.operation_type,
        count: count(l.id),
        total_tokens: sum(l.total_tokens),
        total_duration: sum(l.duration_seconds)
      })
      |> Repo.all()

    # Recent logs
    recent_logs =
      AiUsageLog
      |> order_by([l], desc: l.inserted_at)
      |> limit(50)
      |> preload(:user)
      |> Repo.all()

    %{
      total_tokens: total_tokens,
      total_duration: total_duration,
      provider_stats: provider_stats,
      model_stats: model_stats,
      operation_stats: operation_stats,
      recent_logs: recent_logs
    }
  end
end
