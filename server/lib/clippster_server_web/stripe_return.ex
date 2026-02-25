defmodule ClippsterServerWeb.StripeReturn do
  @moduledoc false

  import Plug.Conn, only: [get_req_header: 2]

  @desktop_contexts ["desktop", "tauri"]
  @tauri_origins ["tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"]

  def desktop_return?(conn, params \\ %{}) do
    return_context =
      normalize_context(Map.get(params, "return_context") || Map.get(params, :return_context))

    platform_header =
      conn
      |> get_req_header("x-client-platform")
      |> List.first()
      |> normalize_context()

    origin = conn |> get_req_header("origin") |> List.first()
    user_agent = conn |> get_req_header("user-agent") |> List.first()

    return_context in @desktop_contexts or
      platform_header in @desktop_contexts or
      tauri_origin?(origin, user_agent)
  end

  def frontend_base_url do
    Application.get_env(:clippster_server, :frontend_base_url, "http://localhost:1420")
  end

  def web_success_url do
    stripe_config = Application.get_env(:clippster_server, :stripe, [])
    stripe_config[:success_url] || "#{frontend_base_url()}/stripe-success"
  end

  def web_cancel_url do
    stripe_config = Application.get_env(:clippster_server, :stripe, [])
    stripe_config[:cancel_url] || "#{frontend_base_url()}/stripe-cancel"
  end

  def desktop_base_url do
    Application.get_env(
      :clippster_server,
      :stripe_desktop_callback_base_url,
      "http://localhost:48277"
    )
  end

  def desktop_success_url, do: "#{desktop_base_url()}/stripe-success"
  def desktop_cancel_url, do: "#{desktop_base_url()}/stripe-cancel"

  def success_url(conn, params \\ %{}) do
    if desktop_return?(conn, params), do: desktop_success_url(), else: web_success_url()
  end

  def cancel_url(conn, params \\ %{}) do
    if desktop_return?(conn, params), do: desktop_cancel_url(), else: web_cancel_url()
  end

  def with_query(url, params) when is_binary(url) and is_list(params) do
    params_map =
      params
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Enum.into(%{}, fn {key, value} -> {to_string(key), to_string(value)} end)

    do_with_query(url, params_map)
  end

  def with_query(url, params) when is_binary(url) and is_map(params) do
    params_map =
      params
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Enum.into(%{}, fn {key, value} -> {to_string(key), to_string(value)} end)

    do_with_query(url, params_map)
  end

  defp do_with_query(url, params_map) do
    uri = URI.parse(url)
    existing = URI.decode_query(uri.query || "")

    query =
      existing
      |> Map.merge(params_map)
      |> URI.encode_query()
      # Stripe only substitutes the literal token.
      |> String.replace("%7B", "{")
      |> String.replace("%7D", "}")

    %URI{uri | query: query} |> URI.to_string()
  end

  defp normalize_context(value) when is_binary(value) do
    value
    |> String.trim()
    |> String.downcase()
  end

  defp normalize_context(_), do: nil

  defp tauri_origin?(origin, user_agent) when is_binary(origin) do
    origin in @tauri_origins or
      (localhost_origin?(origin) and tauri_user_agent?(user_agent))
  end

  defp tauri_origin?(_, _), do: false

  defp localhost_origin?(origin) do
    String.starts_with?(origin, "http://localhost:") or
      String.starts_with?(origin, "http://127.0.0.1:")
  end

  defp tauri_user_agent?(user_agent) when is_binary(user_agent) do
    String.contains?(String.downcase(user_agent), "tauri")
  end

  defp tauri_user_agent?(_), do: false
end
