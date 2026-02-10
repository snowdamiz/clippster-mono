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
  @twitter_scopes "tweet.read tweet.write users.read offline.access"

  @doc """
  Start X OAuth flow (for Tauri desktop apps).

  GET /api/auth/twitter/start

  Required params:
  - organization_id: The organization to connect the account to
  - callback_port: The local port for the Tauri callback server
  - auth_token: The user's JWT auth token

  Redirects user to X authorization with PKCE code_challenge.
  """
  def start_oauth(conn, %{"organization_id" => org_id, "callback_port" => callback_port, "auth_token" => auth_token}) do
    # Verify the auth token and get the user
    case Accounts.verify_token(auth_token) do
      {:ok, user} ->
        # Verify user is an admin of the organization
        if Organizations.is_admin?(org_id, user.id) do
          config = Application.get_env(:clippster_server, :twitter_oauth, [])
          client_id = config[:client_id]

          if is_nil(client_id) do
            redirect_with_error(conn, callback_port, "X OAuth not configured")
          else
            # Build server callback URL
            server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/twitter/callback"

            # Create state with all necessary info
            state = %{
              org_id: org_id,
              callback_port: callback_port,
              user_id: user.id,
              timestamp: System.system_time(:second)
            }

            # Call Twitter.authorize_url which handles PKCE generation and state encoding
            auth_url = Twitter.authorize_url(%{
              client_id: client_id,
              redirect_uri: server_callback_url,
              scope: @twitter_scopes,
              state: state
            })

            redirect(conn, external: auth_url)
          end
        else
          redirect_with_error(conn, callback_port, "Only organization admins can connect X accounts")
        end

      {:error, _reason} ->
        redirect_with_error(conn, callback_port, "Invalid or expired authentication token")
    end
  end

  def start_oauth(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters"})
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
      {:ok, %{"org_id" => org_id, "callback_port" => callback_port, "user_id" => user_id, "code_verifier" => code_verifier}} ->
        # Verify state is not too old (10 minutes)
        case decode_state(state_encoded) do
          {:ok, %{"timestamp" => timestamp}} when is_integer(timestamp) ->
            if System.system_time(:second) - timestamp > 600 do
              redirect_with_error(conn, callback_port, "Authentication session expired")
            else
              process_oauth_callback(conn, code, org_id, callback_port, user_id, code_verifier)
            end

          _ ->
            process_oauth_callback(conn, code, org_id, callback_port, user_id, code_verifier)
        end

      {:error, _reason} ->
        # Can't redirect to callback if state is invalid
        conn
        |> put_status(400)
        |> text("Invalid state parameter. Please try again.")
    end
  end

  def oauth_callback(conn, %{"error" => error} = params) do
    # User denied access or other error
    error_description = params["error_description"] || params["error_reason"] || error

    case params["state"] do
      nil ->
        conn
        |> put_status(400)
        |> text("Authentication failed: #{error_description}")

      state_encoded ->
        case decode_state(state_encoded) do
          {:ok, %{"callback_port" => callback_port}} ->
            redirect_with_error(conn, callback_port, error_description)

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

  defp process_oauth_callback(conn, code, org_id, callback_port, user_id, code_verifier) do
    config = Application.get_env(:clippster_server, :twitter_oauth, [])
    client_id = config[:client_id]
    client_secret = config[:client_secret]
    server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/twitter/callback"

    # Get the user
    case Accounts.get_user(user_id) do
      nil ->
        redirect_with_error(conn, callback_port, "User not found")

      user ->
        # Exchange code for tokens with PKCE code_verifier
        case Twitter.exchange_code(code, %{
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: server_callback_url,
          code_verifier: code_verifier
        }) do
          {:ok, token_data} ->
            # Get user profile with the access token
            case Twitter.get_user_profile(token_data.access_token) do
              {:ok, profile} ->
                # Create or update the social account
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
                    redirect_with_success(conn, callback_port, account)

                  {:error, %Ecto.Changeset{} = changeset} ->
                    if has_unique_constraint_error?(changeset) do
                      case Social.update_existing_account(org_id, "twitter", profile.user_id, account_attrs, user) do
                        {:ok, account} ->
                          redirect_with_success(conn, callback_port, account)

                        {:error, reason} ->
                          redirect_with_error(conn, callback_port, format_error(reason))
                      end
                    else
                      redirect_with_error(conn, callback_port, format_error(changeset))
                    end

                  {:error, reason} ->
                    redirect_with_error(conn, callback_port, format_error(reason))
                end

              {:error, reason} ->
                redirect_with_error(conn, callback_port, "Failed to get profile: #{format_error(reason)}")
            end

          {:error, reason} ->
            redirect_with_error(conn, callback_port, "Failed to exchange code: #{format_error(reason)}")
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

  defp redirect_with_success(conn, callback_port, account) do
    params = URI.encode_query(%{
      "success" => "true",
      "account_id" => account.id,
      "platform_user_id" => account.platform_user_id,
      "username" => account.username,
      "display_name" => account.display_name || "",
      "profile_image_url" => account.profile_image_url || "",
      "connected_at" => DateTime.to_iso8601(account.connected_at)
    })

    redirect(conn, external: "http://localhost:#{callback_port}/twitter-callback?#{params}")
  end

  defp redirect_with_error(conn, callback_port, error_message) do
    params = URI.encode_query(%{
      "success" => "false",
      "error" => error_message
    })

    redirect(conn, external: "http://localhost:#{callback_port}/twitter-callback?#{params}")
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
