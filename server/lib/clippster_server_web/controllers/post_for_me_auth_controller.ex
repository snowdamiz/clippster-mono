defmodule ClippsterServerWeb.PostForMeAuthController do
  @moduledoc """
  Unified callback ingress for Post For Me OAuth.
  """

  use ClippsterServerWeb, :controller

  alias ClippsterServer.Social.PostForMeConnectionSessions
  alias ClippsterServer.Social.PostForMeConnectionSync
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServerWeb.OAuthCallbackTarget

  def callback(conn, params) do
    parsed = parse_callback_params(params)

    with :ok <- verify_project_id(parsed.project_id) do
      handle_callback(conn, parsed)
    else
      {:error, message} ->
        render_html_result(conn, false, message)
    end
  end

  defp handle_callback(conn, parsed) do
    case resolve_session(parsed) do
      nil ->
        render_html_result(
          conn,
          false,
          "No pending connection session was found for this callback."
        )

      %PostForMeConnectionSession{} = session ->
        payload = build_callback_payload(parsed)

        if parsed.success do
          handle_successful_callback(conn, session, parsed, payload)
        else
          error_message = parsed.error || "Post For Me authentication failed"

          failed_session =
            case PostForMeConnectionSessions.mark_failed(session, error_message, %{
                   callback_payload: payload,
                   account_ids: parsed.account_ids
                 }) do
              {:ok, updated} -> updated
              {:error, _} -> session
            end

          respond_for_session(conn, failed_session, false, error_message)
        end
    end
  end

  defp handle_successful_callback(conn, session, parsed, payload) do
    with {:ok, session_after_callback} <-
           PostForMeConnectionSessions.mark_callback_received(session, %{
             success: true,
             callback_payload: payload,
             account_ids: parsed.account_ids
           }),
         {:ok, sync_result} <-
           PostForMeConnectionSync.complete_session_connect(session_after_callback, %{
             account_ids: parsed.account_ids,
             platform: parsed.platform
           }),
         {:ok, synced_session} <-
           PostForMeConnectionSessions.mark_synced(session_after_callback, %{
             callback_payload: payload,
             account_ids: merge_account_ids(parsed.account_ids, sync_result.account_ids)
           }) do
      respond_for_session(conn, synced_session, true, nil)
    else
      {:error, reason} ->
        error_message = format_reason(reason)

        failed_session =
          case PostForMeConnectionSessions.mark_failed(session, error_message, %{
                 callback_payload: payload,
                 account_ids: parsed.account_ids
               }) do
            {:ok, updated} -> updated
            {:error, _} -> session
          end

        respond_for_session(conn, failed_session, false, error_message)
    end
  end

  defp respond_for_session(conn, %PostForMeConnectionSession{} = session, success, error_message) do
    if session.return_mode == "web" and is_binary(session.return_url) and session.return_url != "" do
      case OAuthCallbackTarget.normalize_web_redirect_uri(session.return_url) do
        {:ok, safe_return_url} ->
          query =
            %{
              success: to_string(success),
              connection_id: session.id,
              status: session.status,
              error: error_message
            }
            |> Enum.reject(fn {_key, value} -> is_nil(value) or value == "" end)
            |> Map.new()

          redirect(conn, external: OAuthCallbackTarget.append_query(safe_return_url, query))

        {:error, _reason} ->
          render_html_result(conn, success, error_message)
      end
    else
      render_html_result(conn, success, error_message)
    end
  end

  defp render_html_result(conn, true, _error_message) do
    html =
      html_page(
        "Account Connected",
        "You can close this tab and return to Clippster.",
        "#22c55e"
      )

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  defp render_html_result(conn, false, error_message) do
    html = html_page("Connection Failed", error_message || "Authentication failed.", "#ef4444")

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  defp html_page(title, message, color) do
    """
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset=\"utf-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
      <title>#{title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0b0b0c; color: #f4f4f5; }
        .card { width: min(92vw, 520px); border: 1px solid #27272a; border-radius: 14px; background: #111114; padding: 24px; text-align: center; }
        h1 { color: #{color}; margin: 0 0 10px; font-size: 1.5rem; }
        p { color: #a1a1aa; margin: 0; line-height: 1.5; }
      </style>
    </head>
    <body>
      <main class=\"card\">
        <h1>#{title}</h1>
        <p>#{message}</p>
      </main>
    </body>
    </html>
    """
  end

  defp parse_callback_params(params) when is_map(params) do
    %{
      raw_params: params,
      connection_id: first_present(params, ["connection_id", "connectionId"]),
      external_id: first_present(params, ["external_id", "externalId"]),
      platform:
        params
        |> first_present(["platform", "provider"])
        |> PostForMeConnectionSync.normalize_optional_platform(),
      success: parse_success(params),
      account_ids: PostForMeConnectionSync.parse_account_ids(params),
      project_id: first_present(params, ["project_id", "projectId"]),
      error:
        first_present(params, [
          "error",
          "error_description",
          "errorDescription",
          "error_message",
          "errorMessage"
        ])
    }
  end

  defp parse_callback_params(_), do: %{raw_params: %{}, success: false, account_ids: []}

  defp build_callback_payload(parsed) do
    Map.merge(parsed.raw_params, %{
      "_normalized" => %{
        "success" => parsed.success,
        "external_id" => parsed.external_id,
        "connection_id" => parsed.connection_id,
        "platform" => parsed.platform,
        "account_ids" => parsed.account_ids,
        "error" => parsed.error,
        "project_id" => parsed.project_id
      }
    })
  end

  defp resolve_session(parsed) do
    cond do
      is_binary(parsed.connection_id) and parsed.connection_id != "" ->
        PostForMeConnectionSessions.get_session(parsed.connection_id)

      is_binary(parsed.external_id) and parsed.external_id != "" ->
        PostForMeConnectionSessions.get_session_by_external_id(parsed.external_id)

      is_binary(parsed.platform) and parsed.platform != "" ->
        PostForMeConnectionSessions.get_most_recent_pending_session(parsed.platform)

      true ->
        nil
    end
  end

  defp verify_project_id(nil), do: :ok

  defp verify_project_id(project_id) do
    case PostForMeConnectionSessions.project_id() do
      nil ->
        :ok

      expected when expected == project_id ->
        :ok

      _ ->
        {:error, "Post For Me project verification failed"}
    end
  end

  defp parse_success(params) do
    case first_present(params, ["success", "isSuccess", "is_success"]) do
      nil -> false
      value -> to_bool(value)
    end
  end

  defp to_bool(value) when is_boolean(value), do: value

  defp to_bool(value) when is_binary(value) do
    value
    |> String.trim()
    |> String.downcase()
    |> case do
      "true" -> true
      "1" -> true
      "yes" -> true
      "on" -> true
      _ -> false
    end
  end

  defp to_bool(value) when is_integer(value), do: value == 1
  defp to_bool(_), do: false

  defp first_present(params, keys) do
    Enum.find_value(keys, fn key ->
      case Map.get(params, key) do
        value when is_binary(value) and value != "" -> value
        value when is_integer(value) -> Integer.to_string(value)
        value when is_boolean(value) -> to_string(value)
        _ -> nil
      end
    end)
  end

  defp merge_account_ids(primary, fallback) do
    (primary || [])
    |> Kernel.++(fallback || [])
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp format_reason({:provider, reason}), do: format_reason(reason)

  defp format_reason(%{message: message}) when is_binary(message), do: message
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
