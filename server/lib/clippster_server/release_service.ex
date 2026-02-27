defmodule ClippsterServer.ReleaseService do
  @moduledoc """
  Service for fetching and caching the latest app release information from GitHub.
  Uses ETS for caching with a configurable TTL.
  """
  use GenServer
  require Logger

  @cache_table :release_cache
  @cache_ttl :timer.minutes(5)
  @github_repo "snowdamiz/clippster-releases"
  @github_api_url "https://api.github.com/repos/#{@github_repo}/releases/latest"

  # Platform asset configurations
  @platform_assets %{
    "mac-arm64" => %{suffix: "_aarch64.dmg", label: "Mac (Apple Silicon)"},
    "mac-x64" => %{suffix: "_x64.dmg", label: "Mac (Intel)"},
    "windows-x64" => %{suffix: "_x64-setup.exe", label: "Windows"}
  }

  # Client API

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Get the latest release information with download URLs.
  Returns cached data if available and not expired, otherwise fetches from GitHub.
  """
  def get_latest_release do
    case get_cached_release() do
      {:ok, release} ->
        {:ok, release}

      :miss ->
        # Fetch in background and return what we can
        GenServer.cast(__MODULE__, :refresh)
        # Try to fetch synchronously for the first request
        fetch_and_cache_release()
    end
  end

  @doc """
  Force refresh the release cache.
  """
  def refresh do
    GenServer.cast(__MODULE__, :refresh)
  end

  # Server callbacks

  @impl true
  def init(_) do
    # Create ETS table for caching
    :ets.new(@cache_table, [:named_table, :public, read_concurrency: true])

    # Fetch release info on startup
    spawn(fn -> fetch_and_cache_release() end)

    # Schedule periodic refresh
    schedule_refresh()

    {:ok, %{}}
  end

  @impl true
  def handle_cast(:refresh, state) do
    fetch_and_cache_release()
    {:noreply, state}
  end

  @impl true
  def handle_info(:refresh, state) do
    fetch_and_cache_release()
    schedule_refresh()
    {:noreply, state}
  end

  # Private functions

  defp schedule_refresh do
    Process.send_after(self(), :refresh, @cache_ttl)
  end

  defp get_cached_release do
    case :ets.lookup(@cache_table, :release) do
      [{:release, release, expires_at}] ->
        if System.system_time(:millisecond) < expires_at do
          {:ok, release}
        else
          :miss
        end

      [] ->
        :miss
    end
  end

  defp fetch_and_cache_release do
    case fetch_github_release() do
      {:ok, release} ->
        expires_at = System.system_time(:millisecond) + @cache_ttl
        :ets.insert(@cache_table, {:release, release, expires_at})
        {:ok, release}

      {:error, reason} ->
        Logger.warning("Failed to fetch GitHub release: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp fetch_github_release do
    headers = [
      {"Accept", "application/vnd.github.v3+json"},
      {"User-Agent", "Clippster-Server"}
    ]

    case Req.get(@github_api_url, headers: headers, receive_timeout: 10_000) do
      {:ok, %{status: 200, body: body}} ->
        parse_release(body)

      {:ok, %{status: status}} ->
        {:error, "GitHub API returned status #{status}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp parse_release(body) do
    version = body["tag_name"] |> String.replace_leading("v", "")

    downloads =
      Enum.map(@platform_assets, fn {platform_key, %{suffix: suffix, label: label}} ->
        filename = "Clippster_#{version}#{suffix}"

        download_url =
          "https://github.com/#{@github_repo}/releases/download/v#{version}/#{filename}"

        %{
          platform: platform_key,
          label: label,
          filename: filename,
          download_url: download_url
        }
      end)

    release = %{
      version: version,
      tag: body["tag_name"],
      published_at: body["published_at"],
      downloads: downloads
    }

    {:ok, release}
  end
end
