defmodule ClippsterServer.Emails do
  @moduledoc """
  Email templates for authentication-related emails.
  """
  import Swoosh.Email

  @doc """
  Creates a verification email with both OTP code and magic link.
  """
  def verification_email(email, otp_code, magic_link_token) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")
    base_url = Keyword.get(config, :verification_url_base, "http://localhost:4000")
    
    magic_link_url = "#{base_url}/api/auth/email/verify/#{magic_link_token}"

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Verify your #{app_name} account")
    |> html_body(verification_html(otp_code, magic_link_url, app_name))
    |> text_body(verification_text(otp_code, magic_link_url, app_name))
  end

  @doc """
  Creates a password reset email.
  """
  def password_reset_email(email, reset_token) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")
    base_url = Keyword.get(config, :verification_url_base, "http://localhost:4000")
    
    reset_url = "#{base_url}/api/auth/email/reset-password/#{reset_token}"

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Reset your #{app_name} password")
    |> html_body(password_reset_html(reset_url, app_name))
    |> text_body(password_reset_text(reset_url, app_name))
  end

  defp verification_html(otp_code, magic_link_url, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 480px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">#{app_name}</h1>
                </td>
              </tr>
              
              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Verify your email
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Enter this code in the app to verify your account
                  </p>
                  
                  <!-- OTP Code Box -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                      Your verification code
                    </p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 8px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                      #{otp_code}
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 24px 0; font-size: 13px; color: #71717a; text-align: center;">
                    This code expires in <strong style="color: #a1a1aa;">10 minutes</strong>
                  </p>
                  
                  <!-- Divider -->
                  <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 24px 0;"></div>
                  
                  <!-- Magic Link Section -->
                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Or click this button to verify:
                  </p>
                  
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="#{magic_link_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                          Verify Email
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
  end

  defp verification_text(otp_code, magic_link_url, app_name) do
    """
    #{app_name} - Verify your email

    Your verification code is: #{otp_code}

    This code expires in 10 minutes.

    Or click this link to verify: #{magic_link_url}

    If you didn't create an account, you can safely ignore this email.
    """
  end

  defp password_reset_html(reset_url, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 480px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">#{app_name}</h1>
                </td>
              </tr>
              
              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Reset your password
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Click the button below to set a new password
                  </p>
                  
                  <!-- Reset Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="#{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 24px 0 0 0; font-size: 13px; color: #71717a; text-align: center;">
                    This link expires in <strong style="color: #a1a1aa;">1 hour</strong>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    If you didn't request a password reset, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
  end

  defp password_reset_text(reset_url, app_name) do
    """
    #{app_name} - Reset your password

    Click this link to reset your password: #{reset_url}

    This link expires in 1 hour.

    If you didn't request a password reset, you can safely ignore this email.
    """
  end
end


