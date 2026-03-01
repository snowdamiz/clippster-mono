defmodule ClippsterServer.Social.Providers.PostForMe do
  @moduledoc """
  Post For Me provider adapter.

  This module centralizes all Post For Me API interactions for:
  - social account connection/auth URL creation
  - social account listing/disconnect
  - upload URL creation
  - post creation and status polling
  - post result and feed retrieval
  - webhook registration
  """

  require Logger

  alias ClippsterServer.Social.ProviderMode

  @default_base_url "https://api.postforme.dev"
  @default_timeout_ms 30_000
  @default_max_retries 3

  @retryable_statuses [429, 500, 502, 503, 504]
  @transient_network_reasons [:timeout, :connect_timeout, :closed, :econnrefused, :nxdomain]

  defmodule ApiError do
    @moduledoc false

    defstruct [:type, :message, :status_code, :retryable, :details]
  end

  defmodule AuthUrlRequest do
    @moduledoc false

    @enforce_keys [:platform]
    defstruct [:platform, :platform_data, :external_id, :permissions]
  end

  defmodule AuthUrlResponse do
    @moduledoc false

    defstruct [:url, :platform, :raw]
  end

  defmodule UploadUrlResponse do
    @moduledoc false

    defstruct [:upload_url, :media_url, :raw]
  end

  defmodule SocialAccount do
    @moduledoc false

    defstruct [
      :id,
      :platform,
      :username,
      :user_id,
      :status,
      :profile_photo_url,
      :external_id,
      :metadata,
      :raw
    ]
  end

  defmodule SocialPost do
    @moduledoc false

    defstruct [
      :id,
      :external_id,
      :caption,
      :status,
      :scheduled_at,
      :social_accounts,
      :media,
      :raw
    ]
  end

  defmodule SocialPostResult do
    @moduledoc false

    defstruct [
      :id,
      :social_account_id,
      :post_id,
      :success,
      :error,
      :details,
      :platform_data,
      :raw
    ]
  end

  @doc """
  Creates a provider auth URL for connecting a social account.
  """
  def create_social_account_auth_url(attrs) when is_map(attrs) do
    request = to_auth_url_request(attrs)

    with {:ok, payload} <-
           request(:post, "/v1/social-accounts/auth-url", body: auth_url_request_to_map(request)),
         {:ok, response} <- map_auth_url_response(payload) do
      {:ok, response}
    end
  end

  @doc """
  Lists connected social accounts.
  """
  def list_social_accounts(filters \\ %{}) when is_map(filters) do
    with {:ok, payload} <- request(:get, "/v1/social-accounts", query: filters) do
      map_paginated(payload, &map_social_account/1)
    end
  end

  @doc """
  Disconnects a social account by Post For Me ID (`spc_*`).
  """
  def disconnect_social_account(id) when is_binary(id) do
    with {:ok, payload} <- request(:post, "/v1/social-accounts/#{id}/disconnect"),
         {:ok, account} <- map_social_account_response(payload) do
      {:ok, account}
    end
  end

  @doc """
  Creates a signed upload URL and corresponding media URL.
  """
  def create_upload_url do
    with {:ok, payload} <- request(:post, "/v1/media/create-upload-url"),
         {:ok, response} <- map_upload_url_response(payload) do
      {:ok, response}
    end
  end

  @doc """
  Creates/schedules a social post.
  """
  def create_social_post(attrs) when is_map(attrs) do
    request_payload = social_post_request_to_map(attrs)

    with {:ok, payload} <- request(:post, "/v1/social-posts", body: request_payload),
         {:ok, post} <- map_social_post_response(payload) do
      {:ok, post}
    end
  end

  @doc """
  Fetches a social post by ID.
  """
  def get_social_post(id) when is_binary(id) do
    with {:ok, payload} <- request(:get, "/v1/social-posts/#{id}"),
         {:ok, post} <- map_social_post_response(payload) do
      {:ok, post}
    end
  end

  @doc """
  Lists social post results.
  """
  def list_social_post_results(filters \\ %{}) when is_map(filters) do
    with {:ok, payload} <- request(:get, "/v1/social-post-results", query: filters) do
      map_paginated(payload, &map_social_post_result/1)
    end
  end

  @doc """
  Gets a social post result by ID.
  """
  def get_social_post_result(id) when is_binary(id) do
    with {:ok, payload} <- request(:get, "/v1/social-post-results/#{id}"),
         {:ok, result} <- map_social_post_result_response(payload) do
      {:ok, result}
    end
  end

  @doc """
  Gets social account feed data.
  """
  def get_social_account_feed(social_account_id, opts \\ %{})
      when is_binary(social_account_id) and is_map(opts) do
    with {:ok, payload} <-
           request(:get, "/v1/social-account-feeds/#{social_account_id}", query: opts) do
      map_paginated(payload, & &1)
    end
  end

  @doc """
  Registers a webhook on Post For Me.
  """
  def create_webhook(attrs) when is_map(attrs) do
    request(:post, "/v1/webhooks", body: attrs)
  end

  # Internal HTTP handling

  defp request(method, path, opts \\ []) do
    config = config()

    with :ok <- ensure_configured(config),
         {:ok, url} <- build_url(config.base_url, path, opts[:query]),
         body <- encode_body(opts[:body]),
         {:ok, response} <- do_request_with_retry(method, path, url, body, config, 1),
         {:ok, decoded} <- decode_json_body(response.body) do
      {:ok, decoded}
    end
  end

  defp do_request_with_retry(method, path, url, body, config, attempt) do
    headers = build_headers(config.api_key, body)
    timeout = config.timeout_ms
    http_opts = [timeout: timeout, recv_timeout: timeout]
    started_at = System.monotonic_time(:millisecond)

    response =
      http_client().(
        method,
        url,
        body,
        headers,
        http_opts
      )

    duration_ms = System.monotonic_time(:millisecond) - started_at

    case response do
      {:ok, %HTTPoison.Response{status_code: status} = http_response} when status in 200..299 ->
        log_request(method, path, status, attempt, duration_ms, :ok)
        emit_request_telemetry(method, path, status, attempt, duration_ms, :ok)
        {:ok, http_response}

      {:ok, %HTTPoison.Response{status_code: status} = http_response}
      when status in @retryable_statuses and attempt < config.max_retries ->
        delay_ms = retry_delay_ms(http_response.headers, attempt)

        log_request(
          method,
          path,
          status,
          attempt,
          duration_ms,
          :retry,
          %{retry_in_ms: delay_ms}
        )

        emit_request_telemetry(method, path, status, attempt, duration_ms, :retry)
        Process.sleep(delay_ms)
        do_request_with_retry(method, path, url, body, config, attempt + 1)

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}}
      when status in @retryable_statuses ->
        error =
          api_error(
            :retryable_http,
            "Post For Me returned retryable status #{status} after #{attempt} attempts",
            status,
            true,
            response_body
          )

        log_request(method, path, status, attempt, duration_ms, :error, %{error: error.message})
        emit_request_telemetry(method, path, status, attempt, duration_ms, :error)
        {:error, error}

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        message = extract_error_message(response_body)

        error =
          api_error(
            :http_error,
            "Post For Me HTTP #{status}: #{message}",
            status,
            false,
            response_body
          )

        log_request(method, path, status, attempt, duration_ms, :error, %{error: error.message})
        emit_request_telemetry(method, path, status, attempt, duration_ms, :error)
        {:error, error}

      {:error, %HTTPoison.Error{reason: reason}}
      when attempt < config.max_retries and reason in @transient_network_reasons ->
        delay_ms = retry_delay_ms([], attempt)

        log_request(
          method,
          path,
          0,
          attempt,
          duration_ms,
          :retry,
          %{reason: inspect(reason), retry_in_ms: delay_ms}
        )

        emit_request_telemetry(method, path, 0, attempt, duration_ms, :retry)
        Process.sleep(delay_ms)
        do_request_with_retry(method, path, url, body, config, attempt + 1)

      {:error, %HTTPoison.Error{reason: reason}} ->
        retryable? = reason in @transient_network_reasons

        error =
          api_error(
            :network_error,
            "Post For Me network error: #{inspect(reason)}",
            nil,
            retryable?,
            reason
          )

        log_request(method, path, 0, attempt, duration_ms, :error, %{error: error.message})
        emit_request_telemetry(method, path, 0, attempt, duration_ms, :error)
        {:error, error}
    end
  end

  defp build_url(base_url, path, query_params) do
    base = String.trim_trailing(base_url || @default_base_url, "/")
    full_path = if String.starts_with?(path, "/"), do: path, else: "/" <> path

    uri = URI.parse(base <> full_path)

    query =
      query_params
      |> normalize_query()
      |> case do
        [] -> nil
        params -> URI.encode_query(params)
      end

    {:ok, URI.to_string(%{uri | query: query})}
  rescue
    _ ->
      {:error,
       api_error(:invalid_url, "Invalid Post For Me URL generated", nil, false, %{
         base: base_url,
         path: path
       })}
  end

  defp normalize_query(nil), do: []

  defp normalize_query(params) when is_map(params) do
    Enum.flat_map(params, fn
      {_key, nil} ->
        []

      {key, values} when is_list(values) ->
        Enum.map(values, fn value -> {to_string(key), to_string(value)} end)

      {key, value} ->
        [{to_string(key), to_string(value)}]
    end)
  end

  defp normalize_query(_), do: []

  defp encode_body(nil), do: ""
  defp encode_body(body) when is_binary(body), do: body
  defp encode_body(body), do: Jason.encode!(body)

  defp decode_json_body(""), do: {:ok, %{}}

  defp decode_json_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} ->
        {:ok, decoded}

      {:error, decode_error} ->
        {:error,
         api_error(
           :decode_error,
           "Failed to decode Post For Me response: #{inspect(decode_error)}",
           nil,
           false,
           body
         )}
    end
  end

  defp build_headers(api_key, body) do
    base_headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Accept", "application/json"}
    ]

    if body == "" do
      base_headers
    else
      [{"Content-Type", "application/json"} | base_headers]
    end
  end

  defp retry_delay_ms(headers, attempt) do
    retry_after =
      headers
      |> Enum.find_value(fn {key, value} ->
        if String.downcase(to_string(key)) == "retry-after" do
          case Integer.parse(to_string(value)) do
            {seconds, _} when seconds >= 0 -> seconds * 1_000
            _ -> nil
          end
        else
          nil
        end
      end)

    retry_after || trunc(min(:math.pow(2, attempt - 1) * 1_000, 15_000))
  end

  defp extract_error_message(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, %{"message" => message}} when is_binary(message) ->
        message

      {:ok, %{"error" => error}} when is_binary(error) ->
        error

      {:ok, %{"error" => %{"message" => message}}} when is_binary(message) ->
        message

      {:ok, decoded} ->
        inspect(decoded)

      {:error, _} ->
        body
    end
  end

  defp extract_error_message(other), do: inspect(other)

  defp ensure_configured(%{api_key: api_key}) when is_binary(api_key) and api_key != "", do: :ok

  defp ensure_configured(_config) do
    {:error, api_error(:not_configured, "Post For Me API key is not configured", nil, false, nil)}
  end

  defp config do
    provider_config = Application.get_env(:clippster_server, :post_for_me, [])

    %{
      base_url:
        provider_config
        |> Keyword.get(:base_url, @default_base_url)
        |> to_string(),
      api_key: provider_config |> Keyword.get(:api_key),
      timeout_ms: provider_config |> Keyword.get(:timeout_ms, @default_timeout_ms),
      max_retries: provider_config |> Keyword.get(:max_retries, @default_max_retries)
    }
  end

  defp http_client do
    Application.get_env(:clippster_server, :post_for_me_http_client, &HTTPoison.request/5)
  end

  defp emit_request_telemetry(method, path, status, attempt, duration_ms, result) do
    :telemetry.execute(
      [:clippster_server, :social, :post_for_me, :request],
      %{duration_ms: duration_ms, attempts: attempt},
      %{
        method: method,
        path: path,
        status: status,
        result: result
      }
    )
  end

  defp log_request(method, path, status, attempt, duration_ms, result, extra \\ %{}) do
    metadata =
      %{
        provider: "post_for_me",
        method: method,
        path: path,
        status: status,
        attempt: attempt,
        duration_ms: duration_ms,
        result: result
      }
      |> Map.merge(extra)

    message = "[PostForMe] #{String.upcase(to_string(method))} #{path}"
    metadata = Map.to_list(metadata)

    case result do
      :error -> Logger.error(message <> " failed", metadata)
      :retry -> Logger.warning(message <> " retrying", metadata)
      _ -> Logger.info(message <> " completed", metadata)
    end
  end

  defp api_error(type, message, status_code, retryable, details) do
    %ApiError{
      type: type,
      message: message,
      status_code: status_code,
      retryable: retryable,
      details: details
    }
  end

  # Mapping helpers

  defp to_auth_url_request(attrs) do
    permissions =
      attrs
      |> Map.get(:permissions, Map.get(attrs, "permissions"))
      |> normalize_permissions()

    %AuthUrlRequest{
      platform:
        attrs
        |> Map.get(:platform, Map.get(attrs, "platform"))
        |> ProviderMode.normalize_platform(),
      platform_data: Map.get(attrs, :platform_data, Map.get(attrs, "platform_data")),
      external_id: Map.get(attrs, :external_id, Map.get(attrs, "external_id")),
      permissions: permissions
    }
  end

  defp normalize_permissions(nil), do: ["posts"]
  defp normalize_permissions(permissions) when is_list(permissions), do: permissions
  defp normalize_permissions(permission) when is_binary(permission), do: [permission]
  defp normalize_permissions(_), do: ["posts"]

  defp auth_url_request_to_map(%AuthUrlRequest{} = request) do
    %{
      "platform" => request.platform,
      "platform_data" => request.platform_data,
      "external_id" => request.external_id,
      "permissions" => request.permissions
    }
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  defp map_auth_url_response(%{"url" => url, "platform" => platform} = payload) do
    {:ok, %AuthUrlResponse{url: url, platform: platform, raw: payload}}
  end

  defp map_auth_url_response(payload) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid auth URL response payload from Post For Me",
       nil,
       false,
       payload
     )}
  end

  defp map_upload_url_response(%{"upload_url" => upload_url, "media_url" => media_url} = payload) do
    {:ok, %UploadUrlResponse{upload_url: upload_url, media_url: media_url, raw: payload}}
  end

  defp map_upload_url_response(payload) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid upload URL response payload from Post For Me",
       nil,
       false,
       payload
     )}
  end

  defp social_post_request_to_map(attrs) do
    caption = Map.get(attrs, :caption, Map.get(attrs, "caption", ""))
    social_accounts = Map.get(attrs, :social_accounts, Map.get(attrs, "social_accounts", []))
    media = Map.get(attrs, :media, Map.get(attrs, "media"))

    payload = %{
      "caption" => caption,
      "social_accounts" => social_accounts,
      "scheduled_at" => Map.get(attrs, :scheduled_at, Map.get(attrs, "scheduled_at")),
      "platform_configurations" =>
        Map.get(attrs, :platform_configurations, Map.get(attrs, "platform_configurations")),
      "account_configurations" =>
        Map.get(attrs, :account_configurations, Map.get(attrs, "account_configurations")),
      "media" => normalize_media(media),
      "external_id" => Map.get(attrs, :external_id, Map.get(attrs, "external_id")),
      "isDraft" => Map.get(attrs, :is_draft, Map.get(attrs, "isDraft"))
    }

    payload
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  defp normalize_media(nil), do: nil

  defp normalize_media(media) when is_list(media) do
    Enum.map(media, fn
      %{"url" => _} = item ->
        item

      %{url: _} = item ->
        item |> Enum.into(%{}) |> stringify_keys()

      url when is_binary(url) ->
        %{"url" => url}

      other ->
        other
    end)
  end

  defp normalize_media(_), do: nil

  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp map_social_account(%{} = payload) do
    %SocialAccount{
      id: payload["id"],
      platform: payload["platform"],
      username: payload["username"],
      user_id: payload["user_id"],
      status: payload["status"],
      profile_photo_url: payload["profile_photo_url"],
      external_id: payload["external_id"],
      metadata: payload["metadata"],
      raw: payload
    }
  end

  defp map_social_account_response(%{"id" => _id} = payload),
    do: {:ok, map_social_account(payload)}

  defp map_social_account_response(payload) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid social account payload from Post For Me",
       nil,
       false,
       payload
     )}
  end

  defp map_social_post(%{} = payload) do
    %SocialPost{
      id: payload["id"],
      external_id: payload["external_id"],
      caption: payload["caption"],
      status: payload["status"],
      scheduled_at: payload["scheduled_at"],
      social_accounts: payload["social_accounts"] || [],
      media: payload["media"] || [],
      raw: payload
    }
  end

  defp map_social_post_response(%{"id" => _id} = payload), do: {:ok, map_social_post(payload)}

  defp map_social_post_response(payload) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid social post payload from Post For Me",
       nil,
       false,
       payload
     )}
  end

  defp map_social_post_result(%{} = payload) do
    %SocialPostResult{
      id: payload["id"],
      social_account_id: payload["social_account_id"],
      post_id: payload["post_id"],
      success: payload["success"],
      error: payload["error"],
      details: payload["details"],
      platform_data: payload["platform_data"],
      raw: payload
    }
  end

  defp map_social_post_result_response(%{"id" => _id} = payload),
    do: {:ok, map_social_post_result(payload)}

  defp map_social_post_result_response(payload) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid social post result payload from Post For Me",
       nil,
       false,
       payload
     )}
  end

  defp map_paginated(%{"data" => data} = payload, mapper_fun) when is_list(data) do
    {:ok,
     %{
       data: Enum.map(data, mapper_fun),
       meta: payload["meta"] || %{},
       raw: payload
     }}
  end

  defp map_paginated(payload, _mapper_fun) do
    {:error,
     api_error(
       :invalid_response,
       "Invalid paginated payload from Post For Me",
       nil,
       false,
       payload
     )}
  end
end
