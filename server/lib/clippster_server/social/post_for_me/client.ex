defmodule ClippsterServer.Social.PostForMe.Client do
  @moduledoc """
  HTTP client for the Post for Me API.

  Provides reliable HTTP communication with:
  - Bearer token authentication
  - Exponential backoff retry for transient failures
  - PulseKit logging
  - Error classification (transient vs permanent)

  All Post for Me API calls should go through this module.
  """

  require Logger
  import Retry
  use Retry

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

  @http_timeout 60_000
  @http_options [timeout: @http_timeout, recv_timeout: @http_timeout]

  # ============================================================================
  # Public API
  # ============================================================================

  @doc """
  Makes an authenticated GET request to the Post for Me API.
  """
  def get(path, opts \\ []) do
    request(:get, path, nil, opts)
  end

  @doc """
  Makes an authenticated POST request to the Post for Me API.
  """
  def post(path, body, opts \\ []) do
    request(:post, path, body, opts)
  end

  @doc """
  Makes an authenticated PUT request to the Post for Me API.
  """
  def put(path, body, opts \\ []) do
    request(:put, path, body, opts)
  end

  @doc """
  Makes an authenticated PATCH request to the Post for Me API.
  """
  def patch(path, body, opts \\ []) do
    request(:patch, path, body, opts)
  end

  @doc """
  Makes an authenticated DELETE request to the Post for Me API.
  """
  def delete(path, opts \\ []) do
    request(:delete, path, nil, opts)
  end

  # ============================================================================
  # Core Request Logic
  # ============================================================================

  defp request(method, path, body, opts) do
    config = get_config()
    url = config.base_url <> path
    api_key = config.api_key

    unless api_key do
      Logger.error("[PostForMe] API key not configured")
      {:error, :api_key_not_configured}
    else
      headers = build_headers(api_key, opts)
      encoded_body = encode_body(body)
      http_opts = Keyword.get(opts, :http_options, @http_options)

      start_time = System.monotonic_time(:millisecond)
      do_request_with_retry(method, url, encoded_body, headers, http_opts, path, start_time)
    end
  end

  defp build_headers(api_key, opts) do
    base = [
      {"Authorization", "Bearer #{api_key}"},
      {"Accept", "application/json"}
    ]

    if Keyword.get(opts, :content_type, :json) == :json do
      [{"Content-Type", "application/json"} | base]
    else
      base
    end
  end

  defp encode_body(nil), do: ""
  defp encode_body(body) when is_map(body), do: Jason.encode!(body)
  defp encode_body(body) when is_binary(body), do: body

  defp do_request_with_retry(method, url, body, headers, http_opts, path, start_time) do
    retry with: exponential_backoff() |> randomize() |> cap(30_000) |> expiry(120_000) do
      case HTTPoison.request(method, url, body, headers, http_opts) do
        {:ok, response} ->
          process_response(response, method, path, start_time)

        {:error, %HTTPoison.Error{reason: reason}} ->
          log_api_call(method, path, nil, start_time, {:error, reason})
          raise RetryableError, status_code: :network_error, response_body: inspect(reason)
      end
    after
      result -> result
    else
      _error ->
        log_api_call(method, path, nil, start_time, {:error, :max_retries_exceeded})
        {:error, :max_retries_exceeded}
    end
  end

  defp process_response(response, method, path, start_time) do
    %HTTPoison.Response{status_code: status, body: body} = response

    log_api_call(method, path, status, start_time, :ok)

    case status do
      status when status in 200..299 ->
        case Jason.decode(body) do
          {:ok, decoded} -> {:ok, decoded}
          {:error, _} when body == "" -> {:ok, %{}}
          {:error, _} -> {:ok, body}
        end

      429 ->
        raise RetryableError, status_code: 429, response_body: body

      status when status in [500, 502, 503, 504] ->
        raise RetryableError, status_code: status, response_body: body

      status when status in [400, 401, 403, 404, 409, 422] ->
        error = parse_error_response(body, status)
        {:error, error}

      _ ->
        {:error, %{status: status, message: "Unexpected status code", body: body}}
    end
  end

  defp parse_error_response(body, status) do
    case Jason.decode(body) do
      {:ok, %{"message" => message} = data} ->
        %{status: status, message: message, details: Map.get(data, "errors"), code: Map.get(data, "code")}

      {:ok, %{"error" => error}} when is_binary(error) ->
        %{status: status, message: error}

      {:ok, data} ->
        %{status: status, message: "Request failed", details: data}

      {:error, _} ->
        %{status: status, message: body}
    end
  end

  # ============================================================================
  # Configuration
  # ============================================================================

  defp get_config do
    config = Application.get_env(:clippster_server, :post_for_me, [])

    %{
      api_key: config[:api_key],
      base_url: config[:base_url] || "https://api.postforme.dev",
      webhook_secret: config[:webhook_secret],
      callback_url: config[:callback_url]
    }
  end

  @doc """
  Returns the configured callback URL for Post for Me OAuth flows.
  """
  def callback_url do
    get_config().callback_url
  end

  @doc """
  Returns the configured webhook secret for verifying webhook payloads.
  """
  def webhook_secret do
    get_config().webhook_secret
  end

  # ============================================================================
  # Logging
  # ============================================================================

  defp log_api_call(method, path, status, start_time, result) do
    duration_ms = System.monotonic_time(:millisecond) - start_time

    level = if match?({:error, _}, result), do: :error, else: :info
    status_str = if status, do: "#{status}", else: "error"

    Logger.log(level, "[PostForMe] #{method |> to_string() |> String.upcase()} #{path}: #{status_str} (#{duration_ms}ms)")

    pulse_capture(%{
      type: if(match?({:error, _}, result), do: "pfm_api_call.error", else: "pfm_api_call.success"),
      level: level,
      message: "Post for Me API #{method} #{path}: #{status_str}",
      metadata: %{
        endpoint: path,
        method: method,
        status: status,
        duration_ms: duration_ms
      },
      tags: %{platform: "post_for_me", endpoint: path}
    })
  end

  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end
end
