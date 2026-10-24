defmodule ClippsterServer.AI.OpenRouterChat do
  @moduledoc """
  Minimal OpenRouter Chat Completions client shared by the AI video modules.

  Retries network errors, 429 and 5xx responses with backoff, and normalises OpenRouter's usage
  block (prompt cache reads/writes and USD cost) into `AiUsageLog` attributes.
  """

  require Logger

  @url "https://openrouter.ai/api/v1/chat/completions"
  @max_attempts 3
  @default_timeout_ms 300_000

  @type result :: %{message: map(), finish_reason: String.t() | nil, usage: map()}

  @spec complete(map(), keyword()) :: {:ok, result()} | {:error, String.t()}
  def complete(payload, opts \\ []) do
    case System.get_env("OPENROUTER_API_KEY") do
      key when is_binary(key) and key != "" -> request(payload, key, opts, 1)
      _ -> {:error, "OPENROUTER_API_KEY is not configured"}
    end
  end

  defp request(payload, api_key, opts, attempt) do
    timeout = Keyword.get(opts, :timeout_ms, @default_timeout_ms)
    http = Application.get_env(:clippster_server, :openrouter_http_client, &HTTPoison.post/4)

    response =
      http.(@url, Jason.encode!(payload), headers(api_key, Keyword.get(opts, :title)),
        recv_timeout: timeout,
        timeout: timeout
      )

    case response do
      {:ok, %{status_code: 200, body: body}} ->
        decode(body)

      {:ok, %{status_code: status, body: body}} when status == 429 or status >= 500 ->
        retry(payload, api_key, opts, attempt, "OpenRouter #{status}: #{snippet(body)}")

      {:ok, %{status_code: status, body: body}} ->
        {:error, "OpenRouter #{status}: #{snippet(body)}"}

      {:error, %{reason: reason}} ->
        retry(payload, api_key, opts, attempt, "Network error: #{inspect(reason)}")
    end
  end

  defp retry(payload, api_key, opts, attempt, reason) when attempt < @max_attempts do
    Logger.warning("[OpenRouterChat] attempt #{attempt} failed (#{reason}), retrying")
    Process.sleep(Keyword.get(opts, :backoff_ms, 1_500) * attempt)
    request(payload, api_key, opts, attempt + 1)
  end

  defp retry(_payload, _api_key, _opts, _attempt, reason), do: {:error, reason}

  defp decode(body) do
    case Jason.decode(body) do
      {:ok, %{"choices" => [%{"message" => message} = choice | _]} = decoded} ->
        {:ok,
         %{
           message: message,
           finish_reason: choice["finish_reason"],
           usage: Map.get(decoded, "usage") || %{}
         }}

      {:ok, %{"error" => error}} ->
        {:error, "OpenRouter error: #{inspect(error)}"}

      {:ok, other} ->
        {:error, "Unexpected OpenRouter response: #{snippet(Jason.encode!(other))}"}

      {:error, error} ->
        {:error, "Could not decode OpenRouter response: #{inspect(error)}"}
    end
  end

  @doc "Plain text of an assistant message whose content may be a string or content parts."
  @spec message_text(map()) :: String.t()
  def message_text(%{"content" => content}) when is_binary(content), do: content

  def message_text(%{"content" => parts}) when is_list(parts) do
    parts
    |> Enum.filter(&(is_map(&1) and &1["type"] == "text"))
    |> Enum.map_join("", & &1["text"])
  end

  def message_text(_), do: ""

  @doc "Decode a JSON object from model text, tolerating a fenced code block around it."
  @spec decode_json(String.t()) :: {:ok, map()} | {:error, String.t()}
  def decode_json(text) do
    trimmed =
      text
      |> String.trim()
      |> String.replace(~r/\A```(?:json)?\s*/, "")
      |> String.replace(~r/\s*```\z/, "")

    case Jason.decode(trimmed) do
      {:ok, map} when is_map(map) -> {:ok, map}
      {:ok, _} -> {:error, "Model returned JSON that is not an object"}
      {:error, _} -> {:error, "Model returned invalid JSON"}
    end
  end

  @doc "Map OpenRouter's usage block onto `AiUsageLog` fields."
  @spec usage_log_attrs(map()) :: map()
  def usage_log_attrs(usage) do
    details = Map.get(usage, "prompt_tokens_details") || %{}

    %{
      input_tokens: usage["prompt_tokens"],
      output_tokens: usage["completion_tokens"],
      total_tokens: usage["total_tokens"],
      cached_tokens: details["cached_tokens"],
      cache_write_tokens: details["cache_write_tokens"],
      cost_usd: to_decimal(usage["cost"])
    }
  end

  defp to_decimal(value) when is_integer(value), do: Decimal.new(value)
  defp to_decimal(value) when is_float(value), do: Decimal.from_float(value)
  defp to_decimal(_), do: Decimal.new(0)

  defp headers(api_key, title) do
    [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster-prototype"},
      {"X-Title", title || "Clippster AI Video Editor"},
      {"User-Agent", "Clippster/1.0"}
    ]
  end

  defp snippet(body) when is_binary(body), do: String.slice(body, 0, 300)
  defp snippet(body), do: inspect(body) |> String.slice(0, 300)
end
