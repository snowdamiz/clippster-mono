defmodule ClippsterServerWeb.UserInstagramAuthController do
  @moduledoc """
  Controller for handling user Instagram OAuth flow.
  Allows individual users (clippers) to connect their personal Instagram accounts.
  """

  use ClippsterServerWeb, :controller

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Social.Platforms.Instagram
  alias ClippsterServer.Accounts

  # Instagram OAuth scopes
  @instagram_scopes "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights"

  @doc """
  Start Instagram OAuth flow for user.

  GET /api/auth/user-instagram/start

  Required params:
  - callback_port: The local port for the Tauri callback server
  - auth_token: The user's JWT auth token
  """
  def start_oauth(conn, %{"callback_port" => callback_port, "auth_token" => auth_token}) do
    case Accounts.verify_token(auth_token) do
      {:ok, user} ->
        config = Application.get_env(:clippster_server, :instagram, [])
        app_id = config[:app_id]

        if is_nil(app_id) do
          redirect_with_error(conn, callback_port, "Instagram API not configured")
        else
          # Build server callback URL
          server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/user-instagram/callback"

          # Create state with user info
          state = %{
            user_id: user.id,
            callback_port: callback_port,
            timestamp: System.system_time(:second)
          }
          |> Jason.encode!()
          |> Base.url_encode64(padding: false)

          # Build Instagram authorization URL
          auth_url = "https://www.instagram.com/oauth/authorize?" <>
            URI.encode_query(%{
              "client_id" => app_id,
              "redirect_uri" => server_callback_url,
              "scope" => @instagram_scopes,
              "response_type" => "code",
              "state" => state
            })

          redirect(conn, external: auth_url)
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
  Handle Instagram OAuth callback.

  GET /api/auth/user-instagram/callback
  """
  def oauth_callback(conn, %{"code" => code, "state" => state_encoded}) do
    case decode_state(state_encoded) do
      {:ok, %{"user_id" => user_id, "callback_port" => callback_port}} ->
        case decode_state(state_encoded) do
          {:ok, %{"timestamp" => timestamp}} when is_integer(timestamp) ->
            if System.system_time(:second) - timestamp > 600 do
              redirect_with_error(conn, callback_port, "Authentication session expired")
            else
              process_oauth_callback(conn, code, user_id, callback_port)
            end

          _ ->
            process_oauth_callback(conn, code, user_id, callback_port)
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

  # Private functions

  defp process_oauth_callback(conn, code, user_id, callback_port) do
    config = Application.get_env(:clippster_server, :instagram, [])
    app_id = config[:app_id]
    app_secret = config[:app_secret]
    server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/user-instagram/callback"

    case Accounts.get_user(user_id) do
      nil ->
        redirect_with_error(conn, callback_port, "User not found")

      user ->
        # Exchange code for tokens
        case Instagram.exchange_code(code, %{
          app_id: app_id,
          app_secret: app_secret,
          redirect_uri: server_callback_url
        }) do
          {:ok, token_data} ->
            # Get user profile
            case Instagram.get_user_profile(token_data.access_token) do
              {:ok, profile} ->
                # Create or update the social account
                account_attrs = %{
                  platform: "instagram",
                  platform_user_id: profile.user_id,
                  username: profile.username,
                  display_name: profile.display_name,
                  profile_image_url: profile.profile_image_url,
                  access_token: token_data.access_token,
                  token_expires_at: calculate_expiry(token_data.expires_in)
                }

                case create_or_update_account(user, account_attrs) do
                  {:ok, account} ->
                    redirect_with_success(conn, callback_port, account)

                  {:error, changeset} ->
                    error_msg = extract_changeset_error(changeset)
                    redirect_with_error(conn, callback_port, error_msg)
                end

              {:error, reason} ->
                redirect_with_error(conn, callback_port, "Failed to get Instagram profile: #{inspect(reason)}")
            end

          {:error, reason} ->
            redirect_with_error(conn, callback_port, "Failed to exchange code: #{inspect(reason)}")
        end
    end
  end

  defp create_or_update_account(user, attrs) do
    # Check if account already exists
    existing = Campaigns.list_user_social_accounts(user.id)
    |> Enum.find(fn acc ->
      acc.platform == attrs.platform && acc.platform_user_id == attrs.platform_user_id
    end)

    case existing do
      nil ->
        Campaigns.create_social_account(user, attrs)
      account ->
        Campaigns.update_social_account(account, attrs, user)
    end
  end

  defp decode_state(encoded) do
    case Base.url_decode64(encoded, padding: false) do
      {:ok, decoded} ->
        case Jason.decode(decoded) do
          {:ok, state} -> {:ok, state}
          {:error, _} -> {:error, :invalid_json}
        end
      :error ->
        {:error, :invalid_base64}
    end
  end

  defp calculate_expiry(nil), do: nil
  defp calculate_expiry(seconds_from_now) when is_integer(seconds_from_now) do
    DateTime.utc_now()
    |> DateTime.add(seconds_from_now, :second)
    |> DateTime.truncate(:second)
  end

  defp redirect_with_success(conn, callback_port, account) do
    params = URI.encode_query(%{
      "success" => "true",
      "account_id" => account.id,
      "platform" => account.platform,
      "platform_user_id" => account.platform_user_id || "",
      "username" => account.username || "",
      "display_name" => account.display_name || "",
      "profile_image_url" => account.profile_image_url || "",
      "connected_at" => DateTime.to_iso8601(account.connected_at)
    })

    redirect(conn, external: "http://localhost:#{callback_port}/instagram-callback?#{params}")
  end

  defp redirect_with_error(conn, callback_port, error_message) do
    params = URI.encode_query(%{
      "success" => "false",
      "error" => error_message
    })

    redirect(conn, external: "http://localhost:#{callback_port}/instagram-callback?#{params}")
  end

  defp extract_changeset_error(changeset) do
    errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
    errors
    |> Enum.map(fn {field, msgs} -> "#{field}: #{Enum.join(msgs, ", ")}" end)
    |> Enum.join("; ")
  end
end
