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
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">#{app_name}</h1>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
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
                        <a href="#{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
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
    #{app_name} - Verify your new email address

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
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">#{app_name}</h1>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px;">
                  <!-- Icon -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <div style="display: inline-block; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 16px;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                  </div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    You're invited!
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    #{inviter_name} has invited you to join
                  </p>

                  <!-- Organization Name Box -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff;">
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
                        <a href="#{invite_url}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
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
    #{app_name} - Organization Invitation

    #{inviter_name} has invited you to join #{org_name}!

    Click this link to accept the invitation: #{invite_url}

    This invitation expires in 7 days.

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
    |> subject("You're on the #{app_name} waitlist!")
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
      <title>Welcome to the Waitlist</title>
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
                  <!-- Icon -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <div style="display: inline-block; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 16px;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>

                  <!-- Title -->
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                    You're on the list!
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                    Thanks for joining the #{app_name} waitlist.
                  </p>

                  <!-- Message Box -->
                  <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #d4d4d8; line-height: 1.6;">
                      We're working hard to bring you the best clip editing experience.
                      You'll be among the first to know when we launch!
                    </p>
                  </div>

                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">
                    We'll notify you as soon as #{app_name} is ready for you.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 32px; text-align: center;">
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
    #{app_name} - You're on the waitlist!

    Thanks for joining the #{app_name} waitlist.

    We're working hard to bring you the best clip editing experience.
    You'll be among the first to know when we launch!

    We'll notify you as soon as #{app_name} is ready for you.

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
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">#{app_name}</h1>
                </td>
              </tr>

              <!-- Top accent bar -->
              <tr>
                <td style="height: 4px; background: linear-gradient(90deg, #8b5cf6, #a855f7, #6366f1); border-radius: 4px 4px 0 0;"></td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background: linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius: 0 0 16px 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-top: none; padding: 40px;">
                  <!-- Body content (admin-provided HTML) -->
                  <div style="color: #d4d4d8; font-size: 15px; line-height: 1.7;">
                    #{body_html}
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
    plain = body_html
      |> String.replace(~r/<[^>]+>/, " ")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()

    """
    #{app_name} — #{subject}

    #{plain}

    ---
    You're receiving this email because you have an account with #{app_name}.
    """
  end
end
