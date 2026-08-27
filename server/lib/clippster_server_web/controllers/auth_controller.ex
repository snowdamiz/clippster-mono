defmodule ClippsterServerWeb.AuthController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Auth.{ChallengeStore, TokenGenerator}
  alias ClippsterServer.Accounts
  alias ClippsterServer.Affiliates
  alias ClippsterServerWeb.OAuthCallbackTarget

  @google_state_salt "google_oauth_state"
  @oauth_state_max_age 600

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
    |> put_resp_header(
      "access-control-allow-headers",
      "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Client-Platform"
    )
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
      Enum.any?(
        [
          ~r/^http:\/\/localhost:\d+$/,
          ~r/^tauri:\/\//,
          ~r/^https?:\/\/tauri\./
        ],
        fn pattern -> Regex.match?(pattern, origin) end
      )
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
        IO.puts(
          "[AuthController] activity_ping - current_user is nil! assigns: #{inspect(Map.keys(conn.assigns))}"
        )

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
            IO.puts(
              "[AuthController] activity_ping - Failed to update user #{user.id}: #{inspect(reason)}"
            )

            # Log detailed error information
            error_msg =
              case reason do
                %Ecto.Changeset{} = changeset ->
                  errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
                  "Changeset errors: #{inspect(errors)}"

                %Postgrex.Error{} = pg_error ->
                  "Database error: #{inspect(pg_error.postgres)}"

                other ->
                  "Error: #{inspect(other)}"
              end

            IO.puts("[AuthController] activity_ping - Detailed error: #{error_msg}")

            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to update activity", details: error_msg})
        end
    end
  rescue
    e ->
      IO.puts("[AuthController] activity_ping - Exception caught: #{inspect(e)}")
      IO.puts("[AuthController] activity_ping - Stacktrace: #{inspect(__STACKTRACE__)}")

      conn
      |> put_status(500)
      |> json(%{success: false, error: "Internal server error", details: Exception.message(e)})
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

      if is_new_user do
        Appsignal.increment_counter("users.registered", 1, %{method: "wallet"})
      end

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
    payload =
      Jason.encode!(%{
        message: message,
        signature: signature_b64,
        public_key: public_key_b58
      })

    IO.puts("\n=== Calling Node.js signature verification ===")
    IO.puts("Message: #{String.slice(message, 0, 100)}...")
    IO.puts("Public key: #{public_key_b58}")
    IO.puts("Signature (base64): #{String.slice(signature_b64, 0, 20)}...")

    # Write payload to temp file
    temp_file =
      Path.join(System.tmp_dir!(), "sig_verify_#{:erlang.unique_integer([:positive])}.json")

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
    case build_google_auth_url(conn, params, nil) do
      {:ok, google_auth_url} ->
        IO.puts("\n=== Redirecting to Google OAuth ===")
        IO.puts("Google Auth URL: #{google_auth_url}")
        redirect(conn, external: google_auth_url)

      {:error, :not_configured} ->
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        })
    end
  end

  @doc """
  Returns a Google OAuth URL that will switch the authenticated user's Gmail identity.
  The existing Clippster user id (and all owned data) is preserved.
  """
  def google_switch_url(%{assigns: %{current_user_id: user_id}} = conn, params) do
    case build_google_auth_url(conn, params, user_id) do
      {:ok, google_auth_url} ->
        json(conn, %{success: true, url: google_auth_url})

      {:error, :not_configured} ->
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        })
    end
  end

  @doc """
  Switches the authenticated user's linked Gmail/Google account.

  Accepts either:
  - `access_token` — verified against Google userinfo (production)
  - `google_info` — pre-verified map, only when `:allow_test_google_info` is enabled
  """
  def switch_google_account(%{assigns: %{current_user_id: user_id}} = conn, params) do
    with {:ok, google_info} <- resolve_google_info_for_switch(params),
         oauth_info <- %{
           provider_id: google_info["id"],
           email: google_info["email"],
           name: google_info["name"],
           avatar_url: google_info["picture"]
         },
         {:ok, user} <- Accounts.switch_google_account(user_id, oauth_info),
         {:ok, token} <- generate_google_user_token(user) do
      json(conn, %{
        success: true,
        message: "Google account switched successfully",
        token: token,
        user: %{
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          provider: user.provider,
          provider_id: user.provider_id
        }
      })
    else
      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, :google_account_already_linked} ->
        conn
        |> put_status(409)
        |> json(%{
          success: false,
          error: "That Google account is already linked to another Clippster user"
        })

      {:error, :email_already_in_use} ->
        conn
        |> put_status(409)
        |> json(%{
          success: false,
          error: "That email address is already in use by another Clippster user"
        })

      {:error, :missing_provider_id} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Google account id is required"})

      {:error, :invalid_google_token} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid Google access token"})

      {:error, :test_google_info_disabled} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "access_token is required"})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to switch Google account"})
    end
  end

  @doc """
  Handles Google OAuth callback with authorization code.
  """
  def google_callback(conn, %{"code" => code} = params) do
    IO.puts("\n=== Google OAuth Callback ===")
    IO.puts("Received code: #{String.slice(code, 0, 20)}...")

    case parse_oauth_state(conn, params["state"]) do
      {:ok, web_opts} ->
        # Check for error from Google
        if Map.has_key?(params, "error") do
          IO.puts("Google OAuth Error: #{params["error"]}")
          send_auth_error_html(conn, params["error_description"] || params["error"], web_opts)
        else
          callback_url = google_oauth_callback_url(web_opts)

          # Exchange code for tokens
          case exchange_google_code(code, callback_url) do
            {:ok, tokens} ->
              IO.puts("Token exchange successful")

              # Get user info from Google
              case get_google_user_info(tokens["access_token"]) do
                {:ok, google_user} ->
                  IO.puts(
                    "Got user info - Email: #{google_user["email"]}, ID: #{google_user["id"]}"
                  )

                  oauth_info = %{
                    email: google_user["email"],
                    name: google_user["name"],
                    avatar_url: google_user["picture"]
                  }

                  # Extract referral code from OAuth state
                  oauth_referral_code = web_opts[:referral_code]

                  auth_result =
                    case web_opts[:switch_user_id] do
                      switch_user_id when is_integer(switch_user_id) ->
                        switch_info =
                          Map.put(oauth_info, :provider_id, google_user["id"])

                        case Accounts.switch_google_account(switch_user_id, switch_info) do
                          {:ok, user} -> {:ok, user, false}
                          {:error, reason} -> {:error, reason}
                        end

                      _ ->
                        Accounts.get_or_create_oauth_user(
                          "google",
                          google_user["id"],
                          oauth_info,
                          oauth_referral_code
                        )
                    end

                  case auth_result do
                    {:ok, user, is_new_user} ->
                      IO.puts("User created/retrieved: #{user.id}, is_new: #{is_new_user}")

                      if is_new_user do
                        Appsignal.increment_counter("users.registered", 1, %{method: "google"})
                      end

                      case generate_google_user_token(user) do
                        {:ok, token} ->
                          send_auth_success_html(conn, token, user, web_opts, is_new_user)

                        {:error, _reason} ->
                          send_auth_error_html(conn, "Token generation failed", web_opts)
                      end

                    {:error, :google_account_already_linked} ->
                      send_auth_error_html(
                        conn,
                        "That Google account is already linked to another Clippster user",
                        web_opts
                      )

                    {:error, :email_already_in_use} ->
                      send_auth_error_html(
                        conn,
                        "That email address is already in use by another Clippster user",
                        web_opts
                      )

                    {:error, reason} ->
                      IO.puts("Failed to create/switch user: #{inspect(reason)}")

                      send_auth_error_html(
                        conn,
                        "Failed to create or switch user account",
                        web_opts
                      )
                  end

                {:error, reason} ->
                  IO.puts("Failed to get user info: #{inspect(reason)}")

                  send_auth_error_html(
                    conn,
                    "Failed to get user information from Google",
                    web_opts
                  )
              end

            {:error, reason} ->
              IO.puts("Token exchange failed: #{inspect(reason)}")
              send_auth_error_html(conn, "Failed to authenticate with Google", web_opts)
          end
        end

      {:error, reason} ->
        IO.puts("Invalid Google OAuth state: #{inspect(reason)}")
        send_auth_error_html(conn, "Invalid or expired authentication session", %{web: false})
    end
  end

  # Fallback for missing code parameter
  def google_callback(conn, params) do
    IO.puts("\n=== Google OAuth Callback - No Code ===")
    IO.puts("Params: #{inspect(params)}")

    {web_opts, error_msg} =
      case parse_oauth_state(conn, params["state"]) do
        {:ok, opts} ->
          {opts, params["error_description"] || params["error"] || "Authentication failed"}

        {:error, reason} ->
          IO.puts("Invalid Google OAuth state in fallback callback: #{inspect(reason)}")
          {%{web: false}, "Invalid or expired authentication session"}
      end

    send_auth_error_html(conn, error_msg, web_opts)
  end

  defp exchange_google_code(code, callback_url) do
    # Get Google OAuth configuration - try config first, then env vars directly
    config = Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth, [])
    client_id = Keyword.get(config, :client_id) || System.get_env("GOOGLE_CLIENT_ID")
    client_secret = Keyword.get(config, :client_secret) || System.get_env("GOOGLE_CLIENT_SECRET")
    callback_url = callback_url || default_google_oauth_callback_url()

    body =
      URI.encode_query(%{
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

  defp parse_oauth_state(_conn, nil), do: {:error, :missing_state}

  defp parse_oauth_state(conn, state) do
    case Phoenix.Token.verify(conn, @google_state_salt, state, max_age: @oauth_state_max_age) do
      {:ok, payload} when is_map(payload) ->
        web_mode = Map.get(payload, "web", false) == true
        mobile_mode = Map.get(payload, "mobile", false) == true
        invite_mode = Map.get(payload, "invite", false) == true

        origin =
          if web_mode do
            case OAuthCallbackTarget.normalize_web_origin(Map.get(payload, "origin")) do
              {:ok, normalized} -> normalized
              {:error, _reason} -> OAuthCallbackTarget.default_web_origin()
            end
          else
            nil
          end

        switch_user_id =
          case Map.get(payload, "switch_user_id") do
            id when is_integer(id) ->
              id

            id when is_binary(id) ->
              case Integer.parse(id) do
                {parsed, ""} -> parsed
                _ -> nil
              end

            _ ->
              nil
          end

        {:ok,
         %{
           web: web_mode,
           mobile: mobile_mode,
           invite: invite_mode,
           origin: origin,
           redirect_uri: Map.get(payload, "redirect_uri"),
           oauth_callback_base: Map.get(payload, "oauth_callback_base"),
           referral_code: sanitize_referral_code(Map.get(payload, "referral_code")),
           invite_token: Map.get(payload, "invite_token"),
           switch_user_id: switch_user_id
         }}

      {:ok, _other} ->
        {:error, :invalid_state_payload}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp send_auth_success_html(conn, token, user, %{mobile: true, redirect_uri: redirect_uri}, is_new_user)
       when is_binary(redirect_uri) do
    case OAuthCallbackTarget.normalize_mobile_redirect_uri(redirect_uri) do
      {:ok, safe_uri} ->
        user_json =
          Jason.encode!(%{
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
            wallet_address: user.wallet_address,
            is_admin: user.is_admin,
            account_type: user.account_type,
            owned_organization_id: user.owned_organization_id,
            created_by_organization_id: user.created_by_organization_id
          })

        params = %{
          "token" => token,
          "user" => user_json,
          "is_new_user" => to_string(is_new_user)
        }

        redirect(conn, external: OAuthCallbackTarget.append_query(safe_uri, params))

      {:error, _reason} ->
        send_auth_error_html(conn, "Invalid mobile redirect URI", %{mobile: true})
    end
  end

  defp send_auth_success_html(conn, token, _user, %{invite: true}, _is_new_user) do
    # Invite mode: render a small HTML page that posts the JWT token back to the opener window
    html = """
    <!DOCTYPE html>
    <html><head><title>Signing in...</title></head>
    <body style="background:#0a0a0b;color:#f4f4f5;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;">
      <p>Signing you in...</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'google-auth-success', token: '#{token}' }, '*');
          window.close();
        } else {
          document.body.innerHTML = '<p>Authentication successful. You can close this window and return to the invite page.</p>';
        }
      </script>
    </body></html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  defp send_auth_success_html(conn, token, user, %{web: true} = web_opts, is_new_user) do
    # Web mode: redirect to the origin's callback page (avoids COOP issues with window.opener)
    ai_allowed = check_ai_allowed_for_user(user)
    target_origin = web_opts[:origin] || OAuthCallbackTarget.default_web_origin()

    user_json =
      Jason.encode!(%{
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

    params =
      URI.encode_query(%{
        "token" => token,
        "user" => user_json,
        "is_new_user" => to_string(is_new_user)
      })

    redirect(conn, external: "#{target_origin}/auth/google/callback?#{params}")
  end

  defp send_auth_success_html(conn, token, user, _web_opts, is_new_user) do
    # Tauri mode: redirect to local callback server
    ai_allowed = check_ai_allowed_for_user(user)

    # Get subscription status
    subscription_status = ClippsterServer.Subscriptions.get_subscription_status(user.id)

    # Get credits balance
    {:ok, credits_balance} = ClippsterServer.Credits.get_user_balance(user.id)

    params =
      URI.encode_query(%{
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
        "is_new_user" => to_string(is_new_user),
        "subscription_status" => subscription_status.status,
        "subscription_tier" => subscription_status.tier || "",
        "subscription_tier_name" => subscription_status.tier_name || "",
        "subscription_needs_subscription" => subscription_status.needs_subscription,
        "subscription_days_remaining" => subscription_status.days_remaining,
        "credits_hours_remaining" => Decimal.to_string(credits_balance.hours_remaining)
      })

    redirect(conn, external: "http://localhost:54321/google-callback?#{params}")
  end

  defp send_auth_error_html(conn, error_message, %{mobile: true, redirect_uri: redirect_uri})
       when is_binary(redirect_uri) do
    case OAuthCallbackTarget.normalize_mobile_redirect_uri(redirect_uri) do
      {:ok, safe_uri} ->
        redirect(conn, external: OAuthCallbackTarget.append_query(safe_uri, %{"error" => error_message}))

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: error_message})
    end
  end

  defp send_auth_error_html(conn, error_message, %{mobile: true}) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: error_message})
  end

  defp send_auth_error_html(conn, error_message, %{invite: true}) do
    # Invite mode: show error in popup
    html = """
    <!DOCTYPE html>
    <html><head><title>Authentication Error</title></head>
    <body style="background:#0a0a0b;color:#f4f4f5;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;">
      <div style="text-align:center;">
        <p style="color:#ef4444;">Authentication failed: #{error_message}</p>
        <p><a href="#" onclick="window.close()" style="color:#06b6d4;">Close this window and try again</a></p>
      </div>
    </body></html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  defp send_auth_error_html(conn, error_message, %{web: true} = web_opts) do
    # Web mode: redirect to the origin's callback page with error (avoids COOP issues)
    target_origin = web_opts[:origin] || OAuthCallbackTarget.default_web_origin()
    params = URI.encode_query(%{"error" => error_message})
    redirect(conn, external: "#{target_origin}/auth/google/callback?#{params}")
  end

  defp send_auth_error_html(conn, error_message, _web_opts) do
    # Tauri mode: redirect to local callback server
    params =
      URI.encode_query(%{
        "success" => "false",
        "error" => error_message
      })

    redirect(conn, external: "http://localhost:54321/google-callback?#{params}")
  end

  defp maybe_put_state_value(map, _key, nil), do: map
  defp maybe_put_state_value(map, key, value), do: Map.put(map, key, value)

  defp sanitize_referral_code(nil), do: nil

  defp sanitize_referral_code(referral_code) when is_binary(referral_code) do
    cleaned = String.trim(referral_code)

    cond do
      cleaned == "" -> nil
      String.length(cleaned) > 128 -> nil
      true -> cleaned
    end
  end

  defp sanitize_referral_code(_), do: nil

  @doc """
  Links / switches a Google account on an existing authenticated user.
  Preserves the Clippster user id and all owned data.
  """
  def link_google_account(conn, params) do
    switch_google_account(conn, params)
  end

  @doc """
  Get current user info (requires auth via AuthPlug).
  Returns fresh user data from the database.
  """
  def me(conn, _params) do
    user = conn.assigns.current_user

    # Check if AI is allowed for this user
    ai_allowed = check_ai_allowed_for_user(user)

    # Get subscription status
    subscription_status = ClippsterServer.Subscriptions.get_subscription_status(user.id)

    # Get credits balance
    {:ok, credits_balance} = ClippsterServer.Credits.get_user_balance(user.id)

    json(conn, %{
      success: true,
      user: %{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        wallet_address: user.wallet_address,
        is_admin: user.is_admin,
        is_moderator: user.is_moderator,
        ai_editor_enabled: user.ai_editor_enabled,
        campaigns_enabled: user.campaigns_enabled,
        account_type: user.account_type,
        owned_organization_id: user.owned_organization_id,
        created_by_organization_id: user.created_by_organization_id,
        ai_allowed: ai_allowed,
        beta_activated: user.beta_activated,
        is_affiliate: Affiliates.is_affiliate?(user.id),
        subscription: subscription_status,
        credits: %{
          hours_remaining: credits_balance.hours_remaining,
          minutes_remaining: Decimal.mult(credits_balance.hours_remaining, Decimal.new("60"))
        },
        preferences: %{
          time_format_preference: user.time_format_preference || "12hr",
          toast_enabled: user.toast_enabled,
          toast_duration: user.toast_duration || 5000,
          toast_position: user.toast_position || "bottom-right",
          toast_sound_enabled: user.toast_sound_enabled,
          toast_background_enabled: user.toast_background_enabled,
          notify_livestream: user.notify_livestream,
          notify_clips: user.notify_clips,
          notify_downloads: user.notify_downloads,
          notify_projects: user.notify_projects,
          notify_social: user.notify_social,
          notify_organization: user.notify_organization,
          notify_system: user.notify_system
        }
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

  defp resolve_google_info_for_switch(%{"access_token" => access_token})
       when is_binary(access_token) and access_token != "" do
    case verify_google_access_token(access_token) do
      {:ok, info} -> {:ok, info}
      {:error, _} -> {:error, :invalid_google_token}
    end
  end

  defp resolve_google_info_for_switch(%{"google_info" => google_info}) when is_map(google_info) do
    if Application.get_env(:clippster_server, :allow_test_google_info, false) do
      id = google_info["id"] || google_info[:id]

      if is_binary(id) or is_integer(id) do
        {:ok,
         %{
           "id" => to_string(id),
           "email" => google_info["email"] || google_info[:email],
           "name" => google_info["name"] || google_info[:name],
           "picture" => google_info["picture"] || google_info[:picture]
         }}
      else
        {:error, :missing_provider_id}
      end
    else
      {:error, :test_google_info_disabled}
    end
  end

  defp resolve_google_info_for_switch(_), do: {:error, :test_google_info_disabled}

  defp generate_google_user_token(user) do
    token_claims = %{
      "sub" => "google:#{user.provider_id}",
      "iat" => DateTime.utc_now() |> DateTime.to_unix(),
      "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
      "provider" => "google",
      "provider_id" => user.provider_id,
      "user_id" => user.id,
      "is_admin" => user.is_admin,
      "is_moderator" => user.is_moderator,
      "email" => user.email
    }

    TokenGenerator.generate_token(token_claims)
  end

  defp build_google_auth_url(conn, params, switch_user_id) do
    config = Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth, [])
    client_id = Keyword.get(config, :client_id) || System.get_env("GOOGLE_CLIENT_ID")

    if is_nil(client_id) or client_id == "" do
      {:error, :not_configured}
    else
      web_mode = params["web"] == "true"
      mobile_mode = params["mobile"] == "true"
      invite_mode = params["redirect_mode"] == "invite"
      web_origin = params["origin"]
      mobile_redirect_uri = params["redirect_uri"]
      mobile_oauth_callback_base = params["oauth_callback_base"]
      referral_code = sanitize_referral_code(params["referral_code"])
      invite_token = params["invite_token"]

      google_callback_url =
        if mobile_mode do
          case resolve_mobile_google_callback_url(mobile_oauth_callback_base) do
            {:ok, url} -> url
            {:error, _reason} -> default_google_oauth_callback_url()
          end
        else
          default_google_oauth_callback_url()
        end

      target_origin =
        if web_mode and not mobile_mode do
          case OAuthCallbackTarget.normalize_web_origin(web_origin || "") do
            {:ok, origin} -> origin
            {:error, _reason} -> OAuthCallbackTarget.default_web_origin()
          end
        else
          nil
        end

      state_payload =
        %{"web" => web_mode and not mobile_mode}
        |> maybe_put_state_value("mobile", if(mobile_mode, do: true, else: nil))
        |> maybe_put_state_value(
          "redirect_uri",
          if(mobile_mode, do: mobile_redirect_uri, else: nil)
        )
        |> maybe_put_state_value(
          "oauth_callback_base",
          if(mobile_mode, do: mobile_oauth_callback_base, else: nil)
        )
        |> maybe_put_state_value("origin", target_origin)
        |> maybe_put_state_value("referral_code", referral_code)
        |> maybe_put_state_value("invite", if(invite_mode, do: true, else: nil))
        |> maybe_put_state_value("invite_token", invite_token)
        |> maybe_put_state_value("switch_user_id", switch_user_id)

      state_data = Phoenix.Token.sign(conn, @google_state_salt, state_payload)

      # Force account picker when switching so the user can choose another Gmail
      prompt = if switch_user_id, do: "select_account consent", else: "consent"

      google_auth_url =
        "https://accounts.google.com/o/oauth2/v2/auth?" <>
          URI.encode_query(%{
            "client_id" => client_id,
            "redirect_uri" => google_callback_url,
            "response_type" => "code",
            "scope" => "email profile",
            "state" => state_data,
            "access_type" => "offline",
            "prompt" => prompt
          })

      {:ok, google_auth_url}
    end
  end

  defp default_google_oauth_callback_url do
    "#{ClippsterServerWeb.Endpoint.url()}/api/auth/google/callback"
  end

  defp resolve_mobile_google_callback_url(base) when is_binary(base) do
    case OAuthCallbackTarget.normalize_mobile_oauth_callback_base(base) do
      {:ok, origin} -> {:ok, origin <> "/api/auth/google/callback"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp resolve_mobile_google_callback_url(_), do: {:error, :missing_callback_base}

  defp google_oauth_callback_url(%{mobile: true, oauth_callback_base: base}) when is_binary(base) do
    case resolve_mobile_google_callback_url(base) do
      {:ok, url} -> url
      {:error, _reason} -> default_google_oauth_callback_url()
    end
  end

  defp google_oauth_callback_url(_web_opts), do: default_google_oauth_callback_url()
end
