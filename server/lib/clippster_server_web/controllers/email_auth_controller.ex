defmodule ClippsterServerWeb.EmailAuthController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Accounts
  alias ClippsterServer.Auth.TokenGenerator

  @email_verification_callback_port 54322

  @doc """
  Register a new user with email and password.
  """
  def register(conn, %{"email" => email, "password" => password}) do
    case Accounts.register_with_email(email, password) do
      {:ok, _user} ->
        json(conn, %{
          success: true,
          message: "Verification email sent. Please check your inbox."
        })

      {:error, :email_already_registered} ->
        conn
        |> put_status(409)
        |> json(%{success: false, error: "An account with this email already exists"})

      {:error, %Ecto.Changeset{} = changeset} ->
        errors = format_changeset_errors(changeset)

        conn
        |> put_status(422)
        |> json(%{success: false, error: errors})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Registration failed: #{inspect(reason)}"})
    end
  end

  @doc """
  Verify email using 6-digit OTP code.
  """
  def verify_otp(conn, %{"email" => email, "otp" => otp}) do
    case Accounts.verify_email_otp(email, otp) do
      {:ok, user} ->
        # Generate JWT token for immediate login
        token_claims = %{
          "sub" => "email:#{user.id}",
          "iat" => DateTime.utc_now() |> DateTime.to_unix(),
          "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
          "provider" => "email",
          "user_id" => user.id,
          "is_admin" => user.is_admin,
          "email" => user.email
        }

        case TokenGenerator.generate_token(token_claims) do
          {:ok, token} ->
            json(conn, %{
              success: true,
              token: token,
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin,
                account_type: user.account_type,
                owned_organization_id: user.owned_organization_id
              }
            })

          {:error, _reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Token generation failed"})
        end

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, :already_verified} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Email already verified"})

      {:error, :too_many_attempts} ->
        conn
        |> put_status(429)
        |> json(%{success: false, error: "Too many attempts. Please request a new code."})

      {:error, :otp_expired} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Verification code expired. Please request a new one."})

      {:error, :invalid_otp} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid verification code"})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Verification failed"})
    end
  end

  @doc """
  Verify email using magic link token.
  Renders HTML page that communicates back to Tauri app.
  """
  def verify_token(conn, %{"token" => token}) do
    case Accounts.verify_email_token(token) do
      {:ok, user} ->
        # Generate JWT token
        token_claims = %{
          "sub" => "email:#{user.id}",
          "iat" => DateTime.utc_now() |> DateTime.to_unix(),
          "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
          "provider" => "email",
          "user_id" => user.id,
          "is_admin" => user.is_admin,
          "email" => user.email
        }

        case TokenGenerator.generate_token(token_claims) do
          {:ok, jwt_token} ->
            send_verification_success_html(conn, jwt_token, user)

          {:error, _reason} ->
            send_verification_error_html(conn, "Token generation failed")
        end

      {:error, :invalid_token} ->
        send_verification_error_html(conn, "Invalid or expired verification link")

      {:error, :already_verified} ->
        send_verification_error_html(conn, "Email already verified. You can close this window.")

      {:error, :token_expired} ->
        send_verification_error_html(conn, "Verification link has expired. Please request a new one.")

      {:error, _reason} ->
        send_verification_error_html(conn, "Verification failed")
    end
  end

  @doc """
  Login with email and password.
  """
  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate_with_email(email, password) do
      {:ok, user} ->
        token_claims = %{
          "sub" => "email:#{user.id}",
          "iat" => DateTime.utc_now() |> DateTime.to_unix(),
          "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
          "provider" => "email",
          "user_id" => user.id,
          "is_admin" => user.is_admin,
          "email" => user.email
        }

        case TokenGenerator.generate_token(token_claims) do
          {:ok, token} ->
            json(conn, %{
              success: true,
              token: token,
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin,
                account_type: user.account_type,
                owned_organization_id: user.owned_organization_id
              }
            })

          {:error, _reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Token generation failed"})
        end

      {:error, :invalid_credentials} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid email or password"})

      {:error, :email_not_verified} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Please verify your email before logging in", code: "EMAIL_NOT_VERIFIED"})

      {:error, :wrong_auth_method} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "This email is registered with a different sign-in method"})

      {:error, _reason} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Authentication failed"})
    end
  end

  @doc """
  Resend verification email.
  """
  def resend_verification(conn, %{"email" => email}) do
    case Accounts.resend_verification(email) do
      {:ok, _user} ->
        json(conn, %{
          success: true,
          message: "Verification email sent. Please check your inbox."
        })

      {:error, :not_found} ->
        # Don't reveal if email exists
        json(conn, %{
          success: true,
          message: "If an account exists, a verification email has been sent."
        })

      {:error, :already_verified} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Email already verified"})

      {:error, :not_email_user} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "This email is registered with a different sign-in method"})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to send verification email"})
    end
  end

  @doc """
  Request password reset.
  """
  def forgot_password(conn, %{"email" => email}) do
    # Always return success to prevent email enumeration
    Accounts.request_password_reset(email)

    json(conn, %{
      success: true,
      message: "If an account exists with this email, you will receive a password reset link."
    })
  end

  @doc """
  Reset password with token.
  """
  def reset_password(conn, %{"token" => token, "password" => password}) do
    case Accounts.reset_password(token, password) do
      {:ok, _user} ->
        json(conn, %{
          success: true,
          message: "Password reset successful. You can now log in with your new password."
        })

      {:error, :invalid_token} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid or expired reset link"})

      {:error, :token_expired} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Reset link has expired. Please request a new one."})

      {:error, %Ecto.Changeset{} = changeset} ->
        errors = format_changeset_errors(changeset)

        conn
        |> put_status(422)
        |> json(%{success: false, error: errors})

      {:error, _reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Password reset failed"})
    end
  end

  # ============================================
  # HTML Response Helpers
  # ============================================

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

  defp send_verification_success_html(conn, token, user) do
    escaped_email = (user.email || "") |> String.replace("\"", "\\\"")
    escaped_name = (user.name || "") |> String.replace("\"", "\\\"")

    html_response = """
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verified - Clippster</title>
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
              <h1>Email Verified!</h1>
              <p class="subtitle">Your account has been verified successfully</p>
            </div>
            <div class="message-box success">✓ You can close this window now</div>
          </div>
        </div>
      </div>
      <script>
        const authData = {
          success: true,
          token: "#{token}",
          provider: "email",
          user: {
            id: #{user.id},
            email: "#{escaped_email}",
            name: "#{escaped_name}",
            is_admin: #{user.is_admin},
            account_type: #{if user.account_type, do: "\"#{user.account_type}\"", else: "null"},
            owned_organization_id: #{user.owned_organization_id || "null"}
          }
        };

        // Post to local Tauri callback server
        fetch('http://localhost:#{@email_verification_callback_port}/email-verification-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authData)
        }).catch(console.error);

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

  defp send_verification_error_html(conn, error_message) do
    escaped_error = error_message |> String.replace("\"", "\\\"")

    html_response = """
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Failed - Clippster</title>
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
              <h1>Verification Failed</h1>
              <p class="subtitle">#{escaped_error}</p>
            </div>
            <div class="message-box error">Please try again or request a new verification code</div>
            <button class="close-btn" onclick="window.close()">Close Window</button>
          </div>
        </div>
      </div>
      <script>
        // Notify Tauri of failure
        fetch('http://localhost:#{@email_verification_callback_port}/email-verification-callback', {
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

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end


