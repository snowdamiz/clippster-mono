defmodule ClippsterServerWeb.InviteController do
  @moduledoc """
  Serves a self-contained HTML page for accepting organization invitations.
  Users click a magic link in their email → land here → authenticate → accept.
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations

  def show(conn, %{"token" => token}) do
    case Organizations.get_invitation_by_token(token) do
      nil ->
        conn
        |> put_resp_content_type("text/html")
        |> send_resp(200, expired_html())

      invitation ->
        if Organizations.OrganizationInvitation.expired?(invitation) do
          conn
          |> put_resp_content_type("text/html")
          |> send_resp(200, expired_html())
        else
          conn
          |> put_resp_content_type("text/html")
          |> send_resp(200, invite_html(invitation, token))
        end
    end
  end

  defp api_base do
    config = Application.get_env(:clippster_server, :email_auth, [])
    Keyword.get(config, :verification_url_base, "http://localhost:4000")
  end

  defp invite_html(invitation, token) do
    org_name = invitation.organization.name
    org_logo = invitation.organization.logo_url
    inviter_name = if invitation.invited_by_user, do: invitation.invited_by_user.name || invitation.invited_by_user.email, else: "Someone"
    role = invitation.role
    email = invitation.email
    api = api_base()

    logo_html = if org_logo && org_logo != "" do
      "<img src=\"#{org_logo}\" alt=\"#{org_name}\" style=\"width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin-bottom: 16px;\" />"
    else
      "<div style=\"width: 64px; height: 64px; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #0891b2); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 28px; font-weight: 700; color: #fff;\">#{String.first(org_name)}</div>"
    end

    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Join #{org_name} on Clippster</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #0a0a0b; color: #f4f4f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card { width: min(92vw, 440px); border: 1px solid #27272a; background: #111114; border-radius: 16px; padding: 32px; }
        .center { text-align: center; display: flex; flex-direction: column; align-items: center; }
        h1 { color: #f4f4f5; margin: 0 0 8px; font-size: 1.35rem; font-weight: 600; }
        .subtitle { color: #a1a1aa; margin: 0 0 24px; font-size: 0.9rem; line-height: 1.5; }
        .role-badge { display: inline-block; background: #1e293b; color: #38bdf8; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; text-transform: capitalize; margin-bottom: 20px; }
        .divider { width: 100%; height: 1px; background: #27272a; margin: 20px 0; }
        label { display: block; color: #a1a1aa; font-size: 0.8rem; font-weight: 500; margin-bottom: 6px; text-align: left; }
        input { width: 100%; padding: 12px 14px; background: #18181b; border: 1px solid #27272a; border-radius: 10px; color: #f4f4f5; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
        input:focus { border-color: #06b6d4; }
        input::placeholder { color: #52525b; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
        .btn:active { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.25); }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .btn-secondary { background: #18181b; border: 1px solid #27272a; color: #f4f4f5; }
        .btn-secondary:hover:not(:disabled) { background: #1f1f23; }
        .btn-google { background: #fff; color: #1f1f1f; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .btn-google:hover:not(:disabled) { background: #f4f4f5; }
        .btn-google svg { width: 18px; height: 18px; }
        .or-divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; width: 100%; }
        .or-divider span { color: #52525b; font-size: 0.8rem; white-space: nowrap; }
        .or-divider::before, .or-divider::after { content: ""; flex: 1; height: 1px; background: #27272a; }
        .field-group { margin-bottom: 14px; width: 100%; }
        .otp-inputs { display: flex; gap: 8px; justify-content: center; margin-bottom: 16px; }
        .otp-inputs input { width: 48px; height: 56px; text-align: center; font-size: 1.4rem; font-weight: 600; padding: 0; letter-spacing: 0; }
        .error { color: #ef4444; font-size: 0.8rem; margin-top: 8px; text-align: center; }
        .success { color: #22c55e; font-size: 0.8rem; margin-top: 8px; text-align: center; }
        .info { color: #a1a1aa; font-size: 0.8rem; margin-top: 8px; text-align: center; }
        .link { color: #06b6d4; cursor: pointer; text-decoration: none; font-size: 0.8rem; }
        .link:hover { text-decoration: underline; }
        .hidden { display: none !important; }
        .spinner { width: 20px; height: 20px; border: 2px solid transparent; border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .success-icon { width: 64px; height: 64px; border-radius: 50%; background: #064e3b; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .success-icon svg { width: 32px; height: 32px; color: #22c55e; }
      </style>
    </head>
    <body>
      <!-- Step 1: Invite Details + Auth -->
      <div class="card center" id="step-auth">
        #{logo_html}
        <h1>Join #{escape_html(org_name)}</h1>
        <p class="subtitle"><strong>#{escape_html(inviter_name)}</strong> has invited you to join <strong>#{escape_html(org_name)}</strong> on Clippster.</p>
        <div class="role-badge">#{escape_html(role)}</div>
        <div class="divider"></div>

        <p style="color: #a1a1aa; font-size: 0.8rem; margin: 0 0 16px;">Sign in or create an account to accept this invitation.</p>

        <!-- Google OAuth -->
        <button class="btn btn-google" id="btn-google" onclick="startGoogleAuth()">
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <div class="or-divider"><span>or</span></div>

        <!-- Email Auth -->
        <div class="field-group">
          <label for="email">Email address</label>
          <input type="email" id="email" placeholder="you@example.com" value="#{escape_html(email)}" />
        </div>
        <div class="field-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="Enter your password" />
        </div>
        <button class="btn btn-primary" id="btn-login" onclick="loginWithEmail()">Sign In &amp; Accept</button>
        <p class="info" style="margin-top: 12px;">Don't have an account? <span class="link" onclick="showRegister()">Create one</span></p>
        <div id="auth-error" class="error hidden"></div>
        <div id="auth-info" class="info hidden"></div>
      </div>

      <!-- Step 1b: Register -->
      <div class="card center hidden" id="step-register">
        #{logo_html}
        <h1>Create Account</h1>
        <p class="subtitle">Create an account to join <strong>#{escape_html(org_name)}</strong>.</p>
        <div class="field-group">
          <label for="reg-email">Email address</label>
          <input type="email" id="reg-email" placeholder="you@example.com" value="#{escape_html(email)}" />
        </div>
        <div class="field-group">
          <label for="reg-password">Password</label>
          <input type="password" id="reg-password" placeholder="Create a password (min 8 chars)" />
        </div>
        <button class="btn btn-primary" id="btn-register" onclick="registerWithEmail()">Create Account</button>
        <p class="info" style="margin-top: 12px;">Already have an account? <span class="link" onclick="showLogin()">Sign in</span></p>
        <div id="reg-error" class="error hidden"></div>
        <div id="reg-info" class="info hidden"></div>
      </div>

      <!-- Step 2: OTP Verification -->
      <div class="card center hidden" id="step-otp">
        #{logo_html}
        <h1>Check Your Email</h1>
        <p class="subtitle">We sent a 6-digit verification code to <strong id="otp-email"></strong></p>
        <div class="otp-inputs" id="otp-container">
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
        </div>
        <button class="btn btn-primary" id="btn-verify" onclick="verifyOtp()">Verify &amp; Accept Invitation</button>
        <div id="otp-error" class="error hidden"></div>
      </div>

      <!-- Step 3: Accepting -->
      <div class="card center hidden" id="step-accepting">
        <div class="spinner" style="width: 40px; height: 40px; border-width: 3px; margin-bottom: 16px;"></div>
        <h1>Accepting Invitation...</h1>
        <p class="subtitle">Please wait while we add you to #{escape_html(org_name)}.</p>
      </div>

      <!-- Step 4: Success -->
      <div class="card center hidden" id="step-success">
        <div class="success-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1>You're In!</h1>
        <p class="subtitle" id="success-msg">You've successfully joined #{escape_html(org_name)}.</p>
        <p style="color: #a1a1aa; font-size: 0.85rem;">Open the Clippster desktop app to get started.</p>
      </div>

      <!-- Step 5: Error -->
      <div class="card center hidden" id="step-error">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: #450a0a; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="32" height="32" fill="none" stroke="#ef4444" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h1>Something Went Wrong</h1>
        <p class="subtitle" id="error-msg">Unable to accept invitation.</p>
        <button class="btn btn-secondary" onclick="location.reload()">Try Again</button>
      </div>

      <script>
        const API = '#{api}';
        const TOKEN = '#{token}';
        let authToken = null;
        let pendingEmail = '';

        function $(id) { return document.getElementById(id); }
        function show(id) { $(id).classList.remove('hidden'); }
        function hide(id) { $(id).classList.add('hidden'); }
        function showOnly(id) {
          ['step-auth','step-register','step-otp','step-accepting','step-success','step-error'].forEach(s => hide(s));
          show(id);
        }
        function showError(containerId, msg) {
          const el = $(containerId);
          el.textContent = msg;
          el.classList.remove('hidden');
        }
        function clearErrors() {
          ['auth-error','auth-info','reg-error','reg-info','otp-error'].forEach(id => {
            $(id).classList.add('hidden');
          });
        }

        function showRegister() { clearErrors(); showOnly('step-register'); }
        function showLogin() { clearErrors(); showOnly('step-auth'); }

        // Email Login
        async function loginWithEmail() {
          clearErrors();
          const email = $('email').value.trim();
          const password = $('password').value;
          if (!email || !password) { showError('auth-error', 'Please enter email and password.'); return; }

          $('btn-login').disabled = true;
          $('btn-login').innerHTML = '<span class="spinner"></span> Signing in...';
          try {
            const res = await fetch(API + '/api/auth/email/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success && data.token) {
              authToken = data.token;
              await acceptInvitation();
            } else if (data.code === 'EMAIL_NOT_VERIFIED') {
              // Email not verified — resend verification and show OTP step
              pendingEmail = email;
              $('otp-email').textContent = email;
              await fetch(API + '/api/auth/email/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
              });
              showOnly('step-otp');
              setupOtpInputs();
            } else {
              showError('auth-error', data.error || 'Login failed. Check your credentials.');
            }
          } catch (e) {
            showError('auth-error', 'Network error. Please try again.');
          } finally {
            $('btn-login').disabled = false;
            $('btn-login').innerHTML = 'Sign In &amp; Accept';
          }
        }

        // Email Register
        async function registerWithEmail() {
          clearErrors();
          const email = $('reg-email').value.trim();
          const password = $('reg-password').value;
          if (!email) { showError('reg-error', 'Please enter your email.'); return; }
          if (!password || password.length < 8) { showError('reg-error', 'Password must be at least 8 characters.'); return; }

          $('btn-register').disabled = true;
          $('btn-register').innerHTML = '<span class="spinner"></span> Creating account...';
          try {
            const res = await fetch(API + '/api/auth/email/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
              pendingEmail = email;
              $('otp-email').textContent = email;
              showOnly('step-otp');
              setupOtpInputs();
            } else {
              showError('reg-error', data.error || 'Registration failed.');
            }
          } catch (e) {
            showError('reg-error', 'Network error. Please try again.');
          } finally {
            $('btn-register').disabled = false;
            $('btn-register').innerHTML = 'Create Account';
          }
        }

        // OTP Verification
        function setupOtpInputs() {
          const inputs = document.querySelectorAll('#otp-container input');
          inputs.forEach((input, i) => {
            input.value = '';
            input.addEventListener('input', (e) => {
              if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus();
              if (i === inputs.length - 1 && e.target.value) verifyOtp();
            });
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus();
            });
            input.addEventListener('paste', (e) => {
              e.preventDefault();
              const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '').slice(0, 6);
              text.split('').forEach((ch, j) => { if (inputs[j]) inputs[j].value = ch; });
              if (text.length === 6) verifyOtp();
            });
          });
          inputs[0].focus();
        }

        async function verifyOtp() {
          clearErrors();
          const inputs = document.querySelectorAll('#otp-container input');
          const otp = Array.from(inputs).map(i => i.value).join('');
          if (otp.length !== 6) { showError('otp-error', 'Please enter all 6 digits.'); return; }

          $('btn-verify').disabled = true;
          $('btn-verify').innerHTML = '<span class="spinner"></span> Verifying...';
          try {
            const res = await fetch(API + '/api/auth/email/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: pendingEmail, otp })
            });
            const data = await res.json();
            if (data.success && data.token) {
              authToken = data.token;
              await acceptInvitation();
            } else {
              showError('otp-error', data.error || 'Invalid code. Please try again.');
            }
          } catch (e) {
            showError('otp-error', 'Network error. Please try again.');
          } finally {
            $('btn-verify').disabled = false;
            $('btn-verify').innerHTML = 'Verify &amp; Accept Invitation';
          }
        }

        // Google OAuth
        function startGoogleAuth() {
          // Open Google OAuth in popup, passing invite token as state
          const w = 500, h = 600;
          const left = (screen.width - w) / 2;
          const top = (screen.height - h) / 2;
          const url = API + '/api/auth/google?redirect_mode=invite&invite_token=' + encodeURIComponent(TOKEN);
          const popup = window.open(url, 'google-auth', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);

          // Listen for message from popup
          window.addEventListener('message', function handler(e) {
            if (e.data && e.data.type === 'google-auth-success' && e.data.token) {
              authToken = e.data.token;
              window.removeEventListener('message', handler);
              if (popup) popup.close();
              acceptInvitation();
            }
          });

          // Poll for popup close
          const poll = setInterval(() => {
            if (popup && popup.closed) { clearInterval(poll); }
          }, 500);
        }

        // Accept Invitation
        async function acceptInvitation() {
          showOnly('step-accepting');
          try {
            const res = await fetch(API + '/api/invitations/' + encodeURIComponent(TOKEN) + '/accept', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
              }
            });
            const data = await res.json();
            if (data.success) {
              showOnly('step-success');
            } else {
              $('error-msg').textContent = data.error || 'Failed to accept invitation.';
              showOnly('step-error');
            }
          } catch (e) {
            $('error-msg').textContent = 'Network error. Please try again.';
            showOnly('step-error');
          }
        }

        // Allow Enter key on password fields
        $('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') loginWithEmail(); });
        $('reg-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') registerWithEmail(); });
      </script>
    </body>
    </html>
    """
  end

  defp expired_html do
    frontend_base_url =
      Application.get_env(:clippster_server, :frontend_base_url, "https://clippster.app")

    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Invitation Expired - Clippster</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0a0b; color: #f4f4f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card { width: min(92vw, 440px); border: 1px solid #27272a; background: #111114; border-radius: 16px; padding: 32px; text-align: center; }
        h1 { color: #f59e0b; margin: 0 0 12px; font-size: 1.35rem; }
        p { color: #a1a1aa; margin: 0 0 20px; line-height: 1.5; font-size: 0.9rem; }
        a { display: inline-block; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 0.9rem; }
        a:hover { background: #1f1f23; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Invitation Not Found</h1>
        <p>This invitation link is invalid, has expired, or has already been accepted.</p>
        <a href="#{frontend_base_url}">Go to Clippster</a>
      </div>
    </body>
    </html>
    """
  end

  defp escape_html(nil), do: ""
  defp escape_html(str) do
    str
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
