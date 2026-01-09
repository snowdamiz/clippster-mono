defmodule ClippsterServerWeb.InstagramAuthController do
  @moduledoc """
  Controller for handling Instagram Business Login OAuth flow.

  This controller handles both:
  1. Server-side token exchange (for web clients)
  2. Full OAuth flow with redirect to local Tauri callback server (for desktop apps)

  Tauri Flow:
  1. Desktop app calls /auth/instagram/start with org_id and callback_port
  2. Server stores state and redirects to Instagram
  3. Instagram redirects back to /auth/instagram/callback with code
  4. Server exchanges code, creates account, redirects to local Tauri server
  """

  use ClippsterServerWeb, :controller

  alias ClippsterServer.Social
  alias ClippsterServer.Social.Platforms.Instagram
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts

  # Instagram OAuth scopes for Business Login
  @instagram_scopes "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights"

  @doc """
  Start Instagram OAuth flow (for Tauri desktop apps).

  GET /api/auth/instagram/start

  Required params:
  - organization_id: The organization to connect the account to
  - callback_port: The local port for the Tauri callback server
  - auth_token: The user's JWT auth token

  Redirects user to Instagram authorization.
  """
  def start_oauth(conn, %{"organization_id" => org_id, "callback_port" => callback_port, "auth_token" => auth_token}) do
    # Verify the auth token and get the user
    case Accounts.verify_token(auth_token) do
      {:ok, user} ->
        # Verify user is an admin of the organization
        if Organizations.is_admin?(org_id, user.id) do
          config = Application.get_env(:clippster_server, :instagram, [])
          app_id = config[:app_id]

          if is_nil(app_id) do
            redirect_with_error(conn, callback_port, "Instagram API not configured")
          else
            # Build server callback URL
            server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/instagram/callback"

            # Create state with all necessary info
            state = %{
              org_id: org_id,
              callback_port: callback_port,
              user_id: user.id,
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
        else
          redirect_with_error(conn, callback_port, "Only organization admins can connect Instagram accounts")
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
  Handle Instagram OAuth callback (for Tauri desktop apps).

  GET /api/auth/instagram/callback

  Instagram redirects here after user authorizes. This endpoint:
  1. Exchanges code for tokens
  2. Gets user profile
  3. Creates/updates social account
  4. Redirects to local Tauri callback server with result
  """
  def oauth_callback(conn, %{"code" => code, "state" => state_encoded}) do
    case decode_state(state_encoded) do
      {:ok, %{"org_id" => org_id, "callback_port" => callback_port, "user_id" => user_id}} ->
        # Verify state is not too old (10 minutes)
        case decode_state(state_encoded) do
          {:ok, %{"timestamp" => timestamp}} when is_integer(timestamp) ->
            if System.system_time(:second) - timestamp > 600 do
              redirect_with_error(conn, callback_port, "Authentication session expired")
            else
              process_oauth_callback(conn, code, org_id, callback_port, user_id)
            end

          _ ->
            process_oauth_callback(conn, code, org_id, callback_port, user_id)
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

  defp process_oauth_callback(conn, code, org_id, callback_port, user_id) do
    config = Application.get_env(:clippster_server, :instagram, [])
    app_id = config[:app_id]
    app_secret = config[:app_secret]
    server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/instagram/callback"

    # Get the user
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
            # Get user profile with the access token
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

                case Social.create_social_account(org_id, account_attrs, user) do
                  {:ok, account} ->
                    redirect_with_success(conn, callback_port, account)

                  {:error, %Ecto.Changeset{} = changeset} ->
                    if has_unique_constraint_error?(changeset) do
                      case Social.update_existing_account(org_id, "instagram", profile.user_id, account_attrs, user) do
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

    redirect(conn, external: "http://localhost:#{callback_port}/instagram-callback?#{params}")
  end

  defp redirect_with_error(conn, callback_port, error_message) do
    params = URI.encode_query(%{
      "success" => "false",
      "error" => error_message
    })

    redirect(conn, external: "http://localhost:#{callback_port}/instagram-callback?#{params}")
  end

  @doc """
  Exchange an Instagram authorization code for tokens and create/update the social account.

  POST /api/auth/instagram/exchange

  Required params:
  - organization_id: The organization to connect the account to
  - code: The authorization code from Instagram OAuth callback

  Returns the created/updated social account.
  """
  def exchange_code(conn, %{"organization_id" => org_id, "code" => code}) do
    user = conn.assigns.current_user

    # Verify user is an admin of the organization
    unless Organizations.is_admin?(org_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only organization admins can connect Instagram accounts"})
    else
      # Get Instagram config
      config = Application.get_env(:clippster_server, :instagram, [])
      app_id = config[:app_id]
      app_secret = config[:app_secret]
      redirect_uri = config[:redirect_uri]

      if is_nil(app_id) || is_nil(app_secret) do
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Instagram API not configured"})
      else
        # Exchange code for tokens
        case Instagram.exchange_code(code, %{
          app_id: app_id,
          app_secret: app_secret,
          redirect_uri: redirect_uri
        }) do
          {:ok, token_data} ->
            # Get user profile with the access token
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

                case Social.create_social_account(org_id, account_attrs, user) do
                  {:ok, account} ->
                    conn
                    |> put_status(201)
                    |> json(%{
                      success: true,
                      account: serialize_account(account),
                      message: "Instagram account connected successfully"
                    })

                  {:error, %Ecto.Changeset{} = changeset} ->
                    # Check if this is a unique constraint error (account already connected)
                    if has_unique_constraint_error?(changeset) do
                      # Try to update existing account
                      case Social.update_existing_account(org_id, "instagram", profile.user_id, account_attrs, user) do
                        {:ok, account} ->
                          json(conn, %{
                            success: true,
                            account: serialize_account(account),
                            message: "Instagram account reconnected successfully"
                          })

                        {:error, reason} ->
                          conn
                          |> put_status(400)
                          |> json(%{success: false, error: format_error(reason)})
                      end
                    else
                      conn
                      |> put_status(422)
                      |> json(%{success: false, error: format_error(changeset)})
                    end

                  {:error, reason} ->
                    conn
                    |> put_status(400)
                    |> json(%{success: false, error: format_error(reason)})
                end

              {:error, reason} ->
                conn
                |> put_status(400)
                |> json(%{success: false, error: "Failed to get Instagram profile: #{format_error(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Failed to exchange code: #{format_error(reason)}"})
        end
      end
    end
  end

  def exchange_code(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters: organization_id and code"})
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

  defp serialize_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      platform_user_id: account.platform_user_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      is_active: account.is_active,
      connected_at: account.connected_at,
      token_expires_at: account.token_expires_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }
  end
end
