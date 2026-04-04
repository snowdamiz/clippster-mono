defmodule ClippsterServer.Campaigns.CampaignCompletionWorker do
  @moduledoc """
  GenServer worker that periodically checks for expired campaigns and marks them as completed.
  Runs every hour to find campaigns where ends_at has passed and status is still "active".
  """
  use GenServer
  require Logger

  alias ClippsterServer.Campaigns

  @check_interval :timer.hours(1)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    Logger.info("[CampaignCompletionWorker] Starting campaign completion worker")
    # Run immediately on startup
    send(self(), :check_campaigns)
    {:ok, state}
  end

  @impl true
  def handle_info(:check_campaigns, state) do
    Logger.info("[CampaignCompletionWorker] Checking for expired campaigns")

    case Campaigns.auto_complete_expired_campaigns() do
      {:ok, count} ->
        if count > 0 do
          Logger.info("[CampaignCompletionWorker] Completed #{count} expired campaign(s)")
        else
          Logger.debug("[CampaignCompletionWorker] No expired campaigns found")
        end

      {:error, reason} ->
        Logger.error("[CampaignCompletionWorker] Error completing campaigns: #{inspect(reason)}")
    end

    schedule_next_check()
    {:noreply, state}
  end

  defp schedule_next_check do
    Process.send_after(self(), :check_campaigns, @check_interval)
  end

  @doc """
  Triggers an immediate check for expired campaigns (useful for testing).
  """
  def check_now do
    send(__MODULE__, :check_campaigns)
  end
end
