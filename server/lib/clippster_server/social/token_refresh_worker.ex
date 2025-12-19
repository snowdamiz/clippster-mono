defmodule ClippsterServer.Social.TokenRefreshWorker do
  @moduledoc """
  GenServer worker that periodically refreshes OAuth tokens before they expire.
  
  Instagram long-lived tokens last 60 days and can be refreshed within the last
  day before expiry to extend them for another 60 days.
  """

  use GenServer
  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.{SocialAccount, Platform}

  @default_interval :timer.hours(12)

  # ============================================================================
  # Public API
  # ============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Triggers an immediate token refresh check.
  """
  def refresh_now do
    GenServer.cast(__MODULE__, :refresh_now)
  end

  @doc """
  Refreshes tokens for a specific account.
  """
  def refresh_account(account_id) do
    GenServer.cast(__MODULE__, {:refresh_account, account_id})
  end

  # ============================================================================
  # GenServer Callbacks
  # ============================================================================

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)
    
    # Schedule first check after app starts
    if Keyword.get(opts, :start_immediately, true) do
      Process.send_after(self(), :refresh, :timer.minutes(5))
    end

    Logger.info("[TokenRefreshWorker] Started with interval: #{div(interval, 3_600_000)} hours")

    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_cast(:refresh_now, state) do
    send(self(), :refresh)
    {:noreply, state}
  end

  @impl true
  def handle_cast({:refresh_account, account_id}, state) do
    Task.start(fn ->
      case Social.get_social_account(account_id) do
        nil ->
          Logger.warning("[TokenRefreshWorker] Account not found: #{account_id}")
        account ->
          refresh_account_tokens(account)
      end
    end)
    {:noreply, state}
  end

  @impl true
  def handle_info(:refresh, state) do
    Logger.info("[TokenRefreshWorker] Checking for tokens that need refresh")
    
    Task.start(fn ->
      accounts = Social.get_accounts_needing_refresh()
      Logger.info("[TokenRefreshWorker] Found #{length(accounts)} accounts needing refresh")
      
      Enum.each(accounts, fn account ->
        refresh_account_tokens(account)
        # Small delay between refreshes to avoid rate limits
        Process.sleep(:timer.seconds(1))
      end)
    end)

    # Schedule next check
    Process.send_after(self(), :refresh, state.interval)

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp refresh_account_tokens(%SocialAccount{} = account) do
    Logger.info("[TokenRefreshWorker] Refreshing tokens for account #{account.id} (#{account.platform})")

    access_token = SocialAccount.get_access_token(account)

    with {:ok, platform_module} <- Platform.get_platform_module(account.platform),
         {:ok, new_tokens} <- platform_module.refresh_tokens(access_token) do
      
      # Calculate new expiry
      expires_at = if new_tokens[:expires_in] do
        DateTime.utc_now()
        |> DateTime.add(new_tokens[:expires_in], :second)
        |> DateTime.truncate(:second)
      else
        nil
      end

      attrs = %{
        access_token: new_tokens[:access_token],
        token_expires_at: expires_at
      }

      # Add refresh token if provided
      attrs = if new_tokens[:refresh_token] do
        Map.put(attrs, :refresh_token, new_tokens[:refresh_token])
      else
        attrs
      end

      case Social.refresh_social_account_tokens(account, attrs) do
        {:ok, _updated} ->
          Logger.info("[TokenRefreshWorker] Successfully refreshed account #{account.id}")
          :ok

        {:error, reason} ->
          Logger.error("[TokenRefreshWorker] Failed to update account #{account.id}: #{inspect(reason)}")
          {:error, reason}
      end
    else
      {:error, :not_implemented} ->
        Logger.debug("[TokenRefreshWorker] Token refresh not implemented for #{account.platform}")
        {:error, :not_implemented}

      {:error, reason} ->
        Logger.error("[TokenRefreshWorker] Failed to refresh account #{account.id}: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
