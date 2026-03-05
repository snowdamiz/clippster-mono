defmodule ClippsterServerWeb.EmailAuthController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Accounts
  alias ClippsterServer.Organizations
  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.Affiliates

  @email_verification_callback_port 54322

  @doc """
  Register a new user with email and password.
  """
  def register(conn, %{"email" => email, "password" => password} = params) do
    referral_code = params["referral_code"]

    case Accounts.register_with_email(email, password, referral_code) do
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
          "is_moderator" => user.is_moderator,
          "email" => user.email
        }

        case TokenGenerator.generate_token(token_claims) do
          {:ok, token} ->
            ai_allowed = check_ai_allowed_for_user(user)

            json(conn, %{
              success: true,
              token: token,
              is_new_user: true,
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin,
                is_moderator: user.is_moderator,
                account_type: user.account_type,
                owned_organization_id: user.owned_organization_id,
                created_by_organization_id: user.created_by_organization_id,
                ai_allowed: ai_allowed,
                is_affiliate: Affiliates.is_affiliate?(user.id)
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
          "is_moderator" => user.is_moderator,
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
        send_verification_error_html(
          conn,
          "Verification link has expired. Please request a new one."
        )

      {:error, _reason} ->
        send_verification_error_html(conn, "Verification failed")
    end
  end

  @doc """
  Login with email and password.
  """
  def login(conn, %{"email" => email, "password" => password}) do
    require Logger
    Logger.info("Login attempt for email: #{email}")

    case Accounts.authenticate_with_email(email, password) do
      {:ok, user} ->
        token_claims = %{
          "sub" => "email:#{user.id}",
          "iat" => DateTime.utc_now() |> DateTime.to_unix(),
          "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
          "provider" => "email",
          "user_id" => user.id,
          "is_admin" => user.is_admin,
          "is_moderator" => user.is_moderator,
          "email" => user.email
        }

        case TokenGenerator.generate_token(token_claims) do
          {:ok, token} ->
            ai_allowed = check_ai_allowed_for_user(user)

            json(conn, %{
              success: true,
              token: token,
              is_new_user: false,
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin,
                is_moderator: user.is_moderator,
                account_type: user.account_type,
                owned_organization_id: user.owned_organization_id,
                created_by_organization_id: user.created_by_organization_id,
                ai_allowed: ai_allowed,
                is_affiliate: Affiliates.is_affiliate?(user.id)
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
        |> json(%{
          success: false,
          error: "Please verify your email before logging in",
          code: "EMAIL_NOT_VERIFIED"
        })

      {:error, :wrong_auth_method} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "This email is registered with a different sign-in method"
        })

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
        |> json(%{
          success: false,
          error: "This email is registered with a different sign-in method"
        })

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
    .logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2rem; }
    .container { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  </style>
  """

  @logo_html ~S(<div class="logo"><svg width="32" height="32" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_1170_213)"><rect width="1024" height="1024" rx="250" fill="#F8F8F8"/><path d="M834.343 499.337C843.771 504.707 843.771 518.297 834.343 523.667L591.997 661.706C582.663 667.023 571.067 660.282 571.067 649.542L571.067 373.462C571.067 362.721 582.663 355.981 591.997 361.297L834.343 499.337Z" fill="#111212"/><path d="M414.797 522.603C405.416 517.224 405.416 503.693 414.797 498.313L611.831 385.331C621.164 379.979 632.795 386.717 632.795 397.476L632.795 623.441C632.795 634.2 621.164 640.938 611.831 635.586L414.797 522.603Z" fill="#111212"/><path d="M526.51 323.63C535.843 329.018 535.843 342.49 526.51 347.878L283.877 487.961C274.544 493.35 262.877 486.614 262.877 475.837L262.877 195.671C262.877 184.894 274.544 178.158 283.877 183.546L526.51 323.63Z" fill="#111212"/><path d="M526.51 675.124C535.843 680.512 535.843 693.984 526.51 699.372L283.877 839.456C274.544 844.844 262.877 838.108 262.877 827.331L262.877 547.165C262.877 536.388 274.544 529.652 283.877 535.041L526.51 675.124Z" fill="#111212"/></g><defs><clipPath id="clip0_1170_213"><rect width="1024" height="1024" fill="white"/></clipPath></defs></svg><svg height="20" viewBox="0 0 215 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.624 32.896C10.624 36.4373 11.2427 38.9973 12.48 40.576C13.7173 42.112 15.6587 42.88 18.304 42.88C20.736 42.88 23.04 42.3253 25.216 41.216C27.4347 40.064 29.2907 38.4853 30.784 36.48L32.256 37.12C30.848 40.7467 28.3947 43.648 24.896 45.824C21.44 47.9573 17.8133 49.024 14.016 49.024C9.06666 49.024 5.48266 47.7867 3.264 45.312C1.088 42.7947 -3.33786e-06 38.784 -3.33786e-06 33.28C-3.33786e-06 29.7387 0.447997 26.048 1.344 22.208C2.24 18.368 3.47733 14.9333 5.056 11.904C7.104 8.02133 9.57866 5.07733 12.48 3.072C15.424 1.024 18.7093 -3.8147e-06 22.336 -3.8147e-06C25.7493 -3.8147e-06 28.3733 0.746663 30.208 2.24C32.0853 3.69066 33.024 5.80266 33.024 8.576C33.024 10.496 32.64 11.968 31.872 12.992C31.104 13.9733 29.9947 14.464 28.544 14.464C27.8187 14.464 27.136 14.336 26.496 14.08C25.8987 13.7813 25.3653 13.3547 24.896 12.8C25.664 12.416 26.3467 11.648 26.944 10.496C27.5413 9.30133 27.84 8.10667 27.84 6.912C27.84 5.67467 27.4987 4.71467 26.816 4.032C26.1333 3.34933 25.1733 3.008 23.936 3.008C22.0587 3.008 20.2027 4.16 18.368 6.464C16.5333 8.72533 14.9333 11.8613 13.568 15.872C12.6293 18.6027 11.904 21.4613 11.392 24.448C10.88 27.392 10.624 30.208 10.624 32.896ZM30.0845 40.704C30.0845 40.1493 30.1272 39.5307 30.2125 38.848C30.2978 38.1227 30.4258 37.3547 30.5965 36.544L37.4445 4.48L46.9165 3.2L39.5565 37.76C39.4712 38.144 39.4072 38.5067 39.3645 38.848C39.3218 39.1467 39.3005 39.4667 39.3005 39.808C39.3005 40.6613 39.4925 41.28 39.8765 41.664C40.3032 42.0053 40.9858 42.176 41.9245 42.176C43.1192 42.176 44.2498 41.664 45.3165 40.64C46.3832 39.5733 47.1725 38.208 47.6845 36.544H50.3725C49.0072 40.4267 47.1725 43.3707 44.8685 45.376C42.5645 47.3813 39.9192 48.384 36.9325 48.384C34.7992 48.384 33.1138 47.7227 31.8765 46.4C30.6818 45.0347 30.0845 43.136 30.0845 40.704ZM63.1545 7.488C63.1545 8.896 62.6425 10.0907 61.6185 11.072C60.6372 12.0533 59.4425 12.544 58.0345 12.544C56.6265 12.544 55.4318 12.0533 54.4505 11.072C53.4692 10.0907 52.9785 8.896 52.9785 7.488C52.9785 6.08 53.4692 4.88533 54.4505 3.904C55.4318 2.88 56.6265 2.368 58.0345 2.368C59.4425 2.368 60.6372 2.88 61.6185 3.904C62.6425 4.88533 63.1545 6.08 63.1545 7.488ZM46.8345 40.704C46.8345 40.1493 46.8772 39.5307 46.9625 38.848C47.0478 38.1227 47.1758 37.3547 47.3465 36.544L51.6985 16H60.9145L56.3065 37.76C56.2212 38.144 56.1572 38.5067 56.1145 38.848C56.0718 39.1467 56.0505 39.4667 56.0505 39.808C56.0505 40.6613 56.2425 41.28 56.6265 41.664C57.0532 42.0053 57.7358 42.176 58.6745 42.176C59.8692 42.176 60.9998 41.664 62.0665 40.64C63.1332 39.5733 63.9225 38.208 64.4345 36.544H67.1225C65.7572 40.4267 63.9225 43.3707 61.6185 45.376C59.3145 47.3813 56.6692 48.384 53.6825 48.384C51.5492 48.384 49.8638 47.7227 48.6265 46.4C47.4318 45.0347 46.8345 43.136 46.8345 40.704ZM72.601 41.344C72.7717 41.8133 73.0703 42.176 73.497 42.432C73.9237 42.688 74.4357 42.816 75.033 42.816C77.721 42.816 79.8757 41.088 81.497 37.632C83.161 34.176 83.993 30.1653 83.993 25.6C83.993 23.8507 83.737 22.528 83.225 21.632C82.713 20.736 81.9023 20.288 80.793 20.288C80.025 20.288 79.2357 20.5867 78.425 21.184C77.6143 21.7387 76.9317 22.4853 76.377 23.424L72.601 41.344ZM68.249 61.696L58.585 64L69.273 13.632H78.489L77.465 18.432C78.5317 17.536 79.6837 16.8533 80.921 16.384C82.1583 15.9147 83.5023 15.68 84.953 15.68C87.513 15.68 89.4543 16.5333 90.777 18.24C92.0997 19.9467 92.761 22.464 92.761 25.792C92.761 32.32 91.353 37.7173 88.537 41.984C85.7637 46.2507 81.9237 48.384 77.017 48.384C75.6517 48.384 74.4997 48.192 73.561 47.808C72.665 47.424 72.0037 46.848 71.577 46.08L68.249 61.696ZM102.538 41.344C102.709 41.8133 103.008 42.176 103.434 42.432C103.861 42.688 104.373 42.816 104.97 42.816C107.658 42.816 109.813 41.088 111.434 37.632C113.098 34.176 113.93 30.1653 113.93 25.6C113.93 23.8507 113.674 22.528 113.162 21.632C112.65 20.736 111.84 20.288 110.73 20.288C109.962 20.288 109.173 20.5867 108.362 21.184C107.552 21.7387 106.869 22.4853 106.314 23.424L102.538 41.344ZM98.1865 61.696L88.5225 64L99.2105 13.632H108.426L107.402 18.432C108.469 17.536 109.621 16.8533 110.858 16.384C112.096 15.9147 113.44 15.68 114.89 15.68C117.45 15.68 119.392 16.5333 120.714 18.24C122.037 19.9467 122.698 22.464 122.698 25.792C122.698 32.32 121.29 37.7173 118.474 41.984C115.701 46.2507 111.861 48.384 106.954 48.384C105.589 48.384 104.437 48.192 103.498 47.808C102.602 47.424 101.941 46.848 101.514 46.08L98.1865 61.696ZM144.38 37.312C144.38 37.824 144.359 38.272 144.316 38.656C144.273 39.04 144.209 39.4027 144.124 39.744C144.977 39.232 145.809 38.6987 146.62 38.144C147.431 37.5893 148.135 37.056 148.732 36.544H151.42C150.097 38.08 148.625 39.5093 147.004 40.832C145.425 42.112 143.633 43.3493 141.628 44.544C140.476 45.7813 139.004 46.7413 137.212 47.424C135.42 48.064 133.543 48.384 131.58 48.384C128.721 48.384 126.439 47.616 124.732 46.08C123.068 44.5013 122.236 42.5387 122.236 40.192C122.236 38.8693 122.556 37.6747 123.196 36.608C123.836 35.4987 124.647 34.7093 125.628 34.24C127.079 31.6373 128.423 28.864 129.66 25.92C130.94 22.9333 132.22 19.392 133.5 15.296L142.972 14.016C143.1 17.216 143.249 20.1387 143.42 22.784C143.591 25.4293 143.804 28.3093 144.06 31.424C144.188 33.216 144.273 34.4747 144.316 35.2C144.359 35.9253 144.38 36.6293 144.38 37.312ZM133.884 22.208C133.329 23.9573 132.647 25.792 131.836 27.712C131.068 29.5893 130.023 31.7867 128.7 34.304C129.169 34.5173 129.532 34.816 129.788 35.2C130.044 35.584 130.172 36.032 130.172 36.544C130.172 37.3547 129.895 38.08 129.34 38.72C128.785 39.36 128.124 39.68 127.356 39.68C126.929 39.68 126.567 39.616 126.268 39.488C125.969 39.3173 125.756 39.104 125.628 38.848C125.628 40.4267 125.927 41.5787 126.524 42.304C127.164 42.9867 128.167 43.328 129.532 43.328C131.281 43.328 132.647 42.816 133.628 41.792C134.609 40.768 135.1 39.296 135.1 37.376C135.1 36.7787 135.079 36.1813 135.036 35.584C134.993 34.944 134.908 33.8987 134.78 32.448C134.567 30.4427 134.396 28.672 134.268 27.136C134.14 25.6 134.012 23.9573 133.884 22.208ZM150.961 16H153.073L154.993 7.168L164.465 5.888L162.289 16H166.129L165.617 18.56H161.777L157.681 37.76C157.596 38.144 157.532 38.5067 157.489 38.848C157.447 39.1467 157.425 39.4667 157.425 39.808C157.425 40.6613 157.617 41.28 158.001 41.664C158.428 42.0053 159.111 42.176 160.049 42.176C161.244 42.176 162.375 41.664 163.441 40.64C164.508 39.5733 165.297 38.208 165.809 36.544H168.497C167.132 40.4267 165.297 43.3707 162.993 45.376C160.689 47.3813 158.044 48.384 155.057 48.384C152.924 48.384 151.239 47.7227 150.001 46.4C148.807 45.0347 148.209 43.136 148.209 40.704C148.209 40.1493 148.252 39.5307 148.337 38.848C148.423 38.1227 148.551 37.3547 148.721 36.544L152.561 18.56H150.449L150.961 16ZM188.959 21.568C188.959 25.1093 187.509 28.2027 184.607 30.848C181.706 33.4507 178.25 34.8587 174.239 35.072C174.197 35.7973 174.154 36.352 174.111 36.736C174.111 37.0773 174.111 37.376 174.111 37.632C174.111 39.5947 174.431 40.9813 175.071 41.792C175.754 42.6027 176.97 43.008 178.719 43.008C180.725 43.008 182.559 42.56 184.223 41.664C185.93 40.7253 187.871 39.0187 190.047 36.544H192.223C189.749 40.5547 187.061 43.5413 184.159 45.504C181.258 47.424 178.079 48.384 174.623 48.384C171.338 48.384 168.842 47.5307 167.135 45.824C165.471 44.1173 164.639 41.5787 164.639 38.208C164.639 35.776 165.023 33.1947 165.791 30.464C166.559 27.7333 167.583 25.3013 168.863 23.168C170.442 20.608 172.319 18.688 174.495 17.408C176.714 16.0853 179.189 15.424 181.919 15.424C184.266 15.424 186.015 15.936 187.167 16.96C188.362 17.9413 188.959 19.4773 188.959 21.568ZM182.431 18.816C180.981 18.816 179.509 20.1173 178.015 22.72C176.565 25.28 175.477 28.3733 174.751 32C177.226 31.8293 179.381 30.6987 181.215 28.608C183.093 26.4747 184.031 24.0853 184.031 21.44C184.031 20.544 183.903 19.8827 183.647 19.456C183.391 19.0293 182.986 18.816 182.431 18.816ZM196.88 48H187.664L194.448 16H203.664L202.832 19.968C204.71 18.3893 206.182 17.344 207.248 16.832C208.358 16.2773 209.467 16 210.576 16C211.899 16 212.966 16.4693 213.776 17.408C214.587 18.304 214.992 19.4347 214.992 20.8C214.992 22.1227 214.566 23.232 213.712 24.128C212.859 25.024 211.75 25.472 210.384 25.472C209.659 25.472 209.083 25.3013 208.656 24.96C208.272 24.6187 207.995 23.9147 207.824 22.848C207.696 22.1653 207.547 21.7387 207.376 21.568C207.206 21.3547 206.971 21.248 206.672 21.248C205.947 21.248 205.264 21.3973 204.624 21.696C203.984 21.9947 203.11 22.656 202 23.68L196.88 48Z" fill="white"/></svg></div>)

  defp send_verification_success_html(conn, token, user) do
    escaped_email = (user.email || "") |> String.replace("\"", "\\\"")
    escaped_name = (user.name || "") |> String.replace("\"", "\\\"")
    ai_allowed = check_ai_allowed_for_user(user)

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
        #{@logo_html}
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
            owned_organization_id: #{user.owned_organization_id || "null"},
            created_by_organization_id: #{user.created_by_organization_id || "null"},
            ai_allowed: #{ai_allowed}
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
        #{@logo_html}
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

  # Check if AI is allowed for a user based on their organization's settings
  defp check_ai_allowed_for_user(user) do
    case user.created_by_organization_id do
      nil ->
        # User was not created by an org, AI is allowed
        true

      org_id ->
        # User was created by an org, check org settings
        case Organizations.get_organization(org_id) do
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
end
