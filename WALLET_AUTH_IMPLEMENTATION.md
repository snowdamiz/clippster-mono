# Phantom Wallet Authentication Implementation Guide

## Overview
This guide details implementing secure wallet-based authentication using Phantom wallet with a Tauri/Vue frontend and Elixir/Phoenix backend. The approach uses a webview bridge to enable Phantom browser extension interaction.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Tauri App     │────▶│   Webview        │────▶│  Phantom Wallet │
│   (Vue Native)  │◀────│  (Bridge Page)   │◀────│   (Extension)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                 
         │ JWT Token                                      
         ▼                                                
┌─────────────────┐                                      
│ Phoenix Server  │                                      
│   (Elixir)      │                                      
└─────────────────┘                                      
```

## Implementation Steps

### 1. Phoenix Backend Setup

#### Dependencies (`mix.exs`)
```elixir
defp deps do
  [
    {:phoenix, "~> 1.7.0"},
    {:jason, "~> 1.4"},
    {:joken, "~> 2.6"},
    {:ed25519, "~> 1.4"},
    {:base58, "~> 0.1.0"},
    {:cachex, "~> 3.6"},
    {:cors_plug, "~> 3.0"}
  ]
end
```

#### Challenge Store Module (`lib/app/auth/challenge_store.ex`)
```elixir
defmodule App.Auth.ChallengeStore do
  use GenServer
  
  @challenge_ttl :timer.minutes(5)
  
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end
  
  def init(_) do
    :ets.new(:auth_challenges, [:set, :public, :named_table])
    schedule_cleanup()
    {:ok, %{}}
  end
  
  def create_challenge(client_id) do
    nonce = :crypto.strong_rand_bytes(32) |> Base.encode64()
    timestamp = DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    
    challenge = %{
      nonce: nonce,
      timestamp: timestamp,
      client_id: client_id,
      domain: Application.get_env(:app, :domain),
      expires_at: timestamp + @challenge_ttl
    }
    
    :ets.insert(:auth_challenges, {nonce, challenge})
    challenge
  end
  
  def get_challenge(nonce) do
    case :ets.lookup(:auth_challenges, nonce) do
      [{^nonce, challenge}] -> 
        if DateTime.utc_now() |> DateTime.to_unix(:millisecond) < challenge.expires_at do
          {:ok, challenge}
        else
          :ets.delete(:auth_challenges, nonce)
          {:error, :expired}
        end
      [] -> {:error, :not_found}
    end
  end
  
  def consume_challenge(nonce) do
    case get_challenge(nonce) do
      {:ok, challenge} ->
        :ets.delete(:auth_challenges, nonce)
        {:ok, challenge}
      error -> error
    end
  end
  
  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, :timer.minutes(1))
  end
  
  def handle_info(:cleanup, state) do
    now = DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    
    :ets.select_delete(:auth_challenges, [
      {
        {:_, %{expires_at: :"$1"}},
        [{:<, :"$1", now}],
        [true]
      }
    ])
    
    schedule_cleanup()
    {:noreply, state}
  end
end
```

#### Authentication Controller (`lib/app_web/controllers/auth_controller.ex`)
```elixir
defmodule AppWeb.AuthController do
  use AppWeb, :controller
  alias App.Auth.{ChallengeStore, TokenGenerator}
  
  @sign_message_template """
  <%= domain %> wants you to sign in with your Solana account:
  <%= wallet_address %>
  
  Nonce: <%= nonce %>
  Issued At: <%= timestamp %>
  Chain ID: mainnet-beta
  """
  
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
    with {:ok, challenge} <- ChallengeStore.consume_challenge(nonce),
         :ok <- validate_message(message, challenge, public_key),
         :ok <- verify_ed25519_signature(message, signature, public_key) do
      
      # Generate JWT token
      token_claims = %{
        "sub" => public_key,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
        "wallet_address" => public_key
      }
      
      case TokenGenerator.generate_token(token_claims) do
        {:ok, token} ->
          json(conn, %{
            success: true,
            token: token,
            wallet_address: public_key
          })
        
        {:error, reason} ->
          json(conn, %{success: false, error: "Token generation failed"})
      end
    else
      {:error, :not_found} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid or expired challenge"})
      
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
    expected_message = EEx.eval_string(@sign_message_template, [
      domain: challenge.domain,
      wallet_address: wallet_address,
      nonce: challenge.nonce,
      timestamp: challenge.timestamp
    ])
    
    if message == expected_message do
      :ok
    else
      {:error, :invalid_message}
    end
  end
  
  defp verify_ed25519_signature(message, signature_b58, public_key_b58) do
    try do
      signature = Base58.decode(signature_b58)
      public_key = Base58.decode(public_key_b58)
      message_bytes = :erlang.binary_to_list(message)
      
      case :crypto.verify(:eddsa, :none, message_bytes, signature, [public_key, :ed25519]) do
        true -> :ok
        false -> {:error, :invalid_signature}
      end
    rescue
      _ -> {:error, :invalid_signature}
    end
  end
end
```

#### JWT Token Generator (`lib/app/auth/token_generator.ex`)
```elixir
defmodule App.Auth.TokenGenerator do
  use Joken.Config
  
  @impl true
  def token_config do
    default_claims(skip: [:aud])
    |> add_claim("iss", fn -> "app" end, &(&1 == "app"))
  end
  
  def generate_token(claims) do
    signer = Joken.Signer.create("HS256", Application.get_env(:app, :jwt_secret))
    
    case Joken.generate_and_sign(claims, signer) do
      {:ok, token, _claims} -> {:ok, token}
      error -> error
    end
  end
  
  def verify_token(token) do
    signer = Joken.Signer.create("HS256", Application.get_env(:app, :jwt_secret))
    
    case Joken.verify_and_validate(token, signer) do
      {:ok, claims} -> {:ok, claims}
      error -> error
    end
  end
end
```

#### Router Configuration (`lib/app_web/router.ex`)
```elixir
defmodule AppWeb.Router do
  use AppWeb, :router
  
  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug, origin: ["tauri://localhost", "http://localhost:*"]
  end
  
  pipeline :authenticated do
    plug AppWeb.Plugs.AuthenticateToken
  end
  
  scope "/api", AppWeb do
    pipe_through :api
    
    # Public auth endpoints
    post "/auth/challenge", AuthController, :request_challenge
    post "/auth/verify", AuthController, :verify_signature
    
    # Protected routes
    pipe_through :authenticated
    get "/user/profile", UserController, :profile
  end
end
```

### 2. Tauri Configuration

#### Update `tauri.conf.json`
```json
{
  "tauri": {
    "allowlist": {
      "window": {
        "all": true,
        "create": true
      },
      "shell": {
        "open": true
      }
    },
    "windows": [{
      "title": "App",
      "width": 1200,
      "height": 800,
      "webviewWindow": true
    }],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:4000 https://your-api.com"
    }
  }
}
```

#### Rust Bridge (`src-tauri/src/main.rs`)
```rust
use tauri::{Manager, Window};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct WalletAuthResult {
    signature: String,
    public_key: String,
    message: String,
}

#[tauri::command]
async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    let webview_window = tauri::WindowBuilder::new(
        &app,
        "wallet-auth",
        tauri::WindowUrl::App("wallet-auth.html".into())
    )
    .title("Connect Wallet")
    .inner_size(500.0, 600.0)
    .resizable(false)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn close_auth_window(window: Window) -> Result<(), String> {
    window.get_window("wallet-auth")
        .map(|w| w.close())
        .transpose()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_wallet_auth_window,
            close_auth_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. Vue Frontend Implementation

#### Wallet Auth Store (`src/stores/auth.js`)
```javascript
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/tauri'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    walletAddress: null,
    token: null,
    loading: false,
    error: null
  }),
  
  actions: {
    async requestChallenge() {
      const response = await fetch(`${API_BASE}/api/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          client_id: await this.getClientId() 
        })
      })
      
      if (!response.ok) throw new Error('Failed to get challenge')
      return await response.json()
    },
    
    async authenticateWithWallet() {
      this.loading = true
      this.error = null
      
      try {
        // Open wallet auth window
        await invoke('open_wallet_auth_window')
        
        // Listen for auth result
        const result = await new Promise((resolve, reject) => {
          window.addEventListener('wallet-auth-complete', (event) => {
            resolve(event.detail)
          })
          
          // Timeout after 2 minutes
          setTimeout(() => reject(new Error('Auth timeout')), 120000)
        })
        
        // Verify signature with backend
        const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature: result.signature,
            public_key: result.publicKey,
            message: result.message,
            nonce: result.nonce
          })
        })
        
        if (!verifyResponse.ok) {
          throw new Error('Signature verification failed')
        }
        
        const { token, wallet_address } = await verifyResponse.json()
        
        // Store auth data
        this.token = token
        this.walletAddress = wallet_address
        this.isAuthenticated = true
        
        // Store in localStorage for persistence
        localStorage.setItem('auth_token', token)
        localStorage.setItem('wallet_address', wallet_address)
        
        // Close auth window
        await invoke('close_auth_window')
        
        return { success: true }
        
      } catch (error) {
        this.error = error.message
        return { success: false, error: error.message }
      } finally {
        this.loading = false
      }
    },
    
    async getClientId() {
      let clientId = localStorage.getItem('client_id')
      if (!clientId) {
        clientId = crypto.randomUUID()
        localStorage.setItem('client_id', clientId)
      }
      return clientId
    },
    
    logout() {
      this.isAuthenticated = false
      this.walletAddress = null
      this.token = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('wallet_address')
    },
    
    async checkAuth() {
      const token = localStorage.getItem('auth_token')
      const walletAddress = localStorage.getItem('wallet_address')
      
      if (token && walletAddress) {
        // Optionally verify token with backend
        this.token = token
        this.walletAddress = walletAddress
        this.isAuthenticated = true
        return true
      }
      return false
    }
  }
})
```

#### Wallet Bridge Page (`public/wallet-auth.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Wallet</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    }
    h1 {
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }
    #connect-btn {
      background: #512DA8;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s;
    }
    #connect-btn:hover {
      background: #673AB7;
      transform: translateY(-2px);
    }
    #connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status {
      margin-top: 1rem;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .error {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      padding: 8px;
      border-radius: 4px;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Connect Your Phantom Wallet</h1>
    <button id="connect-btn">Connect Wallet</button>
    <div id="status" class="status"></div>
    <div id="error" class="error" style="display: none;"></div>
  </div>

  <script>
    const API_BASE = 'http://localhost:4000';
    let provider = null;

    // Check for Phantom
    const getProvider = () => {
      if ('phantom' in window) {
        const provider = window.phantom?.solana;
        if (provider?.isPhantom) {
          return provider;
        }
      }
      return null;
    };

    // Update status
    const updateStatus = (message) => {
      document.getElementById('status').textContent = message;
    };

    const showError = (message) => {
      const errorEl = document.getElementById('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    };

    // Connect wallet flow
    document.getElementById('connect-btn').addEventListener('click', async () => {
      const btn = document.getElementById('connect-btn');
      btn.disabled = true;
      
      try {
        provider = getProvider();
        
        if (!provider) {
          window.open('https://phantom.app/', '_blank');
          showError('Please install Phantom wallet extension and refresh this page');
          btn.disabled = false;
          return;
        }

        updateStatus('Connecting to Phantom...');
        
        // Connect to Phantom
        const resp = await provider.connect();
        const publicKey = resp.publicKey.toString();
        
        updateStatus('Getting authentication challenge...');
        
        // Get challenge from server
        const challengeResponse = await fetch(`${API_BASE}/api/auth/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            client_id: localStorage.getItem('client_id') || crypto.randomUUID()
          })
        });
        
        if (!challengeResponse.ok) {
          throw new Error('Failed to get challenge from server');
        }
        
        const { challenge } = await challengeResponse.json();
        
        // Construct message
        const message = `${challenge.domain} wants you to sign in with your Solana account:\n` +
                       `${publicKey}\n\n` +
                       `Nonce: ${challenge.nonce}\n` +
                       `Issued At: ${challenge.timestamp}\n` +
                       `Chain ID: mainnet-beta`;
        
        updateStatus('Please approve the signature request in Phantom...');
        
        // Request signature
        const encodedMessage = new TextEncoder().encode(message);
        const signedMessage = await provider.signMessage(encodedMessage, "utf8");
        
        updateStatus('Authentication successful! Closing window...');
        
        // Send result back to main window
        const authResult = {
          signature: btoa(String.fromCharCode(...signedMessage.signature)),
          publicKey: publicKey,
          message: message,
          nonce: challenge.nonce
        };
        
        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'wallet-auth-complete',
            data: authResult
          }, '*');
        }
        
        // Emit event for Tauri
        window.dispatchEvent(new CustomEvent('wallet-auth-complete', {
          detail: authResult
        }));
        
        // Close window after short delay
        setTimeout(() => {
          window.close();
        }, 1500);
        
      } catch (error) {
        console.error('Auth error:', error);
        showError(error.message || 'Authentication failed');
        btn.disabled = false;
        updateStatus('');
      }
    });

    // Check for Phantom on load
    window.addEventListener('load', () => {
      provider = getProvider();
      if (!provider) {
        updateStatus('Phantom wallet not detected');
      }
    });
  </script>
</body>
</html>
```

#### Vue Component (`src/components/WalletAuth.vue`)
```vue
<template>
  <div class="wallet-auth">
    <div v-if="!authStore.isAuthenticated" class="auth-container">
      <h2>Connect Your Wallet</h2>
      <p>Sign in securely using your Phantom wallet</p>
      
      <button 
        @click="connectWallet" 
        :disabled="authStore.loading"
        class="connect-btn"
      >
        <span v-if="authStore.loading">Connecting...</span>
        <span v-else>Connect Phantom Wallet</span>
      </button>
      
      <div v-if="authStore.error" class="error">
        {{ authStore.error }}
      </div>
    </div>
    
    <div v-else class="connected">
      <h3>Connected</h3>
      <p class="address">{{ formatAddress(authStore.walletAddress) }}</p>
      <button @click="disconnect" class="disconnect-btn">
        Disconnect
      </button>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { onMounted } from 'vue'

const authStore = useAuthStore()

const connectWallet = async () => {
  const result = await authStore.authenticateWithWallet()
  if (result.success) {
    // Handle successful auth (e.g., redirect)
    console.log('Authentication successful!')
  }
}

const disconnect = () => {
  authStore.logout()
}

const formatAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

onMounted(() => {
  // Check if already authenticated
  authStore.checkAuth()
})
</script>

<style scoped>
.wallet-auth {
  max-width: 400px;
  margin: 2rem auto;
}

.auth-container {
  text-align: center;
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 12px;
}

.connect-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 1rem;
}

.connect-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.connected {
  text-align: center;
  padding: 2rem;
  background: #f0f9ff;
  border-radius: 12px;
  border: 2px solid #3b82f6;
}

.address {
  font-family: monospace;
  font-size: 1.1rem;
  color: #3b82f6;
  margin: 1rem 0;
}

.disconnect-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.disconnect-btn:hover {
  background: #dc2626;
}

.error {
  color: #ef4444;
  background: #fee;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 1rem;
  font-size: 0.9rem;
}
</style>
```

### 4. API Request Interceptor

#### Axios Configuration (`src/services/api.js`)
```javascript
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore()
    
    if (error.response?.status === 401) {
      // Token expired or invalid
      authStore.logout()
      // Optionally redirect to login
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

export default api
```

## Security Considerations

### 1. Environment Configuration
```elixir
# config/config.exs
config :app,
  domain: System.get_env("APP_DOMAIN") || "localhost",
  jwt_secret: System.get_env("JWT_SECRET") || raise("JWT_SECRET not set")

# config/prod.exs
config :app, AppWeb.Endpoint,
  url: [host: System.get_env("APP_HOST"), port: 443],
  https: [
    port: 443,
    cipher_suite: :strong,
    keyfile: System.get_env("SSL_KEY_PATH"),
    certfile: System.get_env("SSL_CERT_PATH")
  ]
```

### 2. Rate Limiting
```elixir
# Add to router pipeline
plug Hammer.Plug, [
  rate_limit: {"auth:challenge", 60_000, 10},  # 10 requests per minute
  by: :ip
]
```

### 3. CORS Configuration
```elixir
# Strict CORS for production
plug CORSPlug,
  origin: ["https://your-app.com", "tauri://localhost"],
  methods: ["GET", "POST"],
  headers: ["Authorization", "Content-Type"]
```

### 4. Additional Security Headers
```elixir
plug :put_secure_browser_headers, %{
  "x-frame-options" => "DENY",
  "x-content-type-options" => "nosniff",
  "x-xss-protection" => "1; mode=block",
  "strict-transport-security" => "max-age=31536000; includeSubDomains"
}
```

## Testing

### Phoenix Tests (`test/app_web/controllers/auth_controller_test.exs`)
```elixir
defmodule AppWeb.AuthControllerTest do
  use AppWeb.ConnCase
  
  describe "request_challenge/2" do
    test "returns valid challenge", %{conn: conn} do
      conn = post(conn, "/api/auth/challenge", %{client_id: "test-client"})
      
      assert %{
        "success" => true,
        "challenge" => %{
          "nonce" => nonce,
          "timestamp" => _,
          "domain" => _
        }
      } = json_response(conn, 200)
      
      assert String.length(nonce) > 0
    end
  end
  
  describe "verify_signature/2" do
    test "accepts valid signature", %{conn: conn} do
      # Mock wallet signature
      # In real tests, use actual ed25519 signing
      
      # First get challenge
      conn = post(conn, "/api/auth/challenge", %{client_id: "test"})
      %{"challenge" => challenge} = json_response(conn, 200)
      
      # Create signed message (would be done by wallet in reality)
      message = """
      localhost wants you to sign in with your Solana account:
      #{test_public_key()}
      
      Nonce: #{challenge["nonce"]}
      Issued At: #{challenge["timestamp"]}
      Chain ID: mainnet-beta
      """
      
      # Verify signature
      conn = post(conn, "/api/auth/verify", %{
        signature: test_signature(message),
        public_key: test_public_key(),
        message: message,
        nonce: challenge["nonce"]
      })
      
      assert %{
        "success" => true,
        "token" => token,
        "wallet_address" => _
      } = json_response(conn, 200)
      
      assert String.length(token) > 0
    end
  end
end
```

## Deployment Checklist

- [ ] Set secure JWT_SECRET environment variable
- [ ] Configure HTTPS/TLS certificates
- [ ] Set production CORS origins
- [ ] Enable rate limiting
- [ ] Configure CSP headers
- [ ] Set up monitoring/logging
- [ ] Test wallet connection flow end-to-end
- [ ] Implement token refresh mechanism
- [ ] Add wallet address allowlist (if needed)
- [ ] Set up proper session management
- [ ] Configure proper error handling
- [ ] Test on multiple wallet versions

## Troubleshooting

### Common Issues

1. **Phantom not detected in webview**
   - Ensure webview has proper user agent
   - Check CSP allows wallet injection
   - Verify HTTPS in production

2. **Signature verification fails**
   - Check message format matches exactly
   - Verify base58 encoding/decoding
   - Ensure proper byte array handling

3. **CORS errors**
   - Add `tauri://localhost` to allowed origins
   - Check preflight request handling
   - Verify headers configuration

4. **Challenge expiration**
   - Adjust TTL if needed
   - Implement proper cleanup
   - Add retry mechanism

## Additional Resources

- [Phantom Docs](https://docs.phantom.app/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tauri Window API](https://tauri.app/v1/api/js/window/)
- [Phoenix Authentication](https://hexdocs.pm/phoenix/authentication.html)
- [Ed25519 in Elixir](https://hexdocs.pm/ed25519/readme.html)