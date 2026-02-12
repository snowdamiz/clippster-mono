defmodule ClippsterServer.Social.TwitterApiClient do
  @moduledoc """
  Centralized HTTP client wrapper for X (Twitter) API with reliability features:
  - Exponential backoff retry for transient failures (429, 5xx)
  - Rate limit header parsing and quota tracking
  - PulseKit logging for all API interactions
  - Permanent failure detection (400, 401, 403, 404) - no retry

  Use this instead of HTTPoison directly for all X API calls.
  """

  require Logger
  import Retry
  use Retry

  alias ClippsterServer.Social.TwitterRateLimiter

  # Define custom exception for retryable errors
  defmodule RetryableError do
    defexception [:message, :status_code, :response_body]

    def exception(opts) do
      status = opts[:status_code]
      body = opts[:response_body] || ""
      message = "Retryable HTTP error #{status}: #{body}"
      %__MODULE__{message: message, status_code: status, response_body: body}
    end
  end

  @doc """
  Makes a GET request with retry logic.

  ## Parameters
    - url: Request URL
    - headers: List of {key, value} header tuples
    - opts: Keyword list with optional:
      - :endpoint - X API endpoint like "/2/tweets" for rate limit tracking
      - :social_account_id - Account ID for rate limit tracking
      - :http_options - HTTPoison options (default: [timeout: 30_000, recv_timeout: 30_000])

  ## Returns
    - {:ok, %HTTPoison.Response{}} on success
    - {:error, reason} on permanent failure or max retries
  """
  def get(url, headers, opts \\ []) do
    request(:get, url, "", headers, opts)
  end

  @doc """
  Makes a POST request with retry logic.

  ## Parameters
    - url: Request URL
    - body: Request body (string or binary)
    - headers: List of {key, value} header tuples
    - opts: Keyword list with optional:
      - :endpoint - X API endpoint like "/2/tweets" for rate limit tracking
      - :social_account_id - Account ID for rate limit tracking
      - :http_options - HTTPoison options (default: [timeout: 30_000, recv_timeout: 30_000])

  ## Returns
    - {:ok, %HTTPoison.Response{}} on success
    - {:error, reason} on permanent failure or max retries
  """
  def post(url, body, headers, opts \\ []) do
    request(:post, url, body, headers, opts)
  end

  @doc """
  Makes an HTTP request with retry logic, rate limit checking, and logging.

  This is the core function that handles:
  1. Pre-flight rate limit checking
  2. Exponential backoff retry (up to 5 minutes)
  3. Rate limit header parsing
  4. PulseKit logging
  5. Transient vs permanent error classification

  ## Parameters
    - method: HTTP method atom (:get, :post, :put, :delete)
    - url: Request URL
    - body: Request body (string or binary)
    - headers: List of {key, value} header tuples
    - opts: Keyword list with optional:
      - :endpoint - X API endpoint like "/2/tweets" for rate limit tracking
      - :social_account_id - Account ID for rate limit tracking
      - :http_options - HTTPoison options (default: [timeout: 30_000, recv_timeout: 30_000])

  ## Returns
    - {:ok, %HTTPoison.Response{}} on success
    - {:error, {:rate_limited, reset_at}} if pre-flight quota check fails
    - {:error, reason} on permanent failure or max retries
  """
  def request(method, url, body, headers, opts \\ []) do
    endpoint = opts[:endpoint]
    social_account_id = opts[:social_account_id]
    http_opts = opts[:http_options] || [timeout: 30_000, recv_timeout: 30_000]

    start_time = System.monotonic_time(:millisecond)

    # Pre-flight rate limit check
    case maybe_check_quota(endpoint, social_account_id) do
      {:error, :rate_limited, reset_at} ->
        log_api_call(method, endpoint, nil, nil, start_time, {:error, {:rate_limited, reset_at}})
        {:error, {:rate_limited, reset_at}}

      _ ->
        # Proceed with request
        do_request_with_retry(method, url, body, headers, http_opts, endpoint, social_account_id, start_time)
    end
  end

  # Perform request with exponential backoff retry
  defp do_request_with_retry(method, url, body, headers, http_opts, endpoint, social_account_id, start_time) do
    retry with: exponential_backoff() |> randomize() |> cap(60_000) |> expiry(300_000) do
      case HTTPoison.request(method, url, body, headers, http_opts) do
        {:ok, response} ->
          process_response(response, method, endpoint, social_account_id, start_time)

        {:error, %HTTPoison.Error{reason: reason}} ->
          # Network/connection errors are retryable
          log_api_call(method, endpoint, nil, nil, start_time, {:error, reason})
          raise RetryableError, status_code: :network_error, response_body: inspect(reason)
      end
    after
      result ->
        result
    else
      error ->
        # Max retries exceeded
        log_api_call(method, endpoint, nil, nil, start_time, {:error, :max_retries_exceeded})
        {:error, :max_retries_exceeded}
    end
  end

  # Process response: parse rate limits, log, classify errors
  defp process_response(response, method, endpoint, social_account_id, start_time) do
    %HTTPoison.Response{status_code: status, headers: headers, body: body} = response

    # Parse and store rate limit headers
    if endpoint && social_account_id do
      TwitterRateLimiter.update_from_response(endpoint, social_account_id, headers)
    end

    # Log the API call
    log_api_call(method, endpoint, status, response, start_time, :ok)

    case status do
      # Success
      status when status in 200..299 ->
        {:ok, response}

      # Transient errors - trigger retry
      429 ->
        # Check for Retry-After header
        retry_after = get_retry_after(headers)
        if retry_after > 0 do
          Logger.info("[TwitterApiClient] Rate limited, waiting #{retry_after}ms before retry")
          Process.sleep(retry_after)
        end
        raise RetryableError, status_code: 429, response_body: body

      status when status in [500, 502, 503, 504] ->
        raise RetryableError, status_code: status, response_body: body

      # Permanent errors - return immediately without retry
      status when status in [400, 401, 403, 404] ->
        {:ok, response}

      # Other errors - treat as permanent
      _ ->
        {:ok, response}
    end
  end

  # Pre-flight rate limit check if endpoint and account provided
  defp maybe_check_quota(nil, _), do: :ok
  defp maybe_check_quota(_, nil), do: :ok
  defp maybe_check_quota(endpoint, social_account_id) do
    case TwitterRateLimiter.check_quota(endpoint, social_account_id) do
      :ok ->
        :ok

      {:warning, remaining, _reset_at} ->
        Logger.warning("[TwitterApiClient] Low quota for #{endpoint}: #{remaining} requests remaining")
        :ok

      {:error, :rate_limited, reset_at} = error ->
        Logger.error("[TwitterApiClient] Rate limited for #{endpoint} until #{reset_at}")
        error
    end
  end

  # Parse Retry-After header (seconds or HTTP date)
  defp get_retry_after(headers) do
    case Enum.find(headers, fn {key, _} -> String.downcase(to_string(key)) == "retry-after" end) do
      {_, value} ->
        value_str = to_string(value)

        # Try parsing as integer (seconds)
        case Integer.parse(value_str) do
          {seconds, _} -> seconds * 1000
          :error -> 0
        end

      nil ->
        0
    end
  end

  # PulseKit logging helper
  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end

  # Log API call to PulseKit
  defp log_api_call(method, endpoint, status, response, start_time, result) do
    duration_ms = System.monotonic_time(:millisecond) - start_time

    rate_limit_metadata =
      case response do
        %HTTPoison.Response{headers: headers} ->
          %{
            limit: get_header_value(headers, "x-rate-limit-limit"),
            remaining: get_header_value(headers, "x-rate-limit-remaining"),
            reset: get_header_value(headers, "x-rate-limit-reset")
          }

        _ ->
          nil
      end

    error_info =
      case result do
        {:error, reason} -> %{error: inspect(reason)}
        _ -> %{}
      end

    metadata =
      %{
        endpoint: endpoint,
        method: method,
        status: status,
        duration_ms: duration_ms
      }
      |> maybe_merge_map(:rate_limit, rate_limit_metadata)
      |> Map.merge(error_info)

    event_type = if match?({:error, _}, result), do: "x_api_call.error", else: "x_api_call.success"
    level = if match?({:error, _}, result), do: :error, else: :info

    pulse_capture(%{
      type: event_type,
      level: level,
      message: "X API #{method} #{endpoint || "unknown"}: #{status || "error"}",
      metadata: metadata,
      tags: %{platform: "twitter", endpoint: endpoint}
    })
  end

  defp get_header_value(headers, name) when is_list(headers) do
    name_lower = String.downcase(name)

    case Enum.find(headers, fn {key, _} -> String.downcase(to_string(key)) == name_lower end) do
      {_, value} -> to_string(value)
      nil -> nil
    end
  end

  defp maybe_merge_map(map, _key, nil), do: map
  defp maybe_merge_map(map, key, value), do: Map.put(map, key, value)
end
