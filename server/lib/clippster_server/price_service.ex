defmodule ClippsterServer.PriceService do
  @moduledoc """
  Service for fetching real-time SOL/USD prices from Jupiter API.
  Includes caching to avoid rate limits.
  """

  use GenServer
  require Logger

  @jupiter_api_url "https://price.jup.ag/v6/price"
  @coingecko_api_url "https://api.coingecko.com/api/v3/simple/price"
  @cache_ttl_seconds 30
  @sol_mint "So11111111111111111111111111111111111111112"

  # Client API

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @doc """
  Gets the current SOL/USD price with caching.
  Returns {:ok, price} or {:error, reason}
  """
  def get_sol_price do
    GenServer.call(__MODULE__, :get_price)
  end

  @doc """
  Forces a price refresh, bypassing cache
  """
  def refresh_price do
    GenServer.call(__MODULE__, :refresh_price)
  end

  # Server Callbacks

  @impl true
  def init(_) do
    # Initial state with no cached price
    state = %{
      price: nil,
      last_updated: nil
    }
    
    # Fetch price immediately on startup
    {:ok, state, {:continue, :fetch_initial_price}}
  end

  @impl true
  def handle_continue(:fetch_initial_price, state) do
    case fetch_price_from_api() do
      {:ok, price} ->
        Logger.info("Initial SOL price fetched: $#{price}")
        {:noreply, %{state | price: price, last_updated: DateTime.utc_now()}}

      {:error, reason} ->
        Logger.error("Failed to fetch initial SOL price from all sources: #{inspect(reason)}")
        # No price available - service unavailable
        {:noreply, state}
    end
  end

  @impl true
  def handle_call(:get_price, _from, state) do
    if should_refresh?(state) do
      case fetch_price_from_api() do
        {:ok, price} ->
          new_state = %{state | price: price, last_updated: DateTime.utc_now()}
          {:reply, {:ok, price}, new_state}

        {:error, reason} ->
          # If fetch fails but we have cached price, use it
          if state.price do
            Logger.warning("Price fetch failed, using cached price: #{inspect(reason)}")
            {:reply, {:ok, state.price}, state}
          else
            {:reply, {:error, reason}, state}
          end
      end
    else
      {:reply, {:ok, state.price}, state}
    end
  end

  @impl true
  def handle_call(:refresh_price, _from, state) do
    case fetch_price_from_api() do
      {:ok, price} ->
        new_state = %{state | price: price, last_updated: DateTime.utc_now()}
        {:reply, {:ok, price}, new_state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  # Private Functions

  defp should_refresh?(%{last_updated: nil}), do: true
  defp should_refresh?(%{last_updated: last_updated}) do
    DateTime.diff(DateTime.utc_now(), last_updated, :second) > @cache_ttl_seconds
  end

  defp fetch_price_from_api do
    # Try Jupiter API first (Solana-native, most accurate)
    case fetch_from_jupiter() do
      {:ok, price} -> 
        Logger.info("Price fetched from Jupiter: $#{price}")
        {:ok, price}
      
      {:error, reason} ->
        Logger.warning("Jupiter API failed (#{inspect(reason)}), trying CoinGecko...")
        
        # Fallback to CoinGecko free API
        case fetch_from_coingecko() do
          {:ok, price} -> 
            Logger.info("Price fetched from CoinGecko: $#{price}")
            {:ok, price}
          
          {:error, cg_reason} ->
            Logger.error("All price sources failed - Jupiter: #{inspect(reason)}, CoinGecko: #{inspect(cg_reason)}")
            {:error, :all_sources_failed}
        end
    end
  end

  defp fetch_from_jupiter do
    url = "#{@jupiter_api_url}?ids=#{@sol_mint}"

    case HTTPoison.get(url, [], recv_timeout: 10_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"data" => %{@sol_mint => %{"price" => price}}}} when is_number(price) ->
            {:ok, price}

          {:ok, response} ->
            Logger.debug("Unexpected Jupiter response: #{inspect(response)}")
            {:error, :invalid_response}

          {:error, reason} ->
            {:error, {:decode_error, reason}}
        end

      {:ok, %HTTPoison.Response{status_code: status_code}} ->
        {:error, {:http_error, status_code}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:http_error, reason}}
    end
  end

  defp fetch_from_coingecko do
    url = "#{@coingecko_api_url}?ids=solana&vs_currencies=usd"

    case HTTPoison.get(url, [], recv_timeout: 10_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"solana" => %{"usd" => price}}} when is_number(price) ->
            {:ok, price}

          {:ok, response} ->
            Logger.debug("Unexpected CoinGecko response: #{inspect(response)}")
            {:error, :invalid_response}

          {:error, reason} ->
            {:error, {:decode_error, reason}}
        end

      {:ok, %HTTPoison.Response{status_code: status_code}} ->
        {:error, {:http_error, status_code}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:http_error, reason}}
    end
  end
end
