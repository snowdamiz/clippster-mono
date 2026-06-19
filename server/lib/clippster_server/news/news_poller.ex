defmodule ClippsterServer.News.NewsPoller do
  @moduledoc """
  GenServer that polls TheNewsAPI every 25 minutes to fetch breaking news.
  Also performs cleanup of old articles every hour.
  """
  use GenServer
  require Logger

  alias ClippsterServer.News

  @poll_interval :timer.minutes(25)
  @cleanup_interval :timer.hours(1)
  @article_retention_hours 24

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    # Schedule initial fetch after 10 seconds to allow app to fully start
    Process.send_after(self(), :fetch_news, :timer.seconds(10))

    # Schedule cleanup
    Process.send_after(self(), :cleanup_old_articles, @cleanup_interval)

    {:ok, %{last_fetch: nil, fetch_count: 0}}
  end

  @impl true
  def handle_info(:fetch_news, state) do
    Logger.info("NewsPoller: Fetching breaking news from TheNewsAPI")

    case News.fetch_and_store_breaking_news(limit: 20) do
      {:ok, count} ->
        Logger.info("NewsPoller: Successfully stored #{count} articles")
        new_state = %{state | last_fetch: DateTime.utc_now(), fetch_count: state.fetch_count + 1}

        # Schedule next fetch in 25 minutes
        Process.send_after(self(), :fetch_news, @poll_interval)
        {:noreply, new_state}

      {:error, :api_key_not_configured} ->
        Logger.warning("NewsPoller: API key not configured, will retry in 25 minutes")
        Process.send_after(self(), :fetch_news, @poll_interval)
        {:noreply, state}

      {:error, reason} ->
        Logger.error(
          "NewsPoller: Failed to fetch news: #{inspect(reason)}, will retry in 25 minutes"
        )

        Process.send_after(self(), :fetch_news, @poll_interval)
        {:noreply, state}
    end
  end

  @impl true
  def handle_info(:cleanup_old_articles, state) do
    Logger.info("NewsPoller: Cleaning up articles older than #{@article_retention_hours} hours")

    count = News.delete_old_articles(@article_retention_hours)
    Logger.info("NewsPoller: Deleted #{count} old articles")

    # Schedule next cleanup
    Process.send_after(self(), :cleanup_old_articles, @cleanup_interval)
    {:noreply, state}
  end

  @doc """
  Manually trigger a news fetch (useful for testing or admin actions).
  """
  def fetch_now do
    GenServer.cast(__MODULE__, :fetch_now)
  end

  @impl true
  def handle_cast(:fetch_now, state) do
    send(self(), :fetch_news)
    {:noreply, state}
  end

  @doc """
  Get the current state of the poller.
  """
  def get_state do
    GenServer.call(__MODULE__, :get_state)
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state, state}
  end
end
