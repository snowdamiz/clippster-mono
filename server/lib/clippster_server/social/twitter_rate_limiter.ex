defmodule ClippsterServer.Social.TwitterRateLimiter do
  @moduledoc """
  Rate limit tracking for X (Twitter) API endpoints.

  Parses rate limit headers from X API responses and stores quota state
  per-endpoint, per-account. Provides quota checking to prevent hitting limits.

  X API returns these headers:
  - x-rate-limit-limit: Max requests per window
  - x-rate-limit-remaining: Requests remaining in current window
  - x-rate-limit-reset: Unix timestamp when window resets
  """

  require Logger
  alias ClippsterServer.Repo
  alias ClippsterServer.Social.RateLimitState

  @doc """
  Updates rate limit state from X API response headers.

  Parses rate limit headers and upserts into database. Call this after
  every X API request to maintain accurate quota tracking.

  ## Parameters
    - endpoint: String like "/2/tweets" or "/2/media/upload"
    - social_account_id: ID of the social account (nullable)
    - headers: List of {key, value} tuples from HTTPoison response

  ## Returns
    - {:ok, rate_limit_state} if headers found and saved
    - {:ok, nil} if no rate limit headers present
    - {:error, reason} if save failed
  """
  def update_from_response(endpoint, social_account_id, headers) when is_list(headers) do
    with {:ok, limit} <- parse_header(headers, "x-rate-limit-limit"),
         {:ok, remaining} <- parse_header(headers, "x-rate-limit-remaining"),
         {:ok, reset} <- parse_header(headers, "x-rate-limit-reset") do
      reset_datetime = unix_to_datetime(reset)
      now = DateTime.utc_now()

      attrs = %{
        endpoint: endpoint,
        social_account_id: social_account_id,
        limit_value: String.to_integer(limit),
        remaining: String.to_integer(remaining),
        reset_at: reset_datetime,
        last_checked_at: now
      }

      # Upsert using conflict resolution
      %RateLimitState{}
      |> RateLimitState.changeset(attrs)
      |> Repo.insert(
        on_conflict: {:replace_all_except, [:id, :inserted_at]},
        conflict_target: [:endpoint, :social_account_id]
      )
    else
      {:error, :not_found} ->
        # No rate limit headers in response - this is normal for some endpoints
        {:ok, nil}

      error ->
        Logger.warning(
          "[TwitterRateLimiter] Failed to parse rate limit headers: #{inspect(error)}"
        )

        {:ok, nil}
    end
  end

  @doc """
  Checks if endpoint has sufficient quota remaining.

  ## Parameters
    - endpoint: String like "/2/tweets"
    - social_account_id: ID of the social account (nullable)
    - threshold: Minimum requests remaining to return :ok (default 10)

  ## Returns
    - :ok if remaining > threshold
    - {:warning, remaining, reset_at} if 0 < remaining <= threshold
    - {:error, :rate_limited, reset_at} if remaining == 0 and reset_at is future
    - :ok if no rate limit record exists (first request)
  """
  def check_quota(endpoint, social_account_id, threshold \\ 10) do
    import Ecto.Query

    query =
      from r in RateLimitState,
        where: r.endpoint == ^endpoint and r.social_account_id == ^social_account_id,
        select: r

    case Repo.one(query) do
      nil ->
        # No rate limit record yet - first request
        :ok

      %RateLimitState{remaining: 0, reset_at: reset_at} ->
        now = DateTime.utc_now()

        if DateTime.compare(reset_at, now) == :gt do
          # Still rate limited
          {:error, :rate_limited, reset_at}
        else
          # Window has reset but we haven't made a new request yet
          :ok
        end

      %RateLimitState{remaining: remaining, reset_at: reset_at} when remaining <= threshold ->
        {:warning, remaining, reset_at}

      %RateLimitState{} ->
        :ok
    end
  end

  # Parse header value by name (case-insensitive)
  defp parse_header(headers, name) do
    name_lower = String.downcase(name)

    case Enum.find(headers, fn {key, _value} ->
           String.downcase(to_string(key)) == name_lower
         end) do
      {_key, value} -> {:ok, to_string(value)}
      nil -> {:error, :not_found}
    end
  end

  # Convert Unix timestamp string to DateTime
  defp unix_to_datetime(unix_string) when is_binary(unix_string) do
    unix_string
    |> String.to_integer()
    |> DateTime.from_unix!()
  end
end
