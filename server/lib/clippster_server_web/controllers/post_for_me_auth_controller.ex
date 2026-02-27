defmodule ClippsterServerWeb.PostForMeAuthController do
  @moduledoc """
  Controller for handling Post for Me OAuth flows for Instagram, TikTok, and YouTube.

  Supports both organization-level and user-level account connections.
  Post for Me handles the actual platform OAuth; we just manage the redirect flow
  and store the resulting PFM social account ID mapped to our local accounts.

  Tauri Flow:
  1. Client calls /auth/postforme/start with platform, auth_token, callback_port
  2. Server calls PFM API to generate an auth URL with our callback as success_url
  3. Server redirects user to the PFM auth URL
  4. User authorizes on the platform (Instagram/TikTok/YouTube)
  5. PFM redirects to /auth/postforme/callback with social_account_id
  6. Server creates/updates local account, redirects to Tauri callback server
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMe.Accounts, as: PFMAccounts
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts
  alias ClippsterServer.Campaigns
  alias ClippsterServerWeb.OAuthCallbackTarget

  @oauth_context_salt "postforme_oauth_context"
  @oauth_state_max_age 600

  # ============================================================================
  # Start OAuth - Organization Level
  # ============================================================================

  @doc """
  Start Post for Me OAuth flow for an organization account.

  GET /api/auth/postforme/start

  Required params:
  - platform: "instagram", "instagram_business", "tiktok", or "youtube"
  - organization_id: The organization to connect the account to
  - auth_token: The user's JWT auth token
  - callback_port: The local port for the Tauri callback server (desktop)
    OR
  - web_redirect_uri: The web URL to redirect to after OAuth (web app)
  """
  def start_oauth(conn, %{
        "platform" => platform,
        "organization_id" => org_id,
        "web_redirect_uri" => web_redirect_uri,
        "auth_token" => auth_token
      }) do
    case OAuthCallbackTarget.normalize_web_redirect_uri(web_redirect_uri) do
      {:ok, normalized_uri} ->
        start_org_oauth_flow(conn, platform, org_id, auth_token, {:web, normalized_uri})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid web redirect URI"})
    end
  end

  def start_oauth(conn, %{
        "platform" => platform,
        "organization_id" => org_id,
        "callback_port" => callback_port,
        "auth_token" => auth_token
      }) do
    case OAuthCallbackTarget.normalize_tauri_callback_port(callback_port) do
      {:ok, normalized_port} ->
        start_org_oauth_flow(conn, platform, org_id, auth_token, {:tauri, normalized_port})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid callback port"})
    end
  end

  # User-level OAuth (no organization) — web
  def start_oauth(conn, %{
        "platform" => platform,
        "web_redirect_uri" => web_redirect_uri,
        "auth_token" => auth_token
      } = params) when not is_map_key(params, "organization_id") do
    case OAuthCallbackTarget.normalize_web_redirect_uri(web_redirect_uri) do
      {:ok, normalized_uri} ->
        start_user_oauth_flow(conn, platform, auth_token, {:web, normalized_uri})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid web redirect URI"})
    end
  end

  # User-level OAuth (no organization) — Tauri
  def start_oauth(conn, %{
        "platform" => platform,
        "callback_port" => callback_port,
        "auth_token" => auth_token
      } = params) when not is_map_key(params, "organization_id") do
    case OAuthCallbackTarget.normalize_tauri_callback_port(callback_port) do
      {:ok, normalized_port} ->
        start_user_oauth_flow(conn, platform, auth_token, {:tauri, normalized_port})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid callback port"})
    end
  end

  def start_oauth(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters: platform, auth_token, and either callback_port or web_redirect_uri"})
  end

  # ============================================================================
  # OAuth Callback
  # ============================================================================

  @doc """
  Handle Post for Me OAuth callback.

  GET /api/auth/postforme/callback

  Post for Me redirects here after user authorizes.
  The PFM social_account_id comes as a query parameter.
  """
  def oauth_callback(conn, %{"social_account_id" => pfm_account_id, "state" => state_encoded}) do
    case decode_and_verify_state(conn, state_encoded) do
      {:ok, oauth_context, callback_target} ->
        process_oauth_callback(conn, pfm_account_id, oauth_context, callback_target)

      {:error, reason} ->
        Logger.error("[PostForMeAuth] Invalid callback state: #{inspect(reason)}")
        conn
        |> put_status(400)
        |> text("Invalid state parameter. Please try connecting again.")
    end
  end

  # Handle error callback from PFM
  def oauth_callback(conn, %{"error" => error, "state" => state_encoded}) do
    error_description = error

    case decode_and_verify_state(conn, state_encoded) do
      {:ok, _oauth_context, callback_target} ->
        redirect_with_error(conn, callback_target, error_description)

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> text("Authentication failed: #{error_description}")
    end
  end

  def oauth_callback(conn, _params) do
    conn
    |> put_status(400)
    |> text("Invalid callback parameters")
  end

  # ============================================================================
  # Private - OAuth Flow
  # ============================================================================

  defp start_org_oauth_flow(conn, platform, org_id, auth_token, callback_target) do
    with {:ok, user} <- Accounts.verify_token(auth_token),
         true <- Organizations.is_admin?(org_id, user.id) do

      oauth_context = build_oauth_context(:org, %{
        org_id: org_id,
        user_id: user.id,
        platform: platform
      }, callback_target)

      start_pfm_auth(conn, platform, oauth_context, callback_target)
    else
      false ->
        redirect_with_error(conn, callback_target, "Only organization admins can connect social accounts")

      {:error, _reason} ->
        redirect_with_error(conn, callback_target, "Invalid or expired authentication token")
    end
  end

  defp start_user_oauth_flow(conn, platform, auth_token, callback_target) do
    case Accounts.verify_token(auth_token) do
      {:ok, user} ->
        oauth_context = build_oauth_context(:user, %{
          user_id: user.id,
          platform: platform
        }, callback_target)

        start_pfm_auth(conn, platform, oauth_context, callback_target)

      {:error, _reason} ->
        redirect_with_error(conn, callback_target, "Invalid or expired authentication token")
    end
  end

  defp start_pfm_auth(conn, platform, oauth_context, callback_target) do
    # Build our callback URL with signed state
    state_token = Phoenix.Token.sign(conn, @oauth_context_salt, oauth_context)
    state_encoded = Base.url_encode64(state_token, padding: false)

    server_callback_url = ClippsterServerWeb.Endpoint.url() <> "/api/auth/postforme/callback"
    success_url = "#{server_callback_url}?state=#{state_encoded}"
    error_url = "#{server_callback_url}?state=#{state_encoded}&error=auth_failed"

    # Map platform names: we use "instagram_business" internally but PFM may use different names
    pfm_platform = normalize_pfm_platform(platform)

    case PFMAccounts.generate_auth_url(pfm_platform, success_url, error_url) do
      {:ok, %{"url" => auth_url}} ->
        Logger.info("[PostForMeAuth] Redirecting to PFM auth URL for #{platform}")
        redirect(conn, external: auth_url)

      {:ok, response} ->
        # Try alternate response shapes
        auth_url = response["auth_url"] || response["authorization_url"] || response["data"]["url"]
        if auth_url do
          redirect(conn, external: auth_url)
        else
          Logger.error("[PostForMeAuth] Unexpected auth URL response: #{inspect(response)}")
          redirect_with_error(conn, callback_target, "Failed to generate authorization URL")
        end

      {:error, reason} ->
        Logger.error("[PostForMeAuth] Failed to generate auth URL: #{inspect(reason)}")
        redirect_with_error(conn, callback_target, "Failed to start authentication: #{format_error(reason)}")
    end
  end

  defp process_oauth_callback(conn, pfm_account_id, oauth_context, callback_target) do
    platform = oauth_context["platform"]

    # Fetch the PFM account details
    case PFMAccounts.get_account(pfm_account_id) do
      {:ok, pfm_account} ->
        # Extract profile info from PFM account
        account_attrs = %{
          platform: normalize_local_platform(platform),
          platform_user_id: pfm_account["platform_user_id"] || pfm_account["external_id"] || pfm_account_id,
          username: pfm_account["username"] || pfm_account["name"] || "",
          display_name: pfm_account["display_name"] || pfm_account["name"] || "",
          profile_image_url: pfm_account["profile_image_url"] || pfm_account["avatar_url"] || "",
          pfm_account_id: pfm_account_id,
          # PFM manages tokens, we don't need to store them
          # But set a far-future expiry so token_needs_refresh? doesn't trigger
          token_expires_at: DateTime.utc_now() |> DateTime.add(365 * 10, :day) |> DateTime.truncate(:second)
        }

        case oauth_context["owner_type"] do
          "org" ->
            create_or_update_org_account(conn, oauth_context, account_attrs, callback_target)

          "user" ->
            create_or_update_user_account(conn, oauth_context, account_attrs, callback_target)
        end

      {:error, reason} ->
        Logger.error("[PostForMeAuth] Failed to fetch PFM account #{pfm_account_id}: #{inspect(reason)}")
        redirect_with_error(conn, callback_target, "Failed to retrieve account details")
    end
  end

  defp create_or_update_org_account(conn, oauth_context, account_attrs, callback_target) do
    org_id = oauth_context["org_id"]
    user_id = oauth_context["user_id"]

    case Accounts.get_user(user_id) do
      nil ->
        redirect_with_error(conn, callback_target, "User not found")

      user ->
        # Try create first, update on conflict
        case Social.create_social_account(org_id, account_attrs, user) do
          {:ok, account} ->
            redirect_with_success(conn, callback_target, account)

          {:error, %Ecto.Changeset{} = changeset} ->
            if has_unique_constraint_error?(changeset) do
              case Social.update_existing_account(
                     org_id,
                     account_attrs.platform,
                     account_attrs.platform_user_id,
                     account_attrs,
                     user
                   ) do
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
    end
  end

  defp create_or_update_user_account(conn, oauth_context, account_attrs, callback_target) do
    user_id = oauth_context["user_id"]

    case Accounts.get_user(user_id) do
      nil ->
        redirect_with_error(conn, callback_target, "User not found")

      user ->
        # Check for existing account
        existing =
          Campaigns.list_user_social_accounts(user.id)
          |> Enum.find(fn acc ->
            acc.platform == account_attrs.platform &&
              acc.platform_user_id == account_attrs.platform_user_id
          end)

        case existing do
          nil ->
            case Campaigns.create_social_account(user, account_attrs) do
              {:ok, account} ->
                redirect_with_success(conn, callback_target, account)

              {:error, reason} ->
                redirect_with_error(conn, callback_target, format_error(reason))
            end

          account ->
            case Campaigns.update_social_account(account, account_attrs, user) do
              {:ok, account} ->
                redirect_with_success(conn, callback_target, account)

              {:error, reason} ->
                redirect_with_error(conn, callback_target, format_error(reason))
            end
        end
    end
  end

  # ============================================================================
  # Private - State Management
  # ============================================================================

  defp build_oauth_context(:org, %{org_id: org_id, user_id: user_id, platform: platform}, callback_target) do
    base = %{
      "owner_type" => "org",
      "org_id" => org_id,
      "user_id" => user_id,
      "platform" => platform
    }

    case callback_target do
      {:tauri, port} -> Map.put(base, "callback_port", port)
      {:web, uri} -> Map.put(base, "web_redirect_uri", uri)
    end
  end

  defp build_oauth_context(:user, %{user_id: user_id, platform: platform}, callback_target) do
    base = %{
      "owner_type" => "user",
      "user_id" => user_id,
      "platform" => platform
    }

    case callback_target do
      {:tauri, port} -> Map.put(base, "callback_port", port)
      {:web, uri} -> Map.put(base, "web_redirect_uri", uri)
    end
  end

  defp decode_and_verify_state(conn, state_encoded) do
    case Base.url_decode64(state_encoded, padding: false) do
      {:ok, state_token} ->
        case Phoenix.Token.verify(conn, @oauth_context_salt, state_token, max_age: @oauth_state_max_age) do
          {:ok, oauth_context} ->
            case extract_callback_target(oauth_context) do
              {:ok, callback_target} -> {:ok, oauth_context, callback_target}
              error -> error
            end

          {:error, reason} ->
            {:error, reason}
        end

      :error ->
        {:error, :invalid_base64}
    end
  end

  defp extract_callback_target(state_map) do
    case state_map do
      %{"web_redirect_uri" => uri} ->
        case OAuthCallbackTarget.normalize_web_redirect_uri(uri) do
          {:ok, normalized_uri} -> {:ok, {:web, normalized_uri}}
          {:error, _reason} -> {:error, :invalid_web_redirect_uri}
        end

      %{"callback_port" => port} ->
        case OAuthCallbackTarget.normalize_tauri_callback_port(port) do
          {:ok, normalized_port} -> {:ok, {:tauri, normalized_port}}
          {:error, _reason} -> {:error, :invalid_callback_port}
        end

      _ ->
        {:error, :missing_callback_target}
    end
  end

  # ============================================================================
  # Private - Platform Name Mapping
  # ============================================================================

  # Map our internal platform names to PFM API platform names
  defp normalize_pfm_platform("instagram"), do: "instagram"
  defp normalize_pfm_platform("instagram_business"), do: "instagram_business"
  defp normalize_pfm_platform("tiktok"), do: "tiktok"
  defp normalize_pfm_platform("youtube"), do: "youtube"
  defp normalize_pfm_platform(other), do: other

  # Map PFM/internal platform names to our local DB platform names
  defp normalize_local_platform("instagram_business"), do: "instagram"
  defp normalize_local_platform("instagram"), do: "instagram"
  defp normalize_local_platform("tiktok"), do: "tiktok"
  defp normalize_local_platform("youtube"), do: "youtube"
  defp normalize_local_platform(other), do: other

  # ============================================================================
  # Private - Redirects
  # ============================================================================

  defp redirect_with_success(conn, callback_target, account) do
    query = %{
      "success" => "true",
      "account_id" => account.id,
      "platform" => account.platform,
      "platform_user_id" => account.platform_user_id || "",
      "username" => account.username || "",
      "display_name" => account.display_name || "",
      "profile_image_url" => account.profile_image_url || "",
      "connected_at" => DateTime.to_iso8601(account.connected_at)
    }

    case callback_target do
      {:tauri, port} ->
        params = URI.encode_query(query)
        redirect(conn, external: "http://localhost:#{port}/postforme-callback?#{params}")

      {:web, uri} ->
        redirect(conn, external: OAuthCallbackTarget.append_query(uri, query))
    end
  end

  defp redirect_with_error(conn, callback_target, error_message) do
    query = %{
      "success" => "false",
      "error" => error_message
    }

    case callback_target do
      {:tauri, port} ->
        params = URI.encode_query(query)
        redirect(conn, external: "http://localhost:#{port}/postforme-callback?#{params}")

      {:web, uri} ->
        redirect(conn, external: OAuthCallbackTarget.append_query(uri, query))
    end
  end

  # ============================================================================
  # Private - Helpers
  # ============================================================================

  defp has_unique_constraint_error?(changeset) do
    Enum.any?(changeset.errors, fn {_field, {_msg, opts}} ->
      opts[:constraint] == :unique
    end)
  end

  defp format_error(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end

  defp format_error(%{message: message}), do: message
  defp format_error(reason) when is_binary(reason), do: reason
  defp format_error(reason), do: inspect(reason)
end
