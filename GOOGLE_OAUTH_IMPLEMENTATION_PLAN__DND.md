# Google OAuth Implementation Plan

## Overview

This document outlines a comprehensive plan to implement Google OAuth authentication alongside the existing Solana wallet-based authentication system in Clippster. The approach maintains backward compatibility while providing users with flexible authentication options.

## Current Authentication System Analysis

### Existing Wallet-Based Authentication Flow

1. **Challenge-Response Mechanism**:
   - Client requests challenge from `/api/auth/challenge` with unique client_id
   - Server generates nonce with 5-minute TTL using ETS table (`ClippsterServer.Auth.ChallengeStore`)
   - Client signs message with Solana wallet (ED25519 signature)
   - Server verifies signature using Node.js script (`sig_verify.js`)
   - JWT token issued with 7-day expiration (`ClippsterServer.Auth.TokenGenerator`)

2. **User Management**:
   - Users identified by `wallet_address` (unique constraint)
   - First user automatically becomes admin
   - New users receive 1 free credit hour
   - JWT claims include `user_id`, `wallet_address`, `is_admin`

3. **Frontend Integration**:
   - Tauri desktop app opens browser for wallet authentication (`client/src-tauri/src/auth.rs`)
   - Event-based communication between Rust backend and Vue frontend (`client/src/stores/auth.js`)
   - LocalStorage persistence for auth tokens
   - Router guards protect authenticated routes (`client/src/router/index.ts`)

4. **Security Features**:
   - Challenge-response prevents replay attacks
   - ED25519 signature verification for Solana wallets
   - CORS configured for Tauri and development servers
   - JWT tokens with expiration

## Implementation Plan

### Phase 1: Backend Setup and Dependencies

#### 1.1 Add Required Dependencies
**File: `server/mix.exs`**
```elixir
# Add to deps function
defp deps do
  [
    # ... existing dependencies
    {:ueberauth, "~> 0.10"},
    {:ueberauth_google, "~> 0.10"}
  ]
end
```

#### 1.2 Environment Configuration
**File: `server/config/dev.exs`**
```elixir
# Add OAuth configuration
config :ueberauth, Ueberauth,
  providers: [
    google: {Ueberauth.Strategy.Google, [default_scope: "email profile"]}
  ]

config :ueberauth, Ueberauth.Strategy.Google.OAuth,
  client_id: System.get_env("GOOGLE_CLIENT_ID"),
  client_secret: System.get_env("GOOGLE_CLIENT_SECRET")
```

**File: `server/config/prod.exs`**
```elixir
# Production configuration with proper domain
config :ueberauth, Ueberauth,
  providers: [
    google: {Ueberauth.Strategy.Google, [default_scope: "email profile"]}
  ]

config :ueberauth, Ueberauth.Strategy.Google.OAuth,
  client_id: System.get_env("GOOGLE_CLIENT_ID"),
  client_secret: System.get_env("GOOGLE_CLIENT_SECRET")
```

#### 1.3 Database Schema Migration
**New migration file: `server/priv/repo/migrations/add_oauth_to_users.exs`**
```elixir
defmodule ClippsterServer.Repo.Migrations.AddOAuthToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :email, :string
      add :name, :string
      add :avatar_url, :string
      add :provider, :string  # "google", "wallet", "email"
      add :provider_id, :string  # Google sub or wallet address
    end

    create unique_index(:users, [:email])
    create unique_index(:users, [:provider, :provider_id])
  end
end
```

### Phase 2: User Model and Context Updates

#### 2.1 Update User Schema
**File: `server/lib/clippster_server/accounts/user.ex`**
```elixir
defmodule ClippsterServer.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :wallet_address, :string
    field :email, :string
    field :name, :string
    field :avatar_url, :string
    field :provider, :string  # "google", "wallet", "email"
    field :provider_id, :string
    field :is_admin, :boolean, default: false

    timestamps()
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:wallet_address, :email, :name, :avatar_url, :provider, :provider_id, :is_admin])
    |> validate_required([:provider, :provider_id])
    |> validate_inclusion(:provider, ["google", "wallet", "email"])
    |> unique_constraint(:wallet_address)
    |> unique_constraint(:email)
    |> unique_constraint([:provider, :provider_id])
  end

  def oauth_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :avatar_url])
    |> validate_required([:email])
    |> unique_constraint(:email)
  end
end
```

#### 2.2 Extend Accounts Context
**File: `server/lib/clippster_server/accounts.ex`**
Add new functions:

```elixir
@doc """
Gets a user by email address.
"""
def get_user_by_email(email) do
  Repo.get_by(User, email: email)
end

@doc """
Gets a user by provider and provider_id.
"""
def get_user_by_provider(provider, provider_id) do
  Repo.get_by(User, provider: provider, provider_id: provider_id)
end

@doc """
Creates or gets a user from OAuth provider.
If this is the first user, they are marked as admin.
"""
def get_or_create_oauth_user(provider, provider_id, oauth_info \\ %{}) do
  case get_user_by_provider(provider, provider_id) do
    nil -> create_oauth_user(provider, provider_id, oauth_info)
    user ->
      # Update OAuth info if it's stale
      update_oauth_info(user, oauth_info)
  end
end

@doc """
Creates an OAuth user.
"""
defp create_oauth_user(provider, provider_id, oauth_info) do
  is_first_user = Repo.aggregate(User, :count) == 0

  Repo.transaction(fn ->
    user_attrs = %{
      provider: provider,
      provider_id: provider_id,
      email: Map.get(oauth_info, :email),
      name: Map.get(oauth_info, :name),
      avatar_url: Map.get(oauth_info, :avatar_url),
      is_admin: is_first_user
    }

    user = %User{}
      |> User.changeset(user_attrs)
      |> Repo.insert!()

    # Give new user 1 free hour of credits
    {:ok, _user_credit} = Credits.add_credits(user.id, 1)

    user
  end)
  |> case do
    {:ok, user} -> {:ok, user}
    {:error, reason} -> {:error, reason}
  end
end

@doc """
Links OAuth account to existing wallet user.
"""
def link_oauth_to_user(user_id, provider, provider_id, oauth_info) do
  user = get_user(user_id)

  if user do
    user_attrs = %{
      email: Map.get(oauth_info, :email),
      name: Map.get(oauth_info, :name) || user.name,
      avatar_url: Map.get(oauth_info, :avatar_url)
    }

    # Store OAuth info in a separate table or as JSON in user record
    update_user(user, user_attrs)
  else
    {:error, :not_found}
  end
end

@doc """
Updates OAuth information for a user.
"""
defp update_oauth_info(user, oauth_info) do
  oauth_attrs = %{
    email: Map.get(oauth_info, :email) || user.email,
    name: Map.get(oauth_info, :name) || user.name,
    avatar_url: Map.get(oauth_info, :avatar_url) || user.avatar_url
  }

  update_user(user, oauth_attrs)
end
```

### Phase 3: OAuth Authentication Flow

#### 3.1 OAuth Routes
**File: `server/lib/clippster_server_web/router.ex`**
Add OAuth routes to the existing router:

```elixir
# Add to :api pipeline
scope "/api/auth", ClippsterServerWeb do
  pipe_through :api

  # OAuth routes
  get "/google", AuthController, :google_request
  get "/google/callback", AuthController, :google_callback

  # Existing wallet endpoints
  post "/challenge", AuthController, :request_challenge
  post "/verify", AuthController, :verify_signature

  # Get current user info
  get "/me", AuthController, :get_current_user
end

# Add account linking routes (authenticated)
scope "/api/auth", ClippsterServerWeb do
  pipe_through :api_auth

  post "/link/google", AuthController, :link_google_account
  delete "/unlink/google", AuthController, :unlink_google_account
end
```

#### 3.2 OAuth Controller Implementation
**File: `server/lib/clippster_server_web/controllers/auth_controller.ex`**
Add new functions to the existing `AuthController`:

```elixir
# Add to existing imports
alias Ueberauth.Strategy.Helpers

def google_request(conn, _params) do
  redirect(conn, to: Routes.auth_path(conn, :google_callback, Helpers.auth_url(conn, :google)))
end

def google_callback(%{assigns: %{ueberauth_auth: auth}} = conn, _params) do
  case auth do
    %Ueberauth.Auth{strategy: Ueberauth.Strategy.Google,
                    uid: uid,
                    info: %{email: email, name: name, image: image},
                    credentials: %{token: token}} ->

      oauth_info = %{
        email: email,
        name: name,
        avatar_url: image,
        access_token: token
      }

      # Create or get user
      case Accounts.get_or_create_oauth_user("google", uid, oauth_info) do
        {:ok, user} ->
          # Generate JWT token
          token_claims = %{
            "sub" => "google:#{uid}",
            "iat" => DateTime.utc_now() |> DateTime.to_unix(),
            "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
            "provider" => "google",
            "provider_id" => uid,
            "user_id" => user.id,
            "is_admin" => user.is_admin,
            "email" => user.email
          }

          case TokenGenerator.generate_token(token_claims) do
            {:ok, token} ->
              json(conn, %{
                success: true,
                token: token,
                provider: "google",
                user: %{
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  avatar_url: user.avatar_url,
                  is_admin: user.is_admin
                }
              })

            {:error, _reason} ->
              conn
              |> put_status(500)
              |> json(%{success: false, error: "Token generation failed"})
          end

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Failed to create user: #{inspect(reason)}"})
      end

    _ ->
      conn
      |> put_status(401)
      |> json(%{success: false, error: "Authentication failed"})
  end
end

def google_callback(%{assigns: %{ueberauth_failure: _failure}} = conn, _params) do
  conn
  |> put_status(401)
  |> json(%{success: false, error: "Google authentication failed"})
end

def link_google_account(%{assigns: %{current_user_id: user_id}} = conn, %{"access_token" => access_token}) do
  # Verify Google token and extract user info
  case verify_google_token(access_token) do
    {:ok, google_info} ->
      case Accounts.link_oauth_to_user(user_id, "google", google_info["sub"], %{
        email: google_info["email"],
        name: google_info["name"],
        avatar_url: google_info["picture"]
      }) do
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

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Failed to link account"})
      end

    {:error, _reason} ->
      conn
      |> put_status(401)
      |> json(%{success: false, error: "Invalid Google token"})
  end
end

defp verify_google_token(access_token) do
  # Use Google token verification API
  url = "https://www.googleapis.com/oauth2/v2/userinfo"
  headers = [{"Authorization", "Bearer #{access_token}"}]

  case :httpc.request(:get, {url, headers}, [], []) do
    {:ok, {{_, 200, _}, _headers, body}} ->
      case Jason.decode(body) do
        {:ok, google_info} -> {:ok, google_info}
        {:error, _} -> {:error, :invalid_response}
      end

    _ ->
      {:error, :token_verification_failed}
  end
end

def get_current_user(%{assigns: %{current_user_claims: claims}} = conn, _params) do
  user = Accounts.get_user(claims["user_id"])

  if user do
    json(conn, %{
      success: true,
      user: %{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        provider: user.provider,
        is_admin: user.is_admin
      }
    })
  else
    conn
    |> put_status(404)
    |> json(%{success: false, error: "User not found"})
  end
end
```

#### 3.3 Frontend Endpoint Configuration
**File: `server/lib/clippster_server_web/endpoint.ex`**
Ensure proper URL configuration for OAuth callbacks:

```elixir
config :clippster_server, ClippsterServerWeb.Endpoint,
  url: [host: "localhost", port: 4000],
  secret_key_base: System.get_env("SECRET_KEY_BASE")
```

### Phase 4: Frontend Authentication UI

#### 4.1 Authentication Component Redesign
**Rename: `client/src/components/WalletAuth.vue` → `client/src/components/Auth.vue`**

```vue
<template>
  <div class="flex items-center justify-center min-h-screen">
    <!-- Login Card -->
    <div class="w-full max-w-md">
      <div class="relative overflow-hidden rounded-2xl border border-border/50 bg-card backdrop-blur-sm">
        <!-- Gradient overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none"
        />

        <div class="relative p-8">
          <!-- Logo -->
          <div class="flex justify-center mb-6">
            <img src="/logo.svg" alt="Clippster" class="h-12 w-auto" />
          </div>

          <!-- Title -->
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-foreground mb-2">Sign In to Clippster</h2>
            <p class="text-muted-foreground text-sm">Choose your preferred authentication method</p>
          </div>

          <!-- Wallet Authentication Button -->
          <button
            @click="connectWallet"
            :disabled="authStore.loading"
            class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none mb-3"
          >
            <div
              class="relative rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
            >
              <span class="flex items-center justify-center gap-2 font-semibold text-white">
                <svg v-if="!authStore.loading" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.5 2h11c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2z"/>
                </svg>
                <svg
                  v-else
                  class="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ authStore.loading && authMethod === 'wallet' ? 'Connecting...' : 'Connect Phantom Wallet' }}
              </span>
            </div>
          </button>

          <!-- OR Divider -->
          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-border/50"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-card text-muted-foreground">OR</span>
            </div>
          </div>

          <!-- Google Authentication Button -->
          <button
            @click="authenticateWithGoogle"
            :disabled="authStore.loading"
            class="w-full relative overflow-hidden rounded-lg border border-border/50 bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            <span class="flex items-center justify-center gap-2 font-medium px-6 py-3">
              <svg v-if="!authStore.loading" class="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {{ authStore.loading && authMethod === 'google' ? 'Signing in...' : 'Continue with Google' }}
            </span>
          </button>

          <!-- Error Message -->
          <div v-if="authStore.error" class="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <div class="flex items-start gap-3">
              <svg
                class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p class="text-sm text-destructive">{{ authStore.error }}</p>
            </div>
          </div>

          <!-- Info Section -->
          <div class="mt-6 pt-6 border-t border-border/50">
            <p class="text-xs text-muted-foreground text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const authMethod = ref(null)

const connectWallet = async () => {
  authMethod.value = 'wallet'
  const result = await authStore.authenticateWithWallet()
  if (result.success) {
    router.push('/dashboard')
  }
}

const authenticateWithGoogle = async () => {
  authMethod.value = 'google'
  const result = await authStore.authenticateWithGoogle()
  if (result.success) {
    router.push('/dashboard')
  }
}

onMounted(() => {
  // Check if already authenticated and redirect if so
  authStore.checkAuth()
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
  }
})
</script>
```

#### 4.2 Authentication Store Updates
**File: `client/src/stores/auth.js`**
Add new actions and state properties:

```javascript
export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    walletAddress: null,
    email: null,
    token: null,
    user: null,
    loading: false,
    error: null,
    authProvider: null, // 'wallet', 'google', or null
  }),

  actions: {
    // Existing wallet authentication methods...

    async authenticateWithGoogle() {
      this.loading = true;
      this.error = null;

      try {
        // Open Google OAuth in popup
        const googleAuthUrl = `${API_BASE}/api/auth/google`;
        const popup = window.open(googleAuthUrl, 'google_auth', 'width=500,height=600,scrollbars=yes,resizable=yes');

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        // Listen for popup close or message
        const result = await new Promise((resolve, reject) => {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              reject(new Error('Authentication cancelled'));
            }
          }, 1000);

          const messageHandler = (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
              clearInterval(checkClosed);
              window.removeEventListener('message', messageHandler);
              popup.close();
              resolve(event.data);
            } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
              clearInterval(checkClosed);
              window.removeEventListener('message', messageHandler);
              popup.close();
              reject(new Error(event.data.error));
            }
          };

          window.addEventListener('message', messageHandler);
        });

        // Store auth data
        this.token = result.token;
        this.email = result.user.email;
        this.user = result.user;
        this.authProvider = 'google';
        this.isAuthenticated = true;

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('email', result.user.email);
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.setItem('auth_provider', 'google');

        return { success: true };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    async linkGoogleAccount() {
      try {
        // This would be called from account settings page
        const response = await fetch(`${API_BASE}/api/auth/link/google`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          // Would need Google access token from Google Sign-In
          body: JSON.stringify({ access_token: googleAccessToken })
        });

        if (response.ok) {
          const data = await response.json();
          this.user = { ...this.user, ...data.user };
          return { success: true };
        } else {
          throw new Error('Failed to link Google account');
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    logout() {
      this.isAuthenticated = false;
      this.walletAddress = null;
      this.email = null;
      this.token = null;
      this.user = null;
      this.authProvider = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('email');
      localStorage.removeItem('user');
      localStorage.removeItem('auth_provider');
    },

    async checkAuth() {
      const token = localStorage.getItem('auth_token');
      const walletAddress = localStorage.getItem('wallet_address');
      const email = localStorage.getItem('email');
      const userJson = localStorage.getItem('user');
      const authProvider = localStorage.getItem('auth_provider');

      if (token && userJson) {
        try {
          this.token = token;
          this.walletAddress = walletAddress;
          this.email = email;
          this.user = JSON.parse(userJson);
          this.authProvider = authProvider;
          this.isAuthenticated = true;
          return true;
        } catch (error) {
          console.error('Failed to parse user data:', error);
          this.logout();
        }
      }
      return false;
    },

    // Get current user information
    async getCurrentUser() {
      if (!this.token) return null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.user = data.user;
            return data.user;
          }
        }
      } catch (error) {
        console.error('Failed to get current user:', error);
      }

      return null;
    },
  },
});
```

#### 4.3 Router Configuration Updates
**File: `client/src/router/index.ts`**
Update route references:

```typescript
// Update the login route
{
  path: '/login',
  name: 'login',
  component: () => import('@/components/Auth.vue'), // Changed from WalletAuth.vue
  beforeEnter: (_to, _from, next) => {
    const authStore = useAuthStore();
    if (authStore.isAuthenticated) {
      next('/projects');
    } else {
      next();
    }
  },
},
```

### Phase 5: Security and Integration Considerations

#### 5.1 Security Measures

**CSRF Protection for OAuth**:
```elixir
# In AuthController, add state parameter for OAuth
def google_request(conn, _params) do
  state = :crypto.strong_rand_bytes(32) |> Base.encode64()
  # Store state in session or encrypted cookie

  redirect_url = Routes.auth_path(conn, :google_callback) <> "?state=#{state}"
  redirect(conn, to: redirect_url)
end
```

**Rate Limiting**:
```elixir
# Add to router pipeline
plug :rate_limit, [max_requests: 10, window_seconds: 60] when action in [:google_request, :verify_signature]
```

**Token Security**:
- Use HTTPS in production
- Implement proper JWT secret rotation
- Add refresh token mechanism
- Store tokens securely in Tauri secure storage

#### 5.2 Account Linking Strategy

**Primary Identification**: Wallet address remains the primary identifier for blockchain-related features.

**Secondary Authentication**: Google OAuth provides convenient access but doesn't replace wallet functionality.

**Linking Flow**:
1. User authenticates with wallet first
2. Later, can link Google account from settings
3. Linked accounts can use either method for login
4. Admin status preserved regardless of login method

#### 5.3 User Experience Flow

**New User Registration**:
1. User chooses "Continue with Google" or "Connect Wallet"
2. Google users get immediate access, wallet users complete signature flow
3. Both methods create user records with appropriate provider info
4. Users can optionally link additional auth methods later

**Returning User Login**:
1. User chooses preferred login method
2. System authenticates and loads user profile
3. If multiple auth methods linked, user can choose any of them

**Account Settings**:
- Display linked authentication methods
- Allow linking/unlinking of additional methods
- Require wallet confirmation before unlinking primary wallet
- Maintain admin status regardless of auth method changes

### Phase 6: Testing and Deployment

#### 6.1 Testing Strategy

**Backend Testing**:
```elixir
# test/clippster_server_web/controllers/auth_controller_test.exs
defmodule ClippsterServerWeb.AuthControllerTest do
  use ClippsterServerWeb.ConnCase

  describe "Google OAuth" do
    test "successful Google authentication", %{conn: conn} do
      # Mock Ueberauth auth
      auth = %Ueberauth.Auth{
        strategy: Ueberauth.Strategy.Google,
        uid: "123456789",
        info: %{email: "test@example.com", name: "Test User"}
      }

      conn = assign(conn, :ueberauth_auth, auth)
      conn = get(conn, "/api/auth/google/callback")

      assert json_response(conn, 200)["success"]
    end
  end
end
```

**Frontend Testing**:
```javascript
// Add tests for new authentication methods
describe('Google Authentication', () => {
  it('should authenticate with Google successfully', async () => {
    const authStore = useAuthStore();
    const result = await authStore.authenticateWithGoogle();
    expect(result.success).toBe(true);
  });
});
```

**End-to-End Testing**:
- Test complete OAuth flow
- Test account linking scenarios
- Test session persistence
- Test error handling

#### 6.2 Environment Variables Required

**Development (.env)**:
```
GOOGLE_CLIENT_ID=your_google_oauth_client_id_dev
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret_dev
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

**Production (.env)**:
```
GOOGLE_CLIENT_ID=your_google_oauth_client_id_prod
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret_prod
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
```

#### 6.3 Google API Console Setup

**Steps**:
1. Go to [Google Developer Console](https://console.developers.google.com/)
2. Create new project or select existing
3. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
4. Select "Web application" type
5. Add authorized JavaScript origins:
   - `http://localhost:1420` (Tauri dev)
   - `http://localhost:4000` (API server)
   - `tauri://localhost` (Tauri protocol)
   - Your production domain
6. Add authorized redirect URIs:
   - `http://localhost:4000/api/auth/google/callback`
   - `https://yourdomain.com/api/auth/google/callback`
7. Enable Google+ API and People API for profile information
8. Download client credentials and add to environment variables

#### 6.4 Deployment Checklist

**Backend**:
- [ ] Add Ueberauth dependencies
- [ ] Run database migration
- [ ] Configure OAuth credentials
- [ ] Test OAuth flow in staging
- [ ] Update CORS configuration for production domain

**Frontend**:
- [ ] Update authentication components
- [ ] Test Google OAuth flow
- [ ] Update Tauri configuration for production URL
- [ ] Test account linking functionality
- [ ] Verify session persistence

**Security**:
- [ ] Enable HTTPS in production
- [ ] Set secure cookie flags
- [ ] Implement rate limiting
- [ ] Test XSS and CSRF protection
- [ ] Review token security implementation

## Implementation Timeline

### Week 1: Backend Foundation
- Day 1-2: Add dependencies and database migration
- Day 3-4: Update User model and Accounts context
- Day 5: Implement OAuth controller basic functionality

### Week 2: Frontend Integration
- Day 1-2: Redesign authentication components
- Day 3-4: Update auth store and router
- Day 5: Test basic OAuth flow end-to-end

### Week 3: Advanced Features
- Day 1-2: Implement account linking
- Day 3-4: Add security measures and error handling
- Day 5: Comprehensive testing

### Week 4: Testing and Deployment
- Day 1-2: Complete testing suite
- Day 3-4: Staging deployment and validation
- Day 5: Production deployment

## Success Metrics

**Technical Metrics**:
- OAuth authentication success rate > 95%
- Account linking success rate > 90%
- Authentication response time < 2 seconds
- Zero security vulnerabilities related to OAuth

**User Experience Metrics**:
- Reduced friction for non-crypto users
- Improved conversion rate for new user signups
- Retention of existing wallet users
- Positive user feedback on authentication options

## Risk Mitigation

**Security Risks**:
- OAuth token compromise → Implement proper token validation and rotation
- CSRF attacks → Use state parameters and secure cookies
- Account takeover → Require wallet verification for sensitive operations

**Technical Risks**:
- OAuth provider downtime → Maintain wallet authentication as fallback
- Breaking changes to Google OAuth API → Version lock dependencies
- Database migration issues → Comprehensive testing and rollback plan

**User Experience Risks**:
- Confusion about multiple auth methods → Clear UI and documentation
- Account linking complexity → Simplified workflow and clear instructions
- Existing user disruption → Transparent communication about new features

## Conclusion

This implementation plan provides a comprehensive roadmap for adding Google OAuth authentication to Clippster while maintaining the robust Solana wallet authentication system. The phased approach ensures minimal disruption to existing users while providing a more accessible authentication option for new users.

The key benefits include:
- **Maintains backward compatibility** with existing wallet users
- **Provides flexible authentication** options for users
- **Follows security best practices** for OAuth implementation
- **Enables future authentication methods** through extensible architecture
- **Improves user experience** by reducing signup friction

By following this plan, Clippster can achieve broader user adoption while maintaining its Web3-native capabilities and security posture.