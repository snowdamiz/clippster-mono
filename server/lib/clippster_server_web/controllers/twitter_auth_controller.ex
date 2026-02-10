defmodule ClippsterServerWeb.TwitterAuthController do
  @moduledoc """
  Controller for handling X (Twitter) OAuth 2.0 PKCE flow for organization accounts.

  This controller handles:
  1. Server-side token exchange with PKCE validation
  2. Full OAuth flow with redirect to local Tauri callback server (for desktop apps)

  Tauri Flow:
  1. Desktop app calls /auth/twitter/start with org_id and callback_port
  2. Server generates PKCE pair, stores code_verifier in state, redirects to X
  3. X redirects back to /auth/twitter/callback with code
  4. Server extracts code_verifier from state, exchanges code, creates account, redirects to local Tauri server
  """

  use ClippsterServerWeb, :controller

  alias ClippsterServer.Social
  alias ClippsterServer.Social.Platforms.Twitter
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts

  # X OAuth scopes for posting and reading
  @twitter_scopes "tweet.read tweet.write users.read media.write offline.access"

  @doc """
  Start X OAuth flow.

  GET /api/auth/twitter/start

  Required params:
  - organization_id: The organization to connect the account to
  - auth_token: The user's JWT auth token
  - callback_port: The local port for the Tauri callback server (desktop)
    OR
  - web_redirect_uri: The web URL to redirect to after OAuth (web app)

  Redirects user to X authorization with PKCE code_challenge.
  """
  def start_oauth(conn, %{"organization_id" => org_id, "web_redirect_uri" => web_redirect_uri, "auth_token" => auth_token}) do
    start_oauth_flow(conn, org_id, auth_token, {:web, web_redirect_uri})
  end

  def start_oauth(conn, %{"organization_id" => org_id, "callback_port" => callback_port, "auth_token" => auth_token}) do
    start_oauth_flow(conn, org_id, auth_token, {:tauri, callback_port})
  end

  def start_oauth(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters"})
  end

  defp start_oauth_flow(conn, org_id, auth_token, callback_target) do
    case Accounts.verify_token(auth_token) do
      {:ok, user} ->
        if Organizations.is_admin?(org_id, user.id) do
          config = Application.get_env(:clippster_server, :twitter_oauth, [])
          client_id = config[:client_id]

          if is_nil(client_id) do
            redirect_with_error(conn, callback_target, "X OAuth not configured")
          else
            server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/twitter/callback"

            state = case callback_target do
              {:tauri, port} -> %{org_id: org_id, callback_port: port, user_id: user.id, timestamp: System.system_time(:second)}
              {:web, uri} -> %{org_id: org_id, web_redirect_uri: uri, user_id: user.id, timestamp: System.system_time(:second)}
            end

            auth_url = Twitter.authorize_url(%{
              client_id: client_id,
              redirect_uri: server_callback_url,
              scope: @twitter_scopes,
              state: state
            })

            redirect(conn, external: auth_url)
          end
        else
          redirect_with_error(conn, callback_target, "Only organization admins can connect X accounts")
        end

      {:error, _reason} ->
        redirect_with_error(conn, callback_target, "Invalid or expired authentication token")
    end
  end

  @doc """
  Handle X OAuth callback (for Tauri desktop apps).

  GET /api/auth/twitter/callback

  X redirects here after user authorizes. This endpoint:
  1. Extracts code_verifier from state
  2. Exchanges code for tokens using PKCE code_verifier
  3. Gets user profile
  4. Creates/updates social account
  5. Redirects to local Tauri callback server with result
  """
  def oauth_callback(conn, %{"code" => code, "state" => state_encoded}) do
    case decode_state(state_encoded) do
      {:ok, %{"code_verifier" => code_verifier} = state_map} ->
        callback_target = extract_callback_target(state_map)
        org_id = state_map["org_id"]
        user_id = state_map["user_id"]

        case state_map do
          %{"timestamp" => timestamp} when is_integer(timestamp) ->
            if System.system_time(:second) - timestamp > 600 do
              redirect_with_error(conn, callback_target, "Authentication session expired")
            else
              process_oauth_callback(conn, code, org_id, callback_target, user_id, code_verifier)
            end

          _ ->
            process_oauth_callback(conn, code, org_id, callback_target, user_id, code_verifier)
        end

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> text("Invalid state parameter. Please try again.")
    end
  end

  def oauth_callback(conn, %{"error" => error} = params) do
    error_description = params["error_description"] || params["error_reason"] || error

    case params["state"] do
      nil ->
        conn
        |> put_status(400)
        |> text("Authentication failed: #{error_description}")

      state_encoded ->
        case decode_state(state_encoded) do
          {:ok, state_map} ->
            redirect_with_error(conn, extract_callback_target(state_map), error_description)

          _ ->
            conn
            |> put_status(400)
            |> text("Authentication failed: #{error_description}")
        end
    end
  end

  def oauth_callback(conn, _params) do
    conn
    |> put_status(400)
    |> text("Invalid callback parameters")
  end

  defp process_oauth_callback(conn, code, org_id, callback_target, user_id, code_verifier) do
    config = Application.get_env(:clippster_server, :twitter_oauth, [])
    client_id = config[:client_id]
    client_secret = config[:client_secret]
    server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/twitter/callback"

    case Accounts.get_user(user_id) do
      nil ->
        redirect_with_error(conn, callback_target, "User not found")

      user ->
        case Twitter.exchange_code(code, %{
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: server_callback_url,
          code_verifier: code_verifier
        }) do
          {:ok, token_data} ->
            case Twitter.get_user_profile(token_data.access_token) do
              {:ok, profile} ->
                account_attrs = %{
                  platform: "twitter",
                  platform_user_id: profile.user_id,
                  username: profile.username,
                  display_name: profile.display_name,
                  profile_image_url: profile.profile_image_url,
                  access_token: token_data.access_token,
                  refresh_token: token_data.refresh_token,
                  token_expires_at: calculate_expiry(token_data.expires_in)
                }

                case Social.create_social_account(org_id, account_attrs, user) do
                  {:ok, account} ->
                    redirect_with_success(conn, callback_target, account)

                  {:error, %Ecto.Changeset{} = changeset} ->
                    if has_unique_constraint_error?(changeset) do
                      case Social.update_existing_account(org_id, "twitter", profile.user_id, account_attrs, user) do
                        {:ok, account} ->
                          redirect_with_success(conn, callback_target, account)

                        {:error, reason} ->
                          redirect_with_error(conn, callback_target, format_error(reason))
                      end
                    else
                      redirect_with_error(conn, callback_target, format_error(changeset))
                    end

                  {:error, reason} ->
                    redirect_with_error(conn, callback_target, format_error(reason))
                end

              {:error, reason} ->
                redirect_with_error(conn, callback_target, "Failed to get profile: #{format_error(reason)}")
            end

          {:error, reason} ->
            redirect_with_error(conn, callback_target, "Failed to exchange code: #{format_error(reason)}")
        end
    end
  end

  defp decode_state(state_encoded) do
    case Base.url_decode64(state_encoded, padding: false) do
      {:ok, json} ->
        case Jason.decode(json) do
          {:ok, state} -> {:ok, state}
          error -> error
        end

      :error ->
        {:error, :invalid_base64}
    end
  end

  defp extract_callback_target(state_map) do
    case state_map do
      %{"web_redirect_uri" => uri} -> {:web, uri}
      %{"callback_port" => port} -> {:tauri, port}
    end
  end

  defp redirect_with_success(conn, callback_target, account) do
    params = URI.encode_query(%{
      "success" => "true",
      "account_id" => account.id,
      "platform" => "twitter",
      "platform_user_id" => account.platform_user_id,
      "username" => account.username,
      "display_name" => account.display_name || "",
      "profile_image_url" => account.profile_image_url || "",
      "connected_at" => DateTime.to_iso8601(account.connected_at)
    })

    case callback_target do
      {:tauri, port} ->
        redirect(conn, external: "http://localhost:#{port}/twitter-callback?#{params}")
      {:web, uri} ->
        redirect(conn, external: "#{uri}?#{params}")
    end
  end

  defp redirect_with_error(conn, callback_target, error_message) do
    params = URI.encode_query(%{
      "success" => "false",
      "error" => error_message
    })

    case callback_target do
      {:tauri, port} ->
        redirect(conn, external: "http://localhost:#{port}/twitter-callback?#{params}")
      {:web, uri} ->
        redirect(conn, external: "#{uri}?#{params}")
    end
  end

  # Private helpers

  defp has_unique_constraint_error?(changeset) do
    Enum.any?(changeset.errors, fn {_field, {_msg, opts}} ->
      opts[:constraint] == :unique
    end)
  end

  defp calculate_expiry(nil), do: nil
  defp calculate_expiry(expires_in) when is_integer(expires_in) do
    DateTime.utc_now()
    |> DateTime.add(expires_in, :second)
    |> DateTime.truncate(:second)
  end

  defp format_error(reason) when is_binary(reason), do: reason
  defp format_error(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp format_error(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
    |> Enum.map(fn {field, messages} -> "#{field}: #{Enum.join(messages, ", ")}" end)
    |> Enum.join("; ")
  end
  defp format_error(reason), do: inspect(reason)
end
