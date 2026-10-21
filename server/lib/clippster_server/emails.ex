defmodule ClippsterServer.Emails do
  @moduledoc """
  Branded transactional, waitlist and admin campaign emails.
  """
  import Swoosh.Email
  alias ClippsterServer.EmailTemplate

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
    |> with_bodies(verification_html(otp_code, magic_link_url, app_name))
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
    |> with_bodies(password_reset_html(reset_url, app_name))
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
    |> with_bodies(email_change_html(otp_code, verification_url, app_name))
  end

  defp email_config do
    Application.get_env(:clippster_server, :email_auth, [])
  end

  defp with_bodies(email, html) do
    email |> html_body(html) |> text_body(EmailTemplate.to_text(html))
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
    EmailTemplate.message(
      "ACCOUNT VERIFICATION",
      "Let’s make it official.",
      "Verify your email to finish setting up your #{app_name} account. Enter this code in the app, or use the button below.",
      EmailTemplate.code("Your verification code", otp_code, "This code expires in 10 minutes."),
      {"Verify email", magic_link_url}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email(),
      reason: "If you didn’t create an account, you can safely ignore this email."
    )
  end

  defp password_reset_html(reset_url, app_name) do
    EmailTemplate.message(
      "ACCOUNT SECURITY",
      "Reset your password.",
      "Use the button below to choose a new password for your #{app_name} account. This link expires in 1 hour.",
      "",
      {"Reset password", reset_url}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email(),
      reason: "If you didn’t request a password reset, you can safely ignore this email."
    )
  end

  defp email_change_html(otp_code, verification_url, app_name) do
    EmailTemplate.message(
      "ACCOUNT SECURITY",
      "Verify your new email.",
      "Enter this code in the app to confirm your new email address, or use the button below. The link expires in 1 hour.",
      EmailTemplate.code("Your verification code", otp_code, "This code expires in 10 minutes."),
      {"Verify email", verification_url}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email(),
      reason: "If you didn’t request this change, you can safely ignore this email."
    )
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
    |> with_bodies(organization_invitation_html(org_name, inviter_name, invite_url, app_name))
  end

  defp organization_invitation_html(org_name, inviter_name, invite_url, app_name) do
    EmailTemplate.message(
      "TEAM INVITATION",
      "You’re invited to #{org_name}.",
      "#{inviter_name} has invited you to join #{org_name} on #{app_name}. Accept your invitation to start collaborating. This invitation expires in 7 days.",
      "",
      {"Accept invitation", invite_url}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email(),
      reason: "You’re receiving this because you were invited to an organization on #{app_name}."
    )
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
    |> with_bodies(waitlist_confirmation_html(app_name, support_email(), unsubscribe_url))
  end

  defp waitlist_confirmation_html(app_name, support_email, unsubscribe_url) do
    EmailTemplate.message(
      "WELCOME TO CLIPPSTER",
      "You’re on the list.",
      "Thanks for joining the #{app_name} waitlist. We’re glad you’re here.

We’ll email you when your beta access is ready, along with everything you need to get started.",
      "",
      {"Visit Clippster", "https://clippster.app"}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email,
      unsubscribe_url: unsubscribe_url,
      reason: marketing_reason("waitlist", app_name)
    )
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
    |> with_bodies(
      admin_broadcast_html(body_html, app_name, preheader, unsubscribe_url, audience)
    )
  end

  defp admin_broadcast_html(body_html, app_name, preheader, unsubscribe_url, audience) do
    EmailTemplate.render(body_html,
      app_name: app_name,
      preheader: preheader,
      support_email: support_email(),
      unsubscribe_url: unsubscribe_url,
      reason: marketing_reason(audience, app_name)
    )
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
    |> with_bodies(
      waitlist_invite_html(
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
    invite_html(
      beta_code,
      discount_code,
      discount_percent,
      app_name,
      support_email,
      unsubscribe_url,
      false
    )
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
    |> with_bodies(
      waitlist_reinvite_html(
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
    invite_html(
      beta_code,
      discount_code,
      discount_percent,
      app_name,
      support_email,
      unsubscribe_url,
      true
    )
  end

  defp invite_html(
         beta_code,
         discount_code,
         discount_percent,
         app_name,
         support_email,
         unsubscribe_url,
         reinvite
       ) do
    title =
      if reinvite,
        do: "Your updated beta access is ready.",
        else: "Your next great clip starts here."

    text =
      if reinvite,
        do:
          "Your previous beta and discount codes are no longer valid. Use your new codes below. Visit clippster.app, enter your beta code, and download the app for Mac or Windows.",
        else:
          "Your #{app_name} beta access is ready. Visit clippster.app, enter your beta code, and download the app for Mac or Windows."

    codes =
      EmailTemplate.code(
        "Your beta code",
        beta_code,
        "Enter this code at clippster.app to unlock downloads."
      ) <>
        EmailTemplate.code(
          "Your discount code",
          discount_code,
          "Save #{discount_percent}% off your first month. Use this code at signup."
        )

    EmailTemplate.message(
      "YOUR BETA INVITATION",
      title,
      text,
      codes,
      {"Download Clippster", "https://clippster.app"}
    )
    |> EmailTemplate.render(
      app_name: app_name,
      support_email: support_email,
      unsubscribe_url: unsubscribe_url,
      reason: marketing_reason("waitlist", app_name)
    )
  end
end
