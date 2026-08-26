defmodule ClippsterServerWeb.OAuthCallbackTarget do
  @moduledoc false

  @default_frontend_origin "https://clippster.app"
  @localhost_hosts MapSet.new(["localhost", "127.0.0.1"])
  @static_allowed_hosts MapSet.new(["clippster.app", "www.clippster.app"])
  @allow_localhost_by_default Mix.env() != :prod

  def default_web_origin do
    case normalize_web_origin(frontend_base_url()) do
      {:ok, origin} -> origin
      {:error, _reason} -> @default_frontend_origin
    end
  end

  def normalize_web_origin(origin) when is_binary(origin) do
    with {:ok, %URI{} = uri} <- parse_http_uri(origin),
         :ok <- validate_web_uri(uri) do
      sanitized =
        uri
        |> origin_only_uri()
        |> URI.to_string()

      {:ok, sanitized}
    end
  end

  def normalize_web_origin(_), do: {:error, :invalid_origin}

  def normalize_web_redirect_uri(uri) when is_binary(uri) do
    with {:ok, %URI{} = parsed} <- parse_http_uri(uri),
         :ok <- validate_web_uri(parsed) do
      sanitized = %URI{parsed | fragment: nil} |> URI.to_string()
      {:ok, sanitized}
    end
  end

  def normalize_web_redirect_uri(_), do: {:error, :invalid_redirect_uri}

  def normalize_tauri_callback_port(port) do
    with {:ok, port_int} <- parse_port(port),
         true <- port_int in 1..65_535 do
      {:ok, port_int}
    else
      _ -> {:error, :invalid_callback_port}
    end
  end

  @mobile_scheme "clippster"

  @mobile_allowed_path_fragments ~w(google oauth-callback)

  def normalize_mobile_redirect_uri(uri) when is_binary(uri) do
    parsed = uri |> String.trim() |> URI.parse()
    path = parsed.path || ""
    host = parsed.host || ""

    cond do
      parsed.scheme != @mobile_scheme ->
        {:error, :invalid_scheme}

      # Expo Linking.createURL("oauth-callback") may be clippster://oauth-callback
      # (path-style host) or clippster://exp.host/.../oauth-callback.
      host == "" and path == "" ->
        {:error, :missing_host}

      not mobile_path_allowed?(path, host) ->
        {:error, :invalid_path}

      true ->
        {:ok, %URI{parsed | fragment: nil} |> URI.to_string()}
    end
  end

  def normalize_mobile_redirect_uri(_), do: {:error, :invalid_redirect_uri}

  defp mobile_path_allowed?(path, host) do
    haystack = String.downcase(path <> "/" <> host)

    Enum.any?(@mobile_allowed_path_fragments, fn fragment ->
      String.contains?(haystack, fragment)
    end)
  end

  def append_query(url, params) when is_binary(url) and is_map(params) do
    uri = URI.parse(url)
    existing = URI.decode_query(uri.query || "")

    query =
      existing
      |> Map.merge(stringify_params(params))
      |> URI.encode_query()

    %URI{uri | query: query, fragment: nil} |> URI.to_string()
  end

  defp parse_http_uri(value) when is_binary(value) do
    uri = value |> String.trim() |> URI.parse()

    cond do
      uri.scheme not in ["http", "https"] ->
        {:error, :invalid_scheme}

      is_nil(uri.host) or uri.host == "" ->
        {:error, :missing_host}

      is_binary(uri.userinfo) and uri.userinfo != "" ->
        {:error, :userinfo_not_allowed}

      true ->
        {:ok, uri}
    end
  end

  defp validate_web_uri(%URI{scheme: scheme, host: host}) do
    downcased_host = String.downcase(host)
    localhost? = MapSet.member?(@localhost_hosts, downcased_host)
    allowlisted_host? = MapSet.member?(allowed_web_hosts(), downcased_host)

    cond do
      localhost? and allow_localhost_web_redirects?() and scheme in ["http", "https"] ->
        :ok

      allowlisted_host? and scheme == "https" ->
        :ok

      true ->
        {:error, :host_not_allowed}
    end
  end

  defp allow_localhost_web_redirects? do
    Application.get_env(
      :clippster_server,
      :allow_localhost_oauth_redirects,
      @allow_localhost_by_default
    )
  end

  defp allowed_web_hosts do
    frontend_hosts =
      frontend_base_url()
      |> URI.parse()
      |> Map.get(:host)
      |> host_variants()
      |> MapSet.new()

    MapSet.union(@static_allowed_hosts, frontend_hosts)
  end

  defp frontend_base_url do
    Application.get_env(:clippster_server, :frontend_base_url, @default_frontend_origin)
  end

  defp host_variants(nil), do: []

  defp host_variants(host) when is_binary(host) do
    normalized = String.downcase(host)

    if String.starts_with?(normalized, "www.") do
      bare = String.replace_prefix(normalized, "www.", "")
      [normalized, bare]
    else
      [normalized, "www." <> normalized]
    end
  end

  defp origin_only_uri(uri) do
    %URI{
      scheme: uri.scheme,
      host: uri.host,
      port: uri.port
    }
  end

  defp parse_port(port) when is_integer(port), do: {:ok, port}

  defp parse_port(port) when is_binary(port) do
    case Integer.parse(String.trim(port)) do
      {parsed, ""} -> {:ok, parsed}
      _ -> {:error, :invalid_port}
    end
  end

  defp parse_port(_), do: {:error, :invalid_port}

  defp stringify_params(params) do
    params
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Enum.into(%{}, fn {key, value} -> {to_string(key), to_string(value)} end)
  end
end
