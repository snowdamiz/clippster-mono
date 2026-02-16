defmodule ClippsterServerWeb.AuthController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Auth.{ChallengeStore, TokenGenerator}
  alias ClippsterServer.Accounts
  alias ClippsterServer.Affiliates

  @sign_message_template """
  <%= domain %> wants you to sign in with your Solana account:
  <%= wallet_address %>

  Nonce: <%= nonce %>
  Issued At: <%= timestamp %>
  Chain ID: mainnet-beta
  """

  # Handle OPTIONS requests for CORS preflight
  # This supplements CORSPlug and ensures credentials are properly handled
  def options(conn, _params) do
    origin = get_req_header(conn, "origin") |> List.first()

    # Only allow specific origins (matching CORSPlug config in router.ex)
    allowed_origin = if origin && allowed_origin?(origin), do: origin, else: nil

    conn
    |> maybe_put_origin_header(allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
    |> put_resp_header("access-control-allow-headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(204, "")
  end

  # Check if origin is in the allowed list (mirrors CORSPlug config)
  defp allowed_origin?(origin) do
    allowed_origins = [
      "tauri://localhost",
      "https://tauri.localhost",
      "http://tauri.localhost",
      "http://localhost:5173",
      "http://localhost:1420",
      "http://localhost:4000",
      "https://clippster.app",
      "https://www.clippster.app"
    ]

    # Check explicit matches first
    if origin in allowed_origins do
      true
    else
      # Check regex patterns
      Enum.any?([
        ~r/^http:\/\/localhost:\d+$/,
        ~r/^tauri:\/\//,
        ~r/^https?:\/\/tauri\./
      ], fn pattern -> Regex.match?(pattern, origin) end)
    end
  end

  defp maybe_put_origin_header(conn, nil), do: conn
  defp maybe_put_origin_header(conn, origin) do
    put_resp_header(conn, "access-control-allow-origin", origin)
  end

  @doc """
  Activity ping endpoint - updates user's last_active_at timestamp.
  Called periodically by the frontend to track user activity.
  Requires authentication via AuthPlug.
  """
  def activity_ping(conn, _params) do
    case conn.assigns[:current_user] do
      nil ->
        IO.puts("[AuthController] activity_ping - current_user is nil! assigns: #{inspect(Map.keys(conn.assigns))}")
        conn
        |> put_status(401)
        |> json(%{success: false, error: "User not authenticated"})
      
      user ->
        IO.puts("[AuthController] activity_ping - Updating last_active for user #{user.id}")
        case Accounts.update_last_active(user.id) do
          {:ok, _updated_user} ->
            IO.puts("[AuthController] activity_ping - Successfully updated user #{user.id}")
            json(conn, %{success: true})
          
          {:error, reason} ->
            IO.puts("[AuthController] activity_ping - Failed to update user #{user.id}: #{inspect(reason)}")
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to update activity"})
        end
    end
  end

  def request_challenge(conn, %{"client_id" => client_id}) do
    challenge = ChallengeStore.create_challenge(client_id)

    json(conn, %{
      success: true,
      challenge: %{
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        domain: challenge.domain,
        message_template: @sign_message_template
      }
    })
  end

  def verify_signature(conn, %{
        "signature" => signature,
        "public_key" => public_key,
        "message" => message,
        "nonce" => nonce
      }) do
    IO.puts("\nStarting signature verification...")

    with {:ok, challenge} <- ChallengeStore.consume_challenge(nonce),
         :ok <- validate_message(message, challenge, public_key),
         :ok <- verify_ed25519_signature(message, signature, public_key) do
      IO.puts("Signature verification successful!")

      # Create or get user (with optional referral code)
      referral_code = Map.get(conn.params, "referral_code")
      {:ok, user, is_new_user} = Accounts.get_or_create_user(public_key, referral_code)
      
      # Update last active timestamp
      Accounts.update_last_active(user.id)

      # Generate JWT token
      token_claims = %{
        "sub" => public_key,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
        "wallet_address" => public_key,
        "user_id" => user.id,
        "is_admin" => user.is_admin,
        "is_moderator" => user.is_moderator
      }

      case TokenGenerator.generate_token(token_claims) do
        {:ok, token} ->
          ai_allowed = check_ai_allowed_for_user(user)
          json(conn, %{
            success: true,
            token: token,
            wallet_address: public_key,
            is_new_user: is_new_user,
            user: %{
              id: user.id,
              wallet_address: user.wallet_address,
              is_admin: user.is_admin,
              is_moderator: user.is_moderator,
              account_type: user.account_type,
              owned_organization_id: user.owned_organization_id,
              created_by_organization_id: user.created_by_organization_id,
              ai_allowed: ai_allowed,
              beta_activated: user.beta_activated,
              is_affiliate: Affiliates.is_affiliate?(user.id)
            }
          })

        {:error, _reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Token generation failed"})
      end
    else
      {:error, :not_found} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid or expired challenge"})

      {:error, :expired} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Challenge has expired"})

      {:error, :invalid_message} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Message format invalid"})

      {:error, :invalid_signature} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Signature verification failed"})
    end
  end

  defp validate_message(message, challenge, wallet_address) do
    expected_message =
      EEx.eval_string(@sign_message_template,
        domain: challenge.domain,
        wallet_address: wallet_address,
        nonce: challenge.nonce,
        timestamp: challenge.timestamp
      )
      # Normalize line endings to Unix style
      |> String.replace("\r\n", "\n")
      |> String.trim()

    # Normalize the received message too
    normalized_message = String.trim(message)

    IO.puts("Message validation:")
    IO.puts("Expected: #{inspect(expected_message)}")
    IO.puts("Received: #{inspect(normalized_message)}")
    IO.puts("Match: #{normalized_message == expected_message}")

    if normalized_message == expected_message do
      :ok
    else
      {:error, :invalid_message}
    end
  end

  defp verify_ed25519_signature(message, signature_b64, public_key_b58) do
    alias ClippsterServer.JsScripts

    # Use Node.js script for proper Solana signature verification
    payload = Jason.encode!(%{
      message: message,
      signature: signature_b64,
      public_key: public_key_b58
    })

    IO.puts("\n=== Calling Node.js signature verification ===")
    IO.puts("Message: #{String.slice(message, 0, 100)}...")
    IO.puts("Public key: #{public_key_b58}")
    IO.puts("Signature (base64): #{String.slice(signature_b64, 0, 20)}...")

    # Write payload to temp file
    temp_file = Path.join(System.tmp_dir!(), "sig_verify_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)

    # Call the Node.js verification script
    script_path = JsScripts.script_path("sig_verify.js")
    node_path = JsScripts.find_node_executable()

    IO.puts("Node path: #{node_path}")
    IO.puts("Script path: #{script_path}")
    IO.puts("Temp file: #{temp_file}")

    result =
      case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, %{"valid" => true}} ->
              IO.puts("✓ Signature valid!")
              :ok

            {:ok, %{"valid" => false}} ->
              IO.puts("✗ Signature invalid!")
              {:error, :invalid_signature}

            {:error, _} ->
              IO.puts("Error parsing verification result")
              {:error, :invalid_signature}
          end

        {output, _exit_code} ->
          IO.puts("Node.js verification failed: #{output}")
          {:error, :invalid_signature}
      end

    # Clean up temp file
    File.rm(temp_file)
    result
  end

  # ============================================
  # Google OAuth Handlers
  # ============================================

  @doc """
  Initiates Google OAuth flow by redirecting to Google's authorization URL.
  """
  def google_request(conn, params) do
    # Get Google OAuth configuration - try config first, then env vars directly
    config = Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth, [])
    client_id = Keyword.get(config, :client_id) || System.get_env("GOOGLE_CLIENT_ID")

    if is_nil(client_id) or client_id == "" do
      conn
      |> put_status(500)
      |> json(%{success: false, error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."})
    else
      # Build the callback URL
      callback_url = "#{ClippsterServerWeb.Endpoint.url()}/api/auth/google/callback"

      # Build Google OAuth authorization URL
      scope = "email profile"

      # Encode web=true and referral_code into state if present
      web_mode = params["web"] == "true"
      web_origin = params["origin"]
      referral_code = params["referral_code"]
      state_data = if web_mode or referral_code do
        state_map = %{"nonce" => Base.url_encode64(:crypto.strong_rand_bytes(16), padding: false)}
        state_map = if web_mode, do: Map.merge(state_map, %{"web" => true, "origin" => web_origin}), else: state_map
        state_map = if referral_code, do: Map.put(state_map, "referral_code", referral_code), else: state_map
        Jason.encode!(state_map) |> Base.url_encode64(padding: false)
      else
        :crypto.strong_rand_bytes(16) |> Base.url_encode64(padding: false)
      end

      google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" <> URI.encode_query(%{
        "client_id" => client_id,
        "redirect_uri" => callback_url,
        "response_type" => "code",
        "scope" => scope,
        "state" => state_data,
        "access_type" => "offline",
        "prompt" => "consent"
      })

      IO.puts("\n=== Redirecting to Google OAuth ===")
      IO.puts("Callback URL: #{callback_url}")
      IO.puts("Google Auth URL: #{google_auth_url}")
      IO.puts("Web mode: #{web_mode}")

      redirect(conn, external: google_auth_url)
    end
  end

  @doc """
  Handles Google OAuth callback with authorization code.
  """
  def google_callback(conn, %{"code" => code} = params) do
    IO.puts("\n=== Google OAuth Callback ===")
    IO.puts("Received code: #{String.slice(code, 0, 20)}...")

    # Decode state to check for web mode
    web_opts = parse_oauth_state(params["state"])

    # Check for error from Google
    if Map.has_key?(params, "error") do
      IO.puts("Google OAuth Error: #{params["error"]}")
      send_auth_error_html(conn, params["error_description"] || params["error"], web_opts)
    else
      # Exchange code for tokens
      case exchange_google_code(code) do
        {:ok, tokens} ->
          IO.puts("Token exchange successful")

          # Get user info from Google
          case get_google_user_info(tokens["access_token"]) do
            {:ok, google_user} ->
              IO.puts("Got user info - Email: #{google_user["email"]}, ID: #{google_user["id"]}")

              oauth_info = %{
                email: google_user["email"],
                name: google_user["name"],
                avatar_url: google_user["picture"]
              }

              # Extract referral code from OAuth state
              oauth_referral_code = web_opts[:referral_code]

              case Accounts.get_or_create_oauth_user("google", google_user["id"], oauth_info, oauth_referral_code) do
                {:ok, user, is_new_user} ->
                  IO.puts("User created/retrieved: #{user.id}, is_new: #{is_new_user}")

                  # Generate JWT token
                  token_claims = %{
                    "sub" => "google:#{google_user["id"]}",
                    "iat" => DateTime.utc_now() |> DateTime.to_unix(),
                    "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
                    "provider" => "google",
                    "provider_id" => google_user["id"],
                    "user_id" => user.id,
                    "is_admin" => user.is_admin,
                    "is_moderator" => user.is_moderator,
                    "email" => user.email
                  }

                  case TokenGenerator.generate_token(token_claims) do
                    {:ok, token} ->
                      send_auth_success_html(conn, token, user, web_opts, is_new_user)

                    {:error, _reason} ->
                      send_auth_error_html(conn, "Token generation failed", web_opts)
                  end

                {:error, reason} ->
                  IO.puts("Failed to create user: #{inspect(reason)}")
                  send_auth_error_html(conn, "Failed to create user account", web_opts)
              end

            {:error, reason} ->
              IO.puts("Failed to get user info: #{inspect(reason)}")
              send_auth_error_html(conn, "Failed to get user information from Google", web_opts)
          end

        {:error, reason} ->
          IO.puts("Token exchange failed: #{inspect(reason)}")
          send_auth_error_html(conn, "Failed to authenticate with Google", web_opts)
      end
    end
  end

  # Fallback for missing code parameter
  def google_callback(conn, params) do
    IO.puts("\n=== Google OAuth Callback - No Code ===")
    IO.puts("Params: #{inspect(params)}")

    web_opts = parse_oauth_state(params["state"])
    error_msg = params["error_description"] || params["error"] || "Authentication failed"
    send_auth_error_html(conn, error_msg, web_opts)
  end

  defp exchange_google_code(code) do
    # Get Google OAuth configuration - try config first, then env vars directly
    config = Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth, [])
    client_id = Keyword.get(config, :client_id) || System.get_env("GOOGLE_CLIENT_ID")
    client_secret = Keyword.get(config, :client_secret) || System.get_env("GOOGLE_CLIENT_SECRET")
    callback_url = "#{ClippsterServerWeb.Endpoint.url()}/api/auth/google/callback"

    body = URI.encode_query(%{
      "code" => code,
      "client_id" => client_id,
      "client_secret" => client_secret,
      "redirect_uri" => callback_url,
      "grant_type" => "authorization_code"
    })

    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post("https://oauth2.googleapis.com/token", body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        Jason.decode(response_body)

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        IO.puts("Token exchange failed with status #{status}: #{response_body}")
        {:error, :token_exchange_failed}

      {:error, reason} ->
        IO.puts("HTTP error during token exchange: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp get_google_user_info(access_token) do
    headers = [{"Authorization", "Bearer #{access_token}"}]

    case HTTPoison.get("https://www.googleapis.com/oauth2/v2/userinfo", headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        Jason.decode(body)

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("Get user info failed with status #{status}: #{body}")
        {:error, :user_info_failed}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp parse_oauth_state(nil), do: %{web: false, origin: nil, referral_code: nil}
  defp parse_oauth_state(state) do
    case Base.url_decode64(state, padding: false) do
      {:ok, json} ->
        case Jason.decode(json) do
          {:ok, decoded} ->
            %{
              web: Map.get(decoded, "web", false),
              origin: Map.get(decoded, "origin"),
              referral_code: Map.get(decoded, "referral_code")
            }
          _ -> %{web: false, origin: nil, referral_code: nil}
        end
      _ -> %{web: false, origin: nil, referral_code: nil}
    end
  end

  defp send_auth_success_html(conn, token, user, %{web: true} = web_opts, is_new_user) do
    # Web mode: redirect to the origin's callback page (avoids COOP issues with window.opener)
    ai_allowed = check_ai_allowed_for_user(user)
    target_origin = web_opts[:origin] || "https://clippster.app"

    user_json = Jason.encode!(%{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      wallet_address: user.wallet_address,
      is_admin: user.is_admin,
      account_type: user.account_type,
      owned_organization_id: user.owned_organization_id,
      created_by_organization_id: user.created_by_organization_id,
      ai_allowed: ai_allowed,
      beta_activated: user.beta_activated
    })

    params = URI.encode_query(%{
      "token" => token,
      "user" => user_json,
      "is_new_user" => to_string(is_new_user)
    })

    redirect(conn, external: "#{target_origin}/auth/google/callback?#{params}")
  end

  defp send_auth_success_html(conn, token, user, _web_opts, is_new_user) do
    # Tauri mode: redirect to local callback server
    ai_allowed = check_ai_allowed_for_user(user)

    params = URI.encode_query(%{
      "success" => "true",
      "token" => token,
      "provider" => "google",
      "user_id" => user.id,
      "email" => user.email || "",
      "name" => user.name || "",
      "avatar_url" => user.avatar_url || "",
      "is_admin" => user.is_admin,
      "account_type" => user.account_type || "",
      "owned_organization_id" => user.owned_organization_id || "",
      "created_by_organization_id" => user.created_by_organization_id || "",
      "ai_allowed" => ai_allowed,
      "beta_activated" => user.beta_activated,
      "is_new_user" => to_string(is_new_user)
    })

    redirect(conn, external: "http://localhost:54321/google-callback?#{params}")
  end

  defp send_auth_error_html(conn, error_message, %{web: true} = web_opts) do
    # Web mode: redirect to the origin's callback page with error (avoids COOP issues)
    target_origin = web_opts[:origin] || "https://clippster.app"
    params = URI.encode_query(%{"error" => error_message})
    redirect(conn, external: "#{target_origin}/auth/google/callback?#{params}")
  end

  defp send_auth_error_html(conn, error_message, _web_opts) do
    # Tauri mode: redirect to local callback server
    params = URI.encode_query(%{
      "success" => "false",
      "error" => error_message
    })

    redirect(conn, external: "http://localhost:54321/google-callback?#{params}")
  end

  @doc """
  Links a Google account to an existing authenticated user.
  """
  def link_google_account(%{assigns: %{current_user_id: user_id}} = conn, %{"access_token" => access_token}) do
    case verify_google_access_token(access_token) do
      {:ok, google_info} ->
        oauth_info = %{
          email: google_info["email"],
          name: google_info["name"],
          avatar_url: google_info["picture"]
        }

        case Accounts.link_oauth_to_user(user_id, oauth_info) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Google account linked successfully",
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                avatar_url: user.avatar_url
              }
            })

          {:error, :not_found} ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "User not found"})

          {:error, _reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Failed to link account"})
        end

      {:error, _reason} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid Google access token"})
    end
  end

  @doc """
  Get current user info (requires auth via AuthPlug).
  Returns fresh user data from the database.
  """
  def me(conn, _params) do
    user = conn.assigns.current_user

    # Check if AI is allowed for this user
    ai_allowed = check_ai_allowed_for_user(user)

    json(conn, %{
      success: true,
      user: %{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        wallet_address: user.wallet_address,
        is_admin: user.is_admin,
        account_type: user.account_type,
        owned_organization_id: user.owned_organization_id,
        created_by_organization_id: user.created_by_organization_id,
        ai_allowed: ai_allowed,
        beta_activated: user.beta_activated,
        is_affiliate: Affiliates.is_affiliate?(user.id)
      }
    })
  end

  # Check if AI is allowed for a user based on their organization's settings
  defp check_ai_allowed_for_user(user) do
    case user.created_by_organization_id do
      nil ->
        # User was not created by an org, AI is allowed
        true

      org_id ->
        # User was created by an org, check org settings
        case ClippsterServer.Organizations.get_organization(org_id) do
          nil ->
            # Org doesn't exist anymore, allow AI
            true

          organization ->
            # Check if allow_ai is explicitly set to false
            settings = organization.settings || %{}
            Map.get(settings, "allow_ai", true) != false
        end
    end
  end

  defp verify_google_access_token(access_token) do
    url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = [{"Authorization", "Bearer #{access_token}"}]

    case HTTPoison.get(url, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, google_info} -> {:ok, google_info}
          {:error, _} -> {:error, :invalid_response}
        end

      _ ->
        {:error, :token_verification_failed}
    end
  end
end
