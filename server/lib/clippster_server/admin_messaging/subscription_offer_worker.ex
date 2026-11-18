defmodule ClippsterServer.AdminMessaging.SubscriptionOfferWorker do
  @moduledoc false
  use GenServer
  require Logger

  def start_link(_opts), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @impl true
  def init(state) do
    schedule()
    {:ok, state}
  end

  @impl true
  def handle_info(:send_offers, state) do
    try do
      ClippsterServer.AdminMessaging.process_queued_offers()
    rescue
      error -> Logger.error(Exception.format(:error, error, __STACKTRACE__))
    after
      schedule()
    end

    {:noreply, state}
  end

  defp schedule, do: Process.send_after(self(), :send_offers, 5_000)
end
