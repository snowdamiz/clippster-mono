defmodule ClippsterServer.Emails do
  @moduledoc """
  Email templates for authentication-related emails.
  """
  import Swoosh.Email

  @default_transactional_from "noreply@clippster.app"
  @default_marketing_from "updates@clippster.app"
  @default_support_email "support@clippster.app"
  @default_unsubscribe_email "unsubscribe@clippster.app"
  @default_url_base "http://localhost:4000"

  @doc """
  Creates a verification email with both OTP code and magic link.
  """
  def verification_email(email, otp_code, magic_link_token) do
    app_name = app_name()
    base_url = email_url_base()

    magic_link_url = "#{base_url}/api/auth/email/verify/#{magic_link_token}"

    email
    |> transactional_email()
    |> subject("Verify your #{app_name} account")
    |> html_body(verification_html(otp_code, magic_link_url, app_name))
    |> text_body(verification_text(otp_code, magic_link_url, app_name))
  end

  @doc """
  Creates a password reset email.
  """
  def password_reset_email(email, reset_token) do
    app_name = app_name()
    base_url = email_url_base()

    reset_url = "#{base_url}/api/auth/email/reset-password/#{reset_token}"

    email
    |> transactional_email()
    |> subject("Reset your #{app_name} password")
    |> html_body(password_reset_html(reset_url, app_name))
    |> text_body(password_reset_text(reset_url, app_name))
  end

  @doc """
  Creates an email change verification email with OTP + magic link.
  """
  def email_change_verification_email(email, otp_code, verification_token) do
    app_name = app_name()
    base_url = email_url_base()

    verification_url = "#{base_url}/verify-email-change/#{verification_token}"

    email
    |> transactional_email()
    |> subject("Verify your new #{app_name} email address")
    |> html_body(email_change_html(otp_code, verification_url, app_name))
    |> text_body(email_change_text(otp_code, verification_url, app_name))
  end

  defp email_config do
    Application.get_env(:clippster_server, :email_auth, [])
  end

  defp app_name do
    Keyword.get(email_config(), :app_name, "Clippster")
  end

  defp email_url_base do
    Keyword.get(email_config(), :verification_url_base, @default_url_base)
  end

  defp transactional_from_email do
    config = email_config()

    Keyword.get(
      config,
      :transactional_from_email,
      Keyword.get(config, :from_email, @default_transactional_from)
    )
  end

  defp marketing_from_email do
    Keyword.get(email_config(), :marketing_from_email, @default_marketing_from)
  end

  defp support_email do
    Keyword.get(email_config(), :support_email, @default_support_email)
  end

  defp unsubscribe_email do
    Keyword.get(email_config(), :unsubscribe_email, @default_unsubscribe_email)
  end

  defp transactional_email(to_email) do
    new()
    |> to(to_email)
    |> from({app_name(), transactional_from_email()})
    |> reply_to({app_name() <> " Support", support_email()})
  end

  defp marketing_email(to_email) do
    new()
    |> to(to_email)
    |> from({app_name(), marketing_from_email()})
    |> reply_to({app_name() <> " Support", support_email()})
  end

  defp marketing_unsubscribe_headers(email, unsubscribe_url) do
    email
    |> header("List-Unsubscribe", "<mailto:#{unsubscribe_email()}>, <#{unsubscribe_url}>")
    |> header("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
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

  defp email_change_html(otp_code, verification_url, app_name) do
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
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">#{app_name}</h1>
                  <p style="margin: 0; font-size: 14px; color: #06b6d4; font-weight: 500;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <div style="height: 4px; background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); border-radius: 2px; margin-bottom: 32px;"></div>

                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    Verify your new email
                  </h2>
                  <p style="margin: 0 0 32px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Enter this code in the app to confirm your new email address
                  </p>

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

                  <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 24px 0;"></div>

                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Or click this button to verify:
                  </p>

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
                    The link expires in <strong style="color: #a1a1aa;">1 hour</strong>
                  </p>
                </td>
              </tr>

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

  defp email_change_text(otp_code, verification_url, app_name) do
    """
    Verify your new #{app_name} email address

    #{app_name} - The AI-Powered Clipping Studio

    Your verification code: #{otp_code}

    This code expires in 10 minutes.

    Or click this link to verify your new email address: #{verification_url}

    The link expires in 1 hour.

    If you didn't request this email change, please contact support immediately.
    """
  end

  @doc """
  Creates an organization invitation email.
  """
  def organization_invitation_email(email, org_name, inviter_name, invite_token) do
    app_name = app_name()
    base_url = email_url_base()

    invite_url = "#{base_url}/invite/#{invite_token}"

    email
    |> transactional_email()
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
    app_name = app_name()
    unsubscribe_url = marketing_unsubscribe_url(email)

    email
    |> marketing_email()
    |> subject("Welcome to the #{app_name} Waitlist")
    |> marketing_unsubscribe_headers(unsubscribe_url)
    |> html_body(waitlist_confirmation_html(app_name, support_email(), unsubscribe_url))
    |> text_body(waitlist_confirmation_text(app_name, support_email(), unsubscribe_url))
  end

  defp waitlist_confirmation_html(app_name, support_email, unsubscribe_url) do
    escaped_support_email = html_escape(support_email)
    escaped_unsubscribe_url = html_escape(unsubscribe_url)

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
                    <a href="mailto:#{escaped_support_email}" style="color: #06b6d4; text-decoration: none; font-size: 13px;">#{escaped_support_email}</a>
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 11px; color: #3f3f46;">
                    <a href="#{escaped_unsubscribe_url}" style="color: #52525b; text-decoration: underline;">Unsubscribe</a>
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #3f3f46;">
                    Clippster · 412 W 39th St, Vancouver, WA 98660
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

  defp waitlist_confirmation_text(app_name, support_email, unsubscribe_url) do
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

    Questions? Contact us at #{support_email}

    Unsubscribe: #{unsubscribe_url}
    Clippster · 412 W 39th St, Vancouver, WA 98660
    """
  end

  @doc """
  Creates an admin broadcast email with a custom subject and HTML body.
  """
  def admin_broadcast_email(to_email, subject, body_html, opts \\ []) do
    app_name = app_name()
    preheader = Keyword.get(opts, :preheader, "")
    audience = Keyword.get(opts, :audience, "all_users")
    unsubscribe_url = marketing_unsubscribe_url(to_email)

    to_email
    |> marketing_email()
    |> subject(subject)
    |> marketing_unsubscribe_headers(unsubscribe_url)
    |> html_body(admin_broadcast_html(body_html, app_name, preheader, unsubscribe_url, audience))
    |> text_body(admin_broadcast_text(subject, body_html, app_name, unsubscribe_url, audience))
  end

  defp admin_broadcast_html(body_html, app_name, preheader, unsubscribe_url, audience) do
    escaped_app_name = html_escape(app_name)
    escaped_preheader = html_escape(preheader)
    escaped_reason = html_escape(marketing_reason(audience, app_name))
    escaped_unsubscribe_url = html_escape(unsubscribe_url)

    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
        #{escaped_preheader}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0c0f; min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 36px 18px;">
            <table role="presentation" width="100%" style="max-width: 600px;">
              <tr>
                <td align="left" style="padding: 0 0 18px 0;">
                  <p style="margin: 0 0 6px 0; color: #ffffff; font-size: 28px; font-weight: 750; line-height: 1.1;">#{escaped_app_name}</p>
                  <p style="margin: 0; color: #67e8f9; font-size: 13px; font-weight: 600; letter-spacing: 0.02em;">The AI-Powered Clipping Studio</p>
                </td>
              </tr>

              <tr>
                <td style="background-color: #14161b; border: 1px solid #2b3038; border-radius: 14px; overflow: hidden;">
                  <div style="height: 4px; background: linear-gradient(90deg, #22d3ee 0%, #3b82f6 55%, #22c55e 100%);"></div>

                  <div style="padding: 34px 34px 30px 34px; color: #d7dde8; font-size: 15px; line-height: 1.7;">
                    #{body_html}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding-top: 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #101217; border: 1px solid #252a33; border-radius: 12px;">
                    <tr>
                      <td style="padding: 18px 20px;">
                        <p style="margin: 0 0 6px 0; color: #ffffff; font-size: 14px; font-weight: 700;">Need help or want to share feedback?</p>
                        <p style="margin: 0 0 14px 0; color: #aeb7c6; font-size: 13px; line-height: 1.55;">Join the Discord community for support, updates, and early product notes.</p>
                        <a href="https://discord.gg/4kTCvKEVuV" style="display: inline-block; background-color: #5865f2; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px;">
                          Join Discord
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 22px 8px 0 8px; text-align: center;">
                  <p style="margin: 0; color: #737c8c; font-size: 12px; line-height: 1.6;">
                    #{escaped_reason}
                  </p>
                  <p style="margin: 12px 0 0 0; color: #596172; font-size: 11px; line-height: 1.6;">
                    <a href="#{escaped_unsubscribe_url}" style="color: #8b95a7; text-decoration: underline;">Unsubscribe</a>
                    <span style="color: #3b4250;">&nbsp;|&nbsp;</span>
                    Clippster · 412 W 39th St, Vancouver, WA 98660
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

  defp admin_broadcast_text(subject, body_html, app_name, unsubscribe_url, audience) do
    plain =
      body_html
      |> String.replace(~r/<br\s*\/?>/i, "\n")
      |> String.replace(~r/<\/p>/i, "\n\n")
      |> String.replace(~r/<\/h\d>/i, "\n\n")
      |> String.replace(~r/<\/li>/i, "\n")
      |> String.replace(~r/<[^>]+>/, " ")
      |> String.replace("&nbsp;", " ")
      |> String.replace("&amp;", "&")
      |> String.replace(~r/[ \t]+/, " ")
      |> String.replace(~r/\n\s+/, "\n")
      |> String.replace(~r/\n{3,}/, "\n\n")
      |> String.trim()

    """
    #{subject}

    #{app_name} - The AI-Powered Clipping Studio

    #{plain}

    ---

    Join our Discord community for support and updates:
    https://discord.gg/4kTCvKEVuV

    ---

    #{marketing_reason(audience, app_name)}

    Unsubscribe: #{unsubscribe_url}
    Clippster · 412 W 39th St, Vancouver, WA 98660
    """
  end

  defp marketing_reason("waitlist", app_name) do
    "You're receiving this email because you signed up for #{app_name} updates."
  end

  defp marketing_reason("individual", app_name) do
    "You're receiving this email because the #{app_name} team sent it to you directly."
  end

  defp marketing_reason(_, app_name) do
    "You're receiving this email because you have an account with #{app_name}."
  end

  defp marketing_unsubscribe_url(email) do
    token =
      Phoenix.Token.sign(
        ClippsterServerWeb.Endpoint,
        "email-unsubscribe",
        email
      )

    "#{email_url_base()}/email/unsubscribe/#{token}"
  end

  defp html_escape(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end

  @doc """
  Creates a waitlist invite email with beta code and discount code.
  """
  def waitlist_invite_email(email, beta_code, discount_code, discount_percent) do
    app_name = app_name()
    unsubscribe_url = marketing_unsubscribe_url(email)

    email
    |> marketing_email()
    |> subject("Welcome to #{app_name} Beta - Access Code Inside")
    |> marketing_unsubscribe_headers(unsubscribe_url)
    |> html_body(
      waitlist_invite_html(
        beta_code,
        discount_code,
        discount_percent,
        app_name,
        support_email(),
        unsubscribe_url
      )
    )
    |> text_body(
      waitlist_invite_text(
        beta_code,
        discount_code,
        discount_percent,
        app_name,
        support_email(),
        unsubscribe_url
      )
    )
  end

  defp waitlist_invite_html(
         beta_code,
         discount_code,
         discount_percent,
         app_name,
         support_email,
         unsubscribe_url
       ) do
    escaped_support_email = html_escape(support_email)
    escaped_unsubscribe_url = html_escape(unsubscribe_url)

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
                      Creator Tier - $49.99/month
                    </p>
                    <p style="margin: 0; font-size: 18px; color: #22c55e; font-weight: 700;">
                      $34.99 <span style="font-size: 14px; color: #71717a; text-decoration: line-through; font-weight: 400;">$49.99</span>
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
                    <a href="mailto:#{escaped_support_email}" style="color: #06b6d4; text-decoration: none; font-size: 13px;">#{escaped_support_email}</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    You're receiving this because you joined the #{app_name} waitlist.
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 11px; color: #3f3f46;">
                    <a href="#{escaped_unsubscribe_url}" style="color: #52525b; text-decoration: underline;">Unsubscribe</a>
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #3f3f46;">
                    Clippster · 412 W 39th St, Vancouver, WA 98660
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

  defp waitlist_invite_text(
         beta_code,
         discount_code,
         discount_percent,
         app_name,
         support_email,
         unsubscribe_url
       ) do
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
    Creator Tier - $49.99/month
    Pay only $34.99 (save $15.00)

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

    Need help? Reply to this email or contact #{support_email}

    You're receiving this because you joined the #{app_name} waitlist.

    Unsubscribe: #{unsubscribe_url}
    Clippster · 412 W 39th St, Vancouver, WA 98660
    """
  end

  @doc """
  Creates a waitlist reinvite email with new beta code and discount code.
  Includes notice that previous codes are invalidated.
  """
  def waitlist_reinvite_email(email, beta_code, discount_code, discount_percent) do
    app_name = app_name()
    unsubscribe_url = marketing_unsubscribe_url(email)

    email
    |> marketing_email()
    |> subject("Updated #{app_name} Beta Access - New Codes Inside")
    |> marketing_unsubscribe_headers(unsubscribe_url)
    |> html_body(
      waitlist_reinvite_html(
        beta_code,
        discount_code,
        discount_percent,
        app_name,
        support_email(),
        unsubscribe_url
      )
    )
    |> text_body(
      waitlist_reinvite_text(
        beta_code,
        discount_code,
        discount_percent,
        app_name,
        support_email(),
        unsubscribe_url
      )
    )
  end

  defp waitlist_reinvite_html(
         beta_code,
         discount_code,
         discount_percent,
         app_name,
         support_email,
         unsubscribe_url
       ) do
    escaped_support_email = html_escape(support_email)
    escaped_unsubscribe_url = html_escape(unsubscribe_url)

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
                      Creator Tier - $49.99/month
                    </p>
                    <p style="margin: 0; font-size: 18px; color: #22c55e; font-weight: 700;">
                      $34.99 <span style="font-size: 14px; color: #71717a; text-decoration: line-through; font-weight: 400;">$49.99</span>
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
                    <a href="mailto:#{escaped_support_email}" style="color: #06b6d4; text-decoration: none; font-size: 13px;">#{escaped_support_email}</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #52525b;">
                    You're receiving this because you joined the #{app_name} waitlist.
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 11px; color: #3f3f46;">
                    <a href="#{escaped_unsubscribe_url}" style="color: #52525b; text-decoration: underline;">Unsubscribe</a>
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #3f3f46;">
                    Clippster · 412 W 39th St, Vancouver, WA 98660
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

  defp waitlist_reinvite_text(
         beta_code,
         discount_code,
         discount_percent,
         app_name,
         support_email,
         unsubscribe_url
       ) do
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
    Creator Tier - $49.99/month
    Pay only $34.99 (save $15.00)

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

    Need help? Reply to this email or contact #{support_email}

    You're receiving this because you joined the #{app_name} waitlist.

    Unsubscribe: #{unsubscribe_url}
    Clippster · 412 W 39th St, Vancouver, WA 98660
    """
  end
end
