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

  @doc """
  Creates an email change verification email.
  """
  def email_change_verification_email(email, verification_token) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")
    base_url = Keyword.get(config, :verification_url_base, "http://localhost:4000")

    verification_url = "#{base_url}/verify-email-change/#{verification_token}"

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Verify your new #{app_name} email address")
    |> html_body(email_change_html(verification_url, app_name))
    |> text_body(email_change_text(verification_url, app_name))
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
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Verify your email
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Enter this code in the app to verify your account
                  </p>

                  <!-- OTP Code Box -->
                  <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      Your verification code
                    </p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; color: #06b6d4; letter-spacing: 8px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
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
                        <a href="#{magic_link_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Verify Email
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Join Our Community -->
              <tr>
                <td style="padding-top: 32px;">
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                      🎮 Join Our Discord Community
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      Connect with other creators, get help, and stay updated on new features!
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Join Discord →
                    </a>
                  </div>
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
    Verify your #{app_name} account

    #{app_name} - The AI-Powered Clipping Studio

    Your verification code is: #{otp_code}

    This code expires in 10 minutes.

    Or click this link to verify instantly: #{magic_link_url}

    ---
    JOIN OUR DISCORD COMMUNITY:
    🎮 Connect with other creators, get help, and stay updated on new features!
    Discord: https://discord.gg/4kTCvKEVuV

    ---
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
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

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
                        <a href="#{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
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
    Reset your #{app_name} password

    #{app_name} - The AI-Powered Clipping Studio

    Click this link to reset your password: #{reset_url}

    This link expires in 1 hour.

    If you didn't request a password reset, you can safely ignore this email.
    """
  end

  defp email_change_html(verification_url, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your new email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 480px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Verify your new email
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Click the button below to confirm your new email address
                  </p>

                  <!-- Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="#{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Verify Email Address
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
                    If you didn't request this email change, please contact support immediately.
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

  defp email_change_text(verification_url, app_name) do
    """
    Verify your new #{app_name} email address

    #{app_name} - The AI-Powered Clipping Studio

    Click this link to verify your new email address: #{verification_url}

    This link expires in 1 hour.

    If you didn't request this email change, please contact support immediately.
    """
  end

  @doc """
  Creates an organization invitation email.
  """
  def organization_invitation_email(email, org_name, inviter_name, invite_token) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")
    base_url = Keyword.get(config, :verification_url_base, "http://localhost:4000")

    invite_url = "#{base_url}/invite/#{invite_token}"

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("You've been invited to join #{org_name} on #{app_name}")
    |> html_body(organization_invitation_html(org_name, inviter_name, invite_url, app_name))
    |> text_body(organization_invitation_text(org_name, inviter_name, invite_url, app_name))
  end

  defp organization_invitation_html(org_name, inviter_name, invite_url, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Invitation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 480px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    You're invited!
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    #{inviter_name} has invited you to join
                  </p>

                  <!-- Organization Name Box -->
                  <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 20px; font-weight: 600; color: #06b6d4;">
                      #{org_name}
                    </p>
                  </div>

                  <p style="margin: 0 0 24px 0; font-size: 13px; color: #71717a; text-align: center;">
                    Click the button below to accept this invitation and join the team.
                  </p>

                  <!-- Accept Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="#{invite_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 24px 0 0 0; font-size: 12px; color: #52525b; text-align: center;">
                    This invitation expires in 7 days.
                  </p>
                </td>
              </tr>

              <!-- Join Our Community -->
              <tr>
                <td style="padding-top: 32px;">
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                      🎮 Join Our Discord Community
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      Connect with other teams, share collaboration tips, and get support from the community!
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Join Discord →
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    If you don't recognize this organization, you can safely ignore this email.
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

  defp organization_invitation_text(org_name, inviter_name, invite_url, app_name) do
    """
    You've been invited to join #{org_name} on #{app_name}

    #{app_name} - The AI-Powered Clipping Studio

    #{inviter_name} has invited you to join #{org_name}!

    Click this link to accept the invitation: #{invite_url}

    This invitation expires in 7 days.

    ---

    JOIN OUR DISCORD COMMUNITY:
    🎮 Connect with other teams, share collaboration tips, and get support!
    Discord: https://discord.gg/4kTCvKEVuV

    ---

    If you don't recognize this organization, you can safely ignore this email.
    """
  end

  @doc """
  Creates a waitlist confirmation email.
  """
  def waitlist_confirmation_email(email) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Welcome to the #{app_name} Waitlist")
    |> html_body(waitlist_confirmation_html(app_name))
    |> text_body(waitlist_confirmation_text(app_name))
  end

  defp waitlist_confirmation_html(app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to the #{app_name} Waitlist</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 520px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    ✓ You're on the Waitlist
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center; line-height: 1.6;">
                    Thanks for joining the #{app_name} waitlist. You'll be among the first to know when we launch.
                  </p>

                  <!-- What to Expect -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      What to Expect
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Early access to beta when we launch</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Exclusive discount code for subscribers</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Updates on new features and improvements</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Join Our Community -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                      🎮 Join Our Discord Community
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      While you wait for beta access, join our Discord to connect with the community and stay updated!
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Join Discord →
                    </a>
                  </div>

                  <!-- Message Box -->
                  <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      We're working hard to bring you the best AI-powered clipping experience. Stay tuned for your beta access code!
                    </p>
                  </div>

                  <!-- CTA -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="https://clippster.app" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Visit clippster.app
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a;">
                    Questions? Contact us at
                  </p>
                  <p style="margin: 0 0 16px 0;">
                    <a href="mailto:support@clippster.app" style="color: #06b6d4; text-decoration: none; font-size: 13px;">support@clippster.app</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    If you didn't sign up for this waitlist, you can safely ignore this email.
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

  defp waitlist_confirmation_text(app_name) do
    """
    Welcome to the #{app_name} Waitlist

    #{app_name} - The AI-Powered Clipping Studio

    Thanks for joining the #{app_name} waitlist. You'll be among the first to know when we launch.

    ---

    WHAT TO EXPECT:
    • Early access to beta when we launch
    • Exclusive discount code for subscribers
    • Updates on new features and improvements

    ---

    We're working hard to bring you the best AI-powered clipping experience. Stay tuned for your beta access code!

    ---

    JOIN OUR DISCORD COMMUNITY:
    🎮 While you wait for beta access, join our Discord to connect with the community and stay updated!
    Discord: https://discord.gg/4kTCvKEVuV

    ---

    Visit: https://clippster.app

    Questions? Contact us at support@clippster.app

    If you didn't sign up for this waitlist, you can safely ignore this email.
    """
  end

  @doc """
  Creates an admin broadcast email with a custom subject and HTML body.
  """
  def admin_broadcast_email(to_email, subject, body_html) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")

    new()
    |> to(to_email)
    |> from({app_name, from_email})
    |> subject(subject)
    |> html_body(admin_broadcast_html(body_html, app_name))
    |> text_body(admin_broadcast_text(subject, body_html, app_name))
  end

  defp admin_broadcast_html(body_html, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 600px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Body content (admin-provided HTML) -->
                  <div style="color: #d4d4d8; font-size: 15px; line-height: 1.7;">
                    #{body_html}
                  </div>
                </td>
              </tr>

              <!-- Discord Footer -->
              <tr>
                <td style="padding-top: 32px;">
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #d4d4d8;">
                      🎮 <strong style="color: #ffffff;">Join our Discord community</strong> for support and updates
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 13px;">
                      Join Discord →
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 24px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    You're receiving this email because you have an account with #{app_name}.
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

  defp admin_broadcast_text(subject, body_html, app_name) do
    plain =
      body_html
      |> String.replace(~r/<[^>]+>/, " ")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()

    """
    #{subject}

    #{app_name} - The AI-Powered Clipping Studio

    #{plain}

    ---

    JOIN OUR DISCORD COMMUNITY:
    🎮 Get support, connect with other users, and stay updated!
    Discord: https://discord.gg/4kTCvKEVuV

    ---

    You're receiving this email because you have an account with #{app_name}.
    """
  end

  @doc """
  Creates a waitlist invite email with beta code and discount code.
  """
  def waitlist_invite_email(email, beta_code, discount_code, discount_percent) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Welcome to #{app_name} Beta - Access Code Inside")
    |> html_body(waitlist_invite_html(beta_code, discount_code, discount_percent, app_name))
    |> text_body(waitlist_invite_text(beta_code, discount_code, discount_percent, app_name))
  end

  defp waitlist_invite_html(beta_code, discount_code, discount_percent, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to #{app_name} Beta</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 520px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Welcome to Beta Access
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center; line-height: 1.6;">
                    You're one of the first to experience the future of content creation.
                  </p>

                  <!-- Beta Code Box -->
                  <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      YOUR BETA CODE
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 36px; font-weight: 700; color: #06b6d4; font-family: 'SF Mono', Monaco, 'Courier New', monospace; letter-spacing: 4px;">
                      #{beta_code}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                      Enter this code at <strong style="color: #ffffff;">clippster.app</strong> to unlock downloads
                    </p>
                  </div>

                  <!-- How to Get Started -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      How to Get Started
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">1</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Visit <strong style="color: #ffffff;">clippster.app</strong></span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">2</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Enter Your Beta Code Above</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">3</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Download for Mac or Windows</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">4</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Use Discount Code at Signup</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Divider -->
                  <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 32px 0;"></div>

                  <!-- Discount Code Box -->
                  <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      YOUR EXCLUSIVE DISCOUNT
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #22c55e; font-family: 'SF Mono', Monaco, 'Courier New', monospace; letter-spacing: 2px;">
                      #{discount_code}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff; font-weight: 600;">
                      Save #{discount_percent}% off First Month
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1a1aa;">
                      Creator Tier - $54.99/month
                    </p>
                    <p style="margin: 0; font-size: 18px; color: #22c55e; font-weight: 700;">
                      $38.49 <span style="font-size: 14px; color: #71717a; text-decoration: line-through; font-weight: 400;">$54.99</span>
                    </p>
                  </div>

                  <!-- What's Included -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      What's Included
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">1,800 credits/month (30 hours)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Full AI Clip Detection</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">HD Export (1080p)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Credits Roll Over</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Full Video Editor</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">All Major Streaming Platforms Supported</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Posting to all Major Social Media Platforms</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- What You Get Access To -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      What You Get Access To
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">AI-powered clip detection</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Professional timeline editor</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Auto-generated captions</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Export to all platforms</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Join Our Community -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                      🎮 Join Our Discord Community
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      Connect with other beta testers, share feedback, get help, and be the first to hear about new features!
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Join Discord →
                    </a>
                  </div>

                  <!-- Need Help? -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      Need Help?
                    </h3>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #d4d4d8; line-height: 1.6;">
                      The app includes built-in support tools to help you:
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;"><strong style="color: #ffffff;">Bug Reporter</strong> - Report issues directly from the app</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;"><strong style="color: #ffffff;">Customer Service Chat</strong> - Get instant help from our team</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="https://clippster.app" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Get Started Now →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a;">
                    Need help? Reply to this email or contact us at
                  </p>
                  <p style="margin: 0 0 16px 0;">
                    <a href="mailto:support@clippster.app" style="color: #06b6d4; text-decoration: none; font-size: 13px;">support@clippster.app</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    You're receiving this because you joined the #{app_name} waitlist.
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

  defp waitlist_invite_text(beta_code, discount_code, discount_percent, app_name) do
    """
    Welcome to #{app_name} Beta - Your Access Code Inside

    #{app_name} - The AI-Powered Clipping Studio

    You're one of the first to experience the future of content creation.

    ---

    YOUR BETA CODE: #{beta_code}

    Enter this code at clippster.app to unlock downloads

    ---

    HOW TO GET STARTED:

    1. Visit clippster.app
    2. Enter your beta code above
    3. Download for Mac or Windows
    4. Use discount code at signup

    ---

    YOUR EXCLUSIVE DISCOUNT: #{discount_code}

    Save #{discount_percent}% off first month
    Creator Tier - $54.99/month
    Pay only $38.49 (save $16.50)

    WHAT'S INCLUDED:
    • 1,800 credits/month (30 hours)
    • Full AI clip detection
    • HD export (1080p)
    • Credits roll over
    • Full video editor
    • All major streaming platforms
    • Posting to all major social media

    ---

    WHAT YOU GET ACCESS TO:
    • AI-powered clip detection
    • Professional timeline editor
    • Auto-generated captions
    • Export to all platforms

    ---

    JOIN OUR DISCORD COMMUNITY:
    🎮 Connect with other beta testers, share feedback, and get help!
    Discord: https://discord.gg/4kTCvKEVuV

    NEED HELP?
    The app includes built-in support tools:
    • Bug Reporter - Report issues directly from the app
    • Customer Service Chat - Get instant help from our team

    ---

    Get Started: https://clippster.app

    Need help? Reply to this email or contact support@clippster.app

    You're receiving this because you joined the #{app_name} waitlist.
    """
  end

  @doc """
  Creates a waitlist reinvite email with new beta code and discount code.
  Includes notice that previous codes are invalidated.
  """
  def waitlist_reinvite_email(email, beta_code, discount_code, discount_percent) do
    config = Application.get_env(:clippster_server, :email_auth, [])
    from_email = Keyword.get(config, :from_email, "noreply@clippster.app")
    app_name = Keyword.get(config, :app_name, "Clippster")

    new()
    |> to(email)
    |> from({app_name, from_email})
    |> subject("Updated #{app_name} Beta Access - New Codes Inside")
    |> html_body(waitlist_reinvite_html(beta_code, discount_code, discount_percent, app_name))
    |> text_body(waitlist_reinvite_text(beta_code, discount_code, discount_percent, app_name))
  end

  defp waitlist_reinvite_html(beta_code, discount_code, discount_percent, app_name) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Updated #{app_name} Beta Access</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 520px;">
              <!-- Logo/Header -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Accent Bar -->
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <!-- Important Notice -->
                  <div style="background: rgba(245, 158, 11, 0.15); border: 2px solid rgba(245, 158, 11, 0.5); border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
                      ⚠️ IMPORTANT NOTICE - PREVIOUS CODES INVALIDATED
                    </h3>
                    <p style="margin: 0; font-size: 14px; color: #fcd34d; text-align: center; line-height: 1.6;">
                      All beta codes and discount codes from your previous invite email are no longer valid. Please use only the new codes provided below to access #{app_name} Beta. If you already have the app downloaded but have not entered a discount code at checkout, you need to use the discount code from this email. 
                    </p>
                  </div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Updated Beta Access
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center; line-height: 1.6;">
                    We've issued you new access codes. Use these to continue your beta experience.
                  </p>

                  <!-- Beta Code Box -->
                  <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      YOUR NEW BETA CODE
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 36px; font-weight: 700; color: #06b6d4; font-family: 'SF Mono', Monaco, 'Courier New', monospace; letter-spacing: 4px;">
                      #{beta_code}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                      Enter this code at <strong style="color: #ffffff;">clippster.app</strong> to unlock downloads
                    </p>
                  </div>

                  <!-- How to Get Started -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      How to Get Started
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">1</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Visit <strong style="color: #ffffff;">clippster.app</strong></span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">2</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Enter Your New Beta Code Above</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">3</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Download for Mac or Windows</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: #06b6d4; color: #0a0a0a; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px;">4</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Use New Discount Code at Signup</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Divider -->
                  <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 32px 0;"></div>

                  <!-- Discount Code Box -->
                  <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      YOUR NEW EXCLUSIVE DISCOUNT
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #22c55e; font-family: 'SF Mono', Monaco, 'Courier New', monospace; letter-spacing: 2px;">
                      #{discount_code}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff; font-weight: 600;">
                      Save #{discount_percent}% off First Month
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1a1aa;">
                      Creator Tier - $54.99/month
                    </p>
                    <p style="margin: 0; font-size: 18px; color: #22c55e; font-weight: 700;">
                      $38.49 <span style="font-size: 14px; color: #71717a; text-decoration: line-through; font-weight: 400;">$54.99</span>
                    </p>
                  </div>

                  <!-- What's Included -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      What's Included
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">1,800 credits/month (30 hours)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Full AI Clip Detection</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">HD Export (1080p)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Credits Roll oOver</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Full Video Editor</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">All Major Streaming Platforms Supported</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #22c55e; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Posting to all Major Social Media Platforms</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- What You Get Access To -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      What You Get Access To
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">AI-powered clip detection</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Professional timeline editor</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Auto-generated captions</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;">Export to all platforms</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Join Our Community -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                      🎮 Join Our Discord Community
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      Connect with other beta testers, share feedback, get help, and be the first to hear about new features!
                    </p>
                    <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background: #5865F2; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Join Discord →
                    </a>
                  </div>

                  <!-- Need Help? -->
                  <div style="background: rgba(39, 39, 42, 0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                      Need Help?
                    </h3>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #d4d4d8; line-height: 1.6;">
                      The app includes built-in support tools to help you:
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;"><strong style="color: #ffffff;">Bug Reporter</strong> - Report issues directly from the app</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #06b6d4; margin-right: 8px;">•</span>
                          <span style="color: #d4d4d8; font-size: 13px;"><strong style="color: #ffffff;">Customer Service Chat</strong> - Get instant help from our team</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="https://clippster.app" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
                          Get Started Now →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a;">
                    Need help? Reply to this email or contact us at
                  </p>
                  <p style="margin: 0 0 16px 0;">
                    <a href="mailto:support@clippster.app" style="color: #06b6d4; text-decoration: none; font-size: 13px;">support@clippster.app</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    You're receiving this because you joined the #{app_name} waitlist.
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

  defp waitlist_reinvite_text(beta_code, discount_code, discount_percent, app_name) do
    """
    Updated #{app_name} Beta Access - Your New Codes Inside

    #{app_name} - The AI-Powered Clipping Studio

    ⚠️ IMPORTANT NOTICE - PREVIOUS CODES INVALIDATED

    All beta codes and discount codes from your previous invite email are no longer valid. Please use only the new codes provided below to access #{app_name} Beta.

    ---

    YOUR NEW BETA CODE: #{beta_code}

    Enter this code at clippster.app to unlock downloads

    ---

    HOW TO GET STARTED:

    1. Visit clippster.app
    2. Enter your new beta code above
    3. Download for Mac or Windows
    4. Use new discount code at signup

    ---

    YOUR NEW EXCLUSIVE DISCOUNT: #{discount_code}

    Save #{discount_percent}% off first month
    Creator Tier - $54.99/month
    Pay only $38.49 (save $16.50)

    WHAT'S INCLUDED:
    • 1,800 credits/month (30 hours)
    • Full AI clip detection
    • HD export (1080p)
    • Credits roll over
    • Full video editor
    • All major streaming platforms
    • Posting to all major social media

    ---

    WHAT YOU GET ACCESS TO:
    • AI-powered clip detection
    • Professional timeline editor
    • Auto-generated captions
    • Export to all platforms

    ---

    JOIN OUR DISCORD COMMUNITY:
    🎮 Connect with other beta testers, share feedback, and get help!
    Discord: https://discord.gg/4kTCvKEVuV

    NEED HELP?
    The app includes built-in support tools:
    • Bug Reporter - Report issues directly from the app
    • Customer Service Chat - Get instant help from our team

    ---

    Get Started: https://clippster.app

    Need help? Reply to this email or contact support@clippster.app

    You're receiving this because you joined the #{app_name} waitlist.
    """
  end
end
