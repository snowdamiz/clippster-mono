defmodule ClippsterServerWeb.AuthController do
  use ClippsterServerWeb, :controller
  
  alias ClippsterServer.Auth.{ChallengeStore, TokenGenerator}
  alias ClippsterServer.Accounts

  @sign_message_template """
  <%= domain %> wants you to sign in with your Solana account:
  <%= wallet_address %>

  Nonce: <%= nonce %>
  Issued At: <%= timestamp %>
  Chain ID: mainnet-beta
  """

  # Handle OPTIONS requests for CORS preflight
  def options(conn, _params) do
    conn
    |> put_resp_header("access-control-allow-origin", get_req_header(conn, "origin") |> List.first() || "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(200, "")
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
      
      # Create or get user
      {:ok, user} = Accounts.get_or_create_user(public_key)
      
      # Generate JWT token
      token_claims = %{
        "sub" => public_key,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
        "wallet_address" => public_key,
        "user_id" => user.id,
        "is_admin" => user.is_admin
      }

      case TokenGenerator.generate_token(token_claims) do
        {:ok, token} ->
          json(conn, %{
            success: true,
            token: token,
            wallet_address: public_key,
            user: %{
              id: user.id,
              wallet_address: user.wallet_address,
              is_admin: user.is_admin
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
    script_path = Path.join([Path.dirname(__ENV__.file), "../../../sig_verify.js"]) |> Path.expand()
    node_path = find_node_executable()
    
    IO.puts("Node path: #{node_path}")
    IO.puts("Script path: #{script_path}")
    IO.puts("Temp file: #{temp_file}")
    
    result = case System.cmd(node_path, [script_path, temp_file], 
      stderr_to_stdout: true
    ) do
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

  # Find the actual node executable, avoiding wrapper scripts
  defp find_node_executable do
    case :os.type() do
      {:win32, _} ->
        # On Windows, use 'where' to find all node executables
        case System.cmd("where", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            # Parse output and find first real node.exe (not in temp/yarn directory)
            output
            |> String.split("\n", trim: true)
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&String.contains?(&1, "yarn--"))
            |> Enum.reject(&String.contains?(&1, "Temp"))
            |> Enum.find(&String.ends_with?(&1, "node.exe"))
            |> case do
              nil -> "node"  # Fallback
              path -> path
            end

          _ ->
            # Fallback: try common Windows installation paths
            [
              System.get_env("ProgramFiles") <> "\\nodejs\\node.exe",
              System.get_env("ProgramFiles(x86)") <> "\\nodejs\\node.exe",
              "C:\\Program Files\\nodejs\\node.exe",
              "C:\\Program Files (x86)\\nodejs\\node.exe"
            ]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end

      {:unix, _} ->
        # On Unix/Linux/Mac, use 'which' to find node
        case System.cmd("which", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> List.first()
            |> String.trim()

          _ ->
            # Try common Unix paths
            ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end
    end
  end

  # ============================================
  # Google OAuth Handlers
  # ============================================

  @doc """
  Initiates Google OAuth flow by redirecting to Google's authorization URL.
  """
  def google_request(conn, _params) do
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
      state = :crypto.strong_rand_bytes(16) |> Base.url_encode64(padding: false)
      
      google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" <> URI.encode_query(%{
        "client_id" => client_id,
        "redirect_uri" => callback_url,
        "response_type" => "code",
        "scope" => scope,
        "state" => state,
        "access_type" => "offline",
        "prompt" => "consent"
      })
      
      IO.puts("\n=== Redirecting to Google OAuth ===")
      IO.puts("Callback URL: #{callback_url}")
      IO.puts("Google Auth URL: #{google_auth_url}")
      
      redirect(conn, external: google_auth_url)
    end
  end

  @doc """
  Handles Google OAuth callback with authorization code.
  """
  def google_callback(conn, %{"code" => code} = params) do
    IO.puts("\n=== Google OAuth Callback ===")
    IO.puts("Received code: #{String.slice(code, 0, 20)}...")
    
    # Check for error from Google
    if Map.has_key?(params, "error") do
      IO.puts("Google OAuth Error: #{params["error"]}")
      send_auth_error_html(conn, params["error_description"] || params["error"])
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

              case Accounts.get_or_create_oauth_user("google", google_user["id"], oauth_info) do
                {:ok, user} ->
                  IO.puts("User created/retrieved: #{user.id}")
                  
                  # Generate JWT token
                  token_claims = %{
                    "sub" => "google:#{google_user["id"]}",
                    "iat" => DateTime.utc_now() |> DateTime.to_unix(),
                    "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
                    "provider" => "google",
                    "provider_id" => google_user["id"],
                    "user_id" => user.id,
                    "is_admin" => user.is_admin,
                    "email" => user.email
                  }

                  case TokenGenerator.generate_token(token_claims) do
                    {:ok, token} ->
                      send_auth_success_html(conn, token, user)

                    {:error, _reason} ->
                      send_auth_error_html(conn, "Token generation failed")
                  end

                {:error, reason} ->
                  IO.puts("Failed to create user: #{inspect(reason)}")
                  send_auth_error_html(conn, "Failed to create user account")
              end

            {:error, reason} ->
              IO.puts("Failed to get user info: #{inspect(reason)}")
              send_auth_error_html(conn, "Failed to get user information from Google")
          end

        {:error, reason} ->
          IO.puts("Token exchange failed: #{inspect(reason)}")
          send_auth_error_html(conn, "Failed to authenticate with Google")
      end
    end
  end

  # Fallback for missing code parameter
  def google_callback(conn, params) do
    IO.puts("\n=== Google OAuth Callback - No Code ===")
    IO.puts("Params: #{inspect(params)}")
    
    error_msg = params["error_description"] || params["error"] || "Authentication failed"
    send_auth_error_html(conn, error_msg)
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

  @auth_page_styles """
  <style>
    :root {
      --background: oklch(0.145 0 0);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.145 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --success: oklch(0.696 0.17 162.48);
      --success-bg: oklch(0.269 0.05 162.48);
      --destructive: oklch(0.396 0.141 25.723);
      --destructive-foreground: oklch(0.637 0.237 25.331);
      --radius: 0.625rem;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--background);
      color: var(--foreground);
      padding: 1.5rem;
    }
    .container { max-width: 28rem; width: 100%; }
    .card {
      position: relative;
      overflow: hidden;
      border-radius: calc(var(--radius) * 2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      background: var(--card);
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .gradient-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 50%, rgba(147, 51, 234, 0.03) 100%);
      pointer-events: none;
    }
    .content { position: relative; padding: 2rem; }
    .icon-container { display: flex; justify-content: center; margin-bottom: 1.5rem; }
    .icon-wrapper {
      padding: 1rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .icon-wrapper.success { background: var(--success-bg); }
    .icon-wrapper.error { background: rgba(239, 68, 68, 0.1); }
    .icon { width: 3rem; height: 3rem; }
    .icon.success { color: var(--success); }
    .icon.error { color: var(--destructive-foreground); }
    .text-center { text-align: center; margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .subtitle { font-size: 0.875rem; color: var(--muted-foreground); }
    .message-box {
      padding: 0.75rem 1rem;
      border-radius: calc(var(--radius) - 2px);
      font-size: 0.875rem;
      text-align: center;
      font-weight: 500;
    }
    .message-box.success {
      color: var(--success);
      background: var(--success-bg);
      border: 1px solid rgba(104, 211, 145, 0.2);
    }
    .message-box.error {
      color: var(--destructive-foreground);
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .close-btn {
      width: 100%;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: var(--foreground);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .close-btn:hover { background: rgba(255, 255, 255, 0.05); }
  </style>
  """

  defp send_auth_success_html(conn, token, user) do
    # Escape values for safe JavaScript embedding
    escaped_email = (user.email || "") |> String.replace("\"", "\\\"")
    escaped_name = (user.name || "") |> String.replace("\"", "\\\"")
    escaped_avatar = (user.avatar_url || "") |> String.replace("\"", "\\\"")
    
    html_response = """
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Successful - Clippster</title>
      #{@auth_page_styles}
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="gradient-overlay"></div>
          <div class="content">
            <div class="icon-container">
              <div class="icon-wrapper success">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div class="text-center">
              <h1>Authentication Successful</h1>
              <p class="subtitle">You have been signed in with Google</p>
            </div>
            <div class="message-box success">✓ You can close this window now</div>
          </div>
        </div>
      </div>
      <script>
        const authData = {
          success: true,
          token: "#{token}",
          provider: "google",
          user: {
            id: #{user.id},
            email: "#{escaped_email}",
            name: "#{escaped_name}",
            avatar_url: "#{escaped_avatar}",
            is_admin: #{user.is_admin},
            account_type: #{if user.account_type, do: "\"#{user.account_type}\"", else: "null"},
            owned_organization_id: #{user.owned_organization_id || "null"}
          }
        };
        
        // Post to local Tauri callback server
        fetch('http://localhost:54321/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authData)
        }).catch(console.error);
        
        // Also try parent window postMessage for popup flow
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', ...authData }, '*');
          setTimeout(() => window.close(), 1500);
        }
        
        // Try to close window after delay
        setTimeout(() => {
          window.close();
        }, 2000);
      </script>
    </body>
    </html>
    """
    
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html_response)
  end

  defp send_auth_error_html(conn, error_message) do
    escaped_error = error_message |> String.replace("\"", "\\\"")
    
    html_response = """
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Failed - Clippster</title>
      #{@auth_page_styles}
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="gradient-overlay"></div>
          <div class="content">
            <div class="icon-container">
              <div class="icon-wrapper error">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div class="text-center">
              <h1>Authentication Failed</h1>
              <p class="subtitle">#{escaped_error}</p>
            </div>
            <div class="message-box error">Please try again or use a different sign-in method</div>
            <button class="close-btn" onclick="window.close()">Close Window</button>
          </div>
        </div>
      </div>
      <script>
        // Notify Tauri of failure
        fetch('http://localhost:54321/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: "#{escaped_error}" })
        }).catch(console.error);
      </script>
    </body>
    </html>
    """
    
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html_response)
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
