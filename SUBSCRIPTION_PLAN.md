Complete Implementation Plan: Subscription & Free Trial System
Architecture Summary
Subscription Model:
- Price: $20/month (30 days)
- Includes: Access to non-AI features (video editor, export, all basic app functionality)
- Credits Required Separately: AI features (clip detection, transcription) require credits
- Trial: 7 days free, NO credits, can use non-AI features only
Credit Model (unchanged pricing):
- Credit packs provide AI processing hours
- Credits can be purchased anytime (even during trial or without subscription)
- Credits are consumed by AI features only
Access Logic:
Admins: Full access (unlimited credits, no subscription needed)
Regular Users:
- Video editor / Export: Requires active subscription OR trial
- AI features (detect clips, transcribe): Requires credits (independent of subscription)
Combinations:
- Trial only: Video editor ✓, AI features ✗
- Subscription only: Video editor ✓, AI features ✗
- Credits only (no subscription): Video editor ?, AI features ✓
- Subscription + Credits: Full access ✓
---
Phase 1: Database Schema
Migration 1: Add subscription fields to users table
File: server/priv/repo/migrations/YYYYMMDDHHMMSS_add_subscription_fields_to_users.exs
defmodule ClippsterServer.Repo.Migrations.AddSubscriptionFieldsToUsers do
  use Ecto.Migration
  def change do
    alter table(:users) do
      # Subscription status
      add :subscription_status, :string, default: "none" # none, trial, active, expired, cancelled
      add :trial_start_date, :utc_datetime
      add :trial_end_date, :utc_datetime
      add :subscription_start_date, :utc_datetime
      add :subscription_end_date, :utc_datetime
      
      # Subscription hours (separate from personal credits)
      add :subscription_hours_remaining, :decimal, precision: 10, scale: 2, default: 0
      add :subscription_hours_used, :decimal, precision: 10, scale: 2, default: 0
      
      # Subscription management
      add :subscription_renewal_method, :string # stripe, crypto_manual, null
      add :subscription_stripe_id, :string
    end
    
    create index(:users, [:subscription_status])
    create index(:users, [:trial_end_date])
    create index(:users, [:subscription_end_date])
  end
end
Migration 2: Create subscriptions history table
File: server/priv/repo/migrations/YYYYMMDDHHMMSS_create_subscriptions.exs
defmodule ClippsterServer.Repo.Migrations.CreateSubscriptions do
  use Ecto.Migration
  def change do
    create table(:subscriptions) do
      add :user_id, references(:users, on_delete: :delete), null: false
      add :status, :string, null: false # active, expired, cancelled
      add :start_date, :utc_datetime, null: false
      add :end_date, :utc_datetime, null: false
      add :hours_included, :decimal, precision: 10, scale: 2, default: "15.00"
      add :payment_method, :string, null: false # stripe, crypto_manual
      add :stripe_subscription_id, :string
      add :amount_usd, :decimal, precision: 10, scale: 2, default: "20.00"
      
      timestamps(type: :utc_datetime)
    end
    
    create index(:subscriptions, [:user_id])
    create index(:subscriptions, [:stripe_subscription_id])
    create index(:subscriptions, [:status])
  end
end
Migration 3: Remove automatic 1 free hour
File: server/priv/repo/migrations/YYYYMMDDHHMMSS_remove_auto_free_credit.exs
defmodule ClippsterServer.Repo.Migrations.RemoveAutoFreeCredit do
  use Ecto.Migration
  def change do
    # This migration removes the automatic 1 credit grant on user creation
    # The actual removal will be done by updating the Accounts.create_user/1 function
  end
end
---
Phase 2: Backend - Subscription Context
New File: server/lib/clippster_server/subscriptions.ex
defmodule ClippsterServer.Subscriptions do
  @moduledoc """
  Subscription management context.
  Handles trials, subscriptions, and crypto payments.
  """
  
  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Subscriptions.Subscription
  
  # Trial duration: 7 days
  @trial_days 7
  
  # Subscription duration: 30 days
  @subscription_days 30
  
  # Hours included in subscription (for potential future use)
  @subscription_hours 0
  
  # Subscription price
  @subscription_usd Decimal.new("20.00")
  
  @doc """
  Starts a 7-day free trial for a user.
  Requires user to have email_verified = true.
  """
  def start_trial(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      
      # Verify user has verified email
      unless user.email_verified do
        Repo.rollback(:email_not_verified)
      end
      
      # Check user isn't already on trial or subscription
      if user.subscription_status in ["trial", "active"] do
        Repo.rollback(:already_subscribed)
      end
      
      trial_start = DateTime.utc_now()
      trial_end = DateTime.add(trial_start, @trial_days, :day)
      
      user
      |> User.subscription_changeset(%{
        subscription_status: "trial",
        trial_start_date: trial_start,
        trial_end_date: trial_end,
        subscription_end_date: nil
      })
      |> Repo.update!()
      
      # Create subscription record
      %Subscription{
        user_id: user_id,
        status: "active",
        start_date: trial_start,
        end_date: trial_end,
        hours_included: Decimal.new("0"),
        payment_method: "trial",
        amount_usd: Decimal.new("0")
      }
      |> Repo.insert!()
      
      user
    end)
  end
  
  @doc """
  Creates a Stripe subscription for a user.
  """
  def create_stripe_subscription(user_id, stripe_subscription_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      
      start_date = DateTime.utc_now()
      end_date = DateTime.add(start_date, @subscription_days, :day)
      
      user
      |> User.subscription_changeset(%{
        subscription_status: "active",
        subscription_start_date: start_date,
        subscription_end_date: end_date,
        subscription_renewal_method: "stripe",
        subscription_stripe_id: stripe_subscription_id
      })
      |> Repo.update!()
      
      # Create subscription record
      %Subscription{
        user_id: user_id,
        status: "active",
        start_date: start_date,
        end_date: end_date,
        hours_included: Decimal.new("0"),
        payment_method: "stripe",
        stripe_subscription_id: stripe_subscription_id,
        amount_usd: @subscription_usd
      }
      |> Repo.insert!()
      
      user
    end)
  end
  
  @doc """
  Creates a crypto-based subscription (manual monthly payment).
  Uses quote system for price accuracy.
  """
  def create_crypto_subscription(user_id, tx_signature) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      
      start_date = DateTime.utc_now()
      end_date = DateTime.add(start_date, @subscription_days, :day)
      
      user
      |> User.subscription_changeset(%{
        subscription_status: "active",
        subscription_start_date: start_date,
        subscription_end_date: end_date,
        subscription_renewal_method: "crypto_manual"
      })
      |> Repo.update!()
      
      # Create subscription record
      %Subscription{
        user_id: user_id,
        status: "active",
        start_date: start_date,
        end_date: end_date,
        hours_included: Decimal.new("0"),
        payment_method: "crypto_manual",
        amount_usd: @subscription_usd
      }
      |> Repo.insert!()
      
      user
    end)
  end
  
  @doc """
  Cancels an active subscription.
  Access continues until end_date.
  """
  def cancel_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      
      # Update user status to cancelled
      user
      |> User.subscription_changeset(%{
        subscription_status: "cancelled"
      })
      |> Repo.update!()
      
      # Update active subscription record
      Subscription
      |> where([s], s.user_id == ^user_id)
      |> where([s], s.status == "active")
      |> order_by([s], desc: s.end_date)
      |> limit(1)
      |> Repo.one!()
      |> Subscription.status_changeset("cancelled")
      |> Repo.update!()
      
      user
    end)
  end
  
  @doc """
  Renews a subscription (called by Stripe webhook or manual crypto payment).
  Extends end_date by 30 days.
  """
  def renew_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      
      # Calculate new end date
      current_end = user.subscription_end_date || DateTime.utc_now()
      new_end = 
        cond do
          DateTime.compare(DateTime.utc_now(), current_end) == :gt ->
            # Subscription expired, start fresh
            DateTime.add(DateTime.utc_now(), @subscription_days, :day)
          true ->
            # Extend existing
            DateTime.add(current_end, @subscription_days, :day)
        end
      
      # Update subscription end date
      user
      |> User.subscription_changeset(%{
        subscription_status: "active",
        subscription_end_date: new_end
      })
      |> Repo.update!()
      
      # Create new subscription history record
      %Subscription{
        user_id: user_id,
        status: "active",
        start_date: user.subscription_end_date || DateTime.utc_now(),
        end_date: new_end,
        hours_included: Decimal.new("0"),
        payment_method: user.subscription_renewal_method,
        stripe_subscription_id: user.subscription_stripe_id,
        amount_usd: @subscription_usd
      }
      |> Repo.insert!()
      
      user
    end)
  end
  
  @doc """
  Gets subscription status for a user.
  Also checks for expired subscriptions and updates status.
  """
  def get_subscription_status(user_id) do
    user = Repo.get!(User, user_id)
    
    # Check if subscription has expired
    if user.subscription_status in ["active", "cancelled"] and 
       user.subscription_end_date do
      if DateTime.compare(DateTime.utc_now(), user.subscription_end_date) == :gt do
        # Subscription expired
        user
        |> User.subscription_changeset(%{subscription_status: "expired"})
        |> Repo.update!()
        
        # Update subscription history
        Subscription
        |> where([s], s.user_id == ^user_id)
        |> where([s], s.status == "active")
        |> Repo.update_all(set: [status: "expired"])
        
        %{status: "expired", user: user}
      else
        # Still active
        %{status: user.subscription_status, user: user}
      end
    else
      %{status: user.subscription_status, user: user}
    end
  end
  
  @doc """
  Checks if user has access to non-AI features (video editor).
  Admins: Always have access
  Regular users: Need active subscription or trial
  """
  def has_subscription_access?(user_id) do
    user = Repo.get!(User, user_id)
    
    cond do
      user.is_admin -> true
      user.subscription_status in ["active", "trial"] -> true
      true -> false
    end
  end
  
  @doc """
  Checks if user is on trial and trial is active.
  """
  def on_active_trial?(user_id) do
    user = Repo.get!(User, user_id)
    
    user.subscription_status == "trial" and
      user.trial_end_date and
      DateTime.compare(DateTime.utc_now(), user.trial_end_date) == :lt
  end
end
New File: server/lib/clippster_server/subscriptions/subscription.ex
defmodule ClippsterServer.Subscriptions.Subscription do
  use Ecto.Schema
  import Ecto.Changeset
  schema "subscriptions" do
    field :status, :string
    field :start_date, :utc_datetime
    field :end_date, :utc_datetime
    field :hours_included, :decimal
    field :payment_method, :string
    field :stripe_subscription_id, :string
    field :amount_usd, :decimal
    belongs_to :user, ClippsterServer.Accounts.User
    timestamps(type: :utc_datetime)
  end
  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [
      :user_id,
      :status,
      :start_date,
      :end_date,
      :hours_included,
      :payment_method,
      :stripe_subscription_id,
      :amount_usd
    ])
    |> validate_required([
      :user_id,
      :status,
      :start_date,
      :end_date,
      :payment_method
    ])
  end
  def status_changeset(subscription, status) do
    subscription
    |> change()
    |> put_change(:status, status)
  end
end
Update: server/lib/clippster_server/accounts/user.ex
Add subscription fields and changeset:
# In schema:
field :subscription_status, :string, default: "none"
field :trial_start_date, :utc_datetime
field :trial_end_date, :utc_datetime
field :subscription_start_date, :utc_datetime
field :subscription_end_date, :utc_datetime
field :subscription_hours_remaining, :decimal, precision: 10, scale: 2, default: 0
field :subscription_hours_used, :decimal, precision: 10, scale: 2, default: 0
field :subscription_renewal_method, :string
field :subscription_stripe_id, :string
# New changeset:
def subscription_changeset(user, attrs) do
  user
  |> cast(attrs, [
    :subscription_status,
    :trial_start_date,
    :trial_end_date,
    :subscription_start_date,
    :subscription_end_date,
    :subscription_renewal_method,
    :subscription_stripe_id
  ])
  |> validate_inclusion(:subscription_status, ["none", "trial", "active", "expired", "cancelled"])
end
Update: server/lib/clippster_server/accounts.ex
Remove automatic 1 free hour from user creation:
def create_user(wallet_address) do
  is_first_user = Repo.aggregate(User, :count) == 0
  # Create user WITHOUT adding free credit
  {:ok, user} = %User{}
    |> User.changeset(%{
      wallet_address: wallet_address,
      is_admin: is_first_user
    })
    |> Repo.insert()
end
# Also update create_oauth_user to remove free credit:
defp create_oauth_user(provider, provider_id, oauth_info) do
  is_first_user = Repo.aggregate(User, :count) == 0
  user_attrs = %{
    provider: provider,
    provider_id: provider_id,
    email: Map.get(oauth_info, :email),
    name: Map.get(oauth_info, :name),
    avatar_url: Map.get(oauth_info, :avatar_url),
    is_admin: is_first_user
  }
  {:ok, user} = %User{}
    |> User.oauth_changeset(user_attrs)
    |> Repo.insert()
  
  # No automatic free credit
  {:ok, user}
end
# Also update do_register_with_email to remove free credit:
defp do_register_with_email(email, password) do
  # ... existing code to create user ...
  
  # REMOVE: Credits.add_credits(user.id, 1)
  
  {:ok, user}
end
---
Phase 3: Backend - Controllers
Update: server/lib/clippster_server_web/controllers/auth_controller.ex
Auto-start trial on email verification:
# In verify_signature/1 - after user creation:
{:ok, user} = Accounts.get_or_create_user(public_key)
# Auto-start trial if user has verified email and no subscription
if user.email_verified and user.subscription_status == "none" do
  Subscriptions.start_trial(user.id)
end
# In google_callback/1 - after user creation:
{:ok, user} = Accounts.get_or_create_oauth_user("google", google_user["id"], oauth_info)
# Auto-start trial (email already verified from Google)
if user.subscription_status == "none" do
  Subscriptions.start_trial(user.id)
end
New File: server/lib/clippster_server_web/controllers/subscription_controller.ex
defmodule ClippsterServerWeb.SubscriptionController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.Accounts
  def create_checkout_session(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         user <- Accounts.get_user(user_id) do
      
      # Create Stripe checkout session for subscription
      # TODO: Implement Stripe subscription checkout
      json(conn, %{
        success: true,
        message: "Stripe subscription checkout not yet implemented"
      })
    end
  end
  def get_status(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn) do
      status = Subscriptions.get_subscription_status(user_id)
      
      json(conn, %{
        success: true,
        subscription: %{
          status: status.status,
          trial_end: status.user.trial_end_date,
          subscription_end: status.user.subscription_end_date,
          renewal_method: status.user.subscription_renewal_method
        }
      })
    end
  end
  def cancel(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn) do
      case Subscriptions.cancel_subscription(user_id) do
        {:ok, _user} ->
          json(conn, %{
            success: true,
            message: "Subscription cancelled. Access continues until end date."
          })
        
        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    end
  end
  def generate_crypto_quote(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      sol_amount = Decimal.to_float(Decimal.div(@subscription_usd, sol_usd_rate))
      company_wallet = ClippsterServer.Credits.get_company_wallet_address()
      
      # Generate quote with 5-minute expiry
      quote = %{
        usd_amount: "20.00",
        sol_amount: Float.round(sol_amount, 4),
        company_wallet: company_wallet,
        user_id: user_id,
        created_at: DateTime.utc_now() |> DateTime.to_unix(),
        expires_at: DateTime.add(DateTime.utc_now(), 5, :minute) |> DateTime.to_unix()
      }
      # Store quote temporarily (using existing quote storage)
      # Use existing payment quote mechanism
      json(conn, %{
        success: true,
        quote: quote
      })
    end
  end
  def confirm_crypto_payment(conn, %{
    "tx_signature" => tx_signature,
    "from_address" => from_address,
    "quote_data" => quote_data
  }) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- Accounts.get_user(user_id),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      # Calculate expected SOL amount
      sol_amount = Decimal.to_float(Decimal.div(@subscription_usd, sol_usd_rate))
      
      # Verify transaction on-chain (same as credit pack payment)
      company_wallet = ClippsterServer.Credits.get_company_wallet_address()
      rpc_url = ClippsterServer.Credits.get_solana_rpc_url()
      
      case verify_crypto_payment(tx_signature, from_address, company_wallet, sol_amount, rpc_url) do
        {:ok, _verified} ->
          # Create subscription
          {:ok, user} = Subscriptions.create_crypto_subscription(user_id, tx_signature)
          
          json(conn, %{
            success: true,
            message: "Subscription activated",
            subscription: %{
              status: "active",
              end_date: user.subscription_end_date
            }
          })
        
        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    end
  end
  defp verify_crypto_payment(tx_signature, from_address, to_address, expected_sol, rpc_url) do
    # Use existing payment_verify.js script
    alias ClippsterServer.JsScripts
    
    payload = Jason.encode!(%{
      tx_signature: tx_signature,
      from_address: from_address,
      to_address: to_address,
      expected_sol_amount: expected_sol,
      rpc_url: rpc_url
    })
    
    temp_file = Path.join(System.tmp_dir!(), "sub_verify_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)
    
    script_path = JsScripts.script_path("payment_verify.js")
    node_path = JsScripts.find_node_executable()
    
    case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
      {output, 0} ->
        case Jason.decode(output) do
          {:ok, %{"valid" => true}} -> {:ok, :verified}
          _ -> {:error, :invalid_transaction}
        end
      
      _ ->
        {:error, :verification_failed}
    end
  end
end
Add to: server/lib/clippster_server_web/router.ex
scope "/api/subscription", SubscriptionController do
  post "/create-checkout", :create_checkout_session
  get "/status", :get_status
  post "/cancel", :cancel
  post "/crypto-quote", :generate_crypto_quote
  post "/crypto-confirm", :confirm_crypto_payment
end
Update: server/lib/clippster_server_web/controllers/payment_controller.ex
Update get_balance/1 to include subscription status:
def get_balance(conn, _params) do
  alias ClippsterServer.Subscriptions
  
  with {:ok, user_id} <- get_user_id_from_token(conn),
       {:ok, claims} <- get_token_claims(conn) do
    
    if claims["is_admin"] do
      json(conn, %{
        success: true,
        balance: %{hours_remaining: :unlimited, hours_used: 0},
        subscription: %{status: "active"},
        total_available: :unlimited
      })
    else
      # Get personal balance
      {:ok, personal_balance} = Credits.get_user_balance(user_id)
      
      # Get subscription status
      subscription_status = Subscriptions.get_subscription_status(user_id)
      
      # Get organization allocations
      org_allocations = get_organization_allocations(user_id)
      
      # Calculate total
      org_total = Enum.reduce(org_allocations, 0.0, fn alloc, acc ->
        acc + alloc.hours_remaining
      end)
      total_available = Decimal.to_float(personal_balance.hours_remaining) + org_total
      
      json(conn, %{
        success: true,
        balance: %{
          hours_remaining: Decimal.to_float(personal_balance.hours_remaining),
          hours_used: Decimal.to_float(personal_balance.hours_used)
        },
        subscription: %{
          status: subscription_status.status,
          trial_end: subscription_status.user.trial_end_date,
          subscription_end: subscription_status.user.subscription_end_date,
          has_access: Subscriptions.has_subscription_access?(user_id)
        },
        organization_allocations: org_allocations,
        total_available: total_available
      })
    end
  end
end
Update: server/lib/clippster_server_web/controllers/stripe_controller.ex
Add subscription webhook handlers:
# In handle_webhook/1, add new case:
def handle_webhook(conn, %{"type" => "customer.subscription.created"} = event) do
  data = event["data"]["object"]
  stripe_subscription_id = data["id"]
  
  # Find user by customer ID or use metadata
  # Extract user_id from subscription metadata
  user_id = get_user_id_from_stripe_metadata(data)
  
  if user_id do
    Subscriptions.create_stripe_subscription(user_id, stripe_subscription_id)
  end
  
  json(conn, %{success: true})
end
def handle_webhook(conn, %{"type" => "invoice.payment_succeeded"} = event) do
  invoice = event["data"]["object"]
  subscription_id = invoice["subscription"]
  
  # Find user by subscription ID
  case Repo.get_by(ClippsterServer.Accounts.User, subscription_stripe_id: subscription_id) do
    nil -> :no_user
    user -> Subscriptions.renew_subscription(user.id)
  end
  
  json(conn, %{success: true})
end
def handle_webhook(conn, %{"type" => "invoice.payment_failed"} = event) do
  invoice = event["data"]["object"]
  subscription_id = invoice["subscription"]
  
  # Immediately cancel subscription (no grace period)
  case Repo.get_by(ClippsterServer.Accounts.User, subscription_stripe_id: subscription_id) do
    nil -> :no_user
    user -> Subscriptions.cancel_subscription(user.id)
  end
  
  json(conn, %{success: true})
end
def handle_webhook(conn, %{"type" => "customer.subscription.deleted"} = event) do
  data = event["data"]["object"]
  stripe_subscription_id = data["id"]
  
  case Repo.get_by(ClippsterServer.Accounts.User, subscription_stripe_id: stripe_subscription_id) do
    nil -> :no_user
    user -> Subscriptions.cancel_subscription(user.id)
  end
  
  json(conn, %{success: true})
end
defp get_user_id_from_stripe_metadata(subscription_data) do
  # Extract user_id from subscription metadata
  # Requires client to pass user_id when creating subscription
  subscription_data["metadata"]["user_id"]
end
Update: server/lib/clippster_server_web/controllers/email_auth_controller.ex
Add endpoint to connect email to wallet user:
def connect_wallet_email(conn, %{"email" => email}) do
  with {:ok, user_id} <- get_user_id_from_token(conn),
       user <- Accounts.get_user(user_id) do
    
    # Check user is wallet-only (no email set)
    if user.email do
      conn
      |> put_status(400)
      |> json(%{success: false, error: "Email already connected"})
    else
      # Check if email is already in use
      case Accounts.get_user_by_email(email) do
        nil ->
          # Send verification email to connect to wallet user
          otp_code = generate_otp()
          hashed_otp = hash_token(otp_code)
          
          # Store pending connection in user (temporary)
          user
          |> User.pending_email_changeset(%{
            pending_email: email,
            email_verification_otp: hashed_otp,
            email_verification_sent_at: DateTime.utc_now() |> DateTime.truncate(:second),
            email_verification_attempts: 0
          })
          |> Repo.update()
          
          # Send verification email
          email
          |> Emails.wallet_email_connection_email(otp_code)
          |> Mailer.deliver()
          
          json(conn, %{
            success: true,
            message: "Verification code sent to email"
          })
        
        existing_user ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Email already registered"})
      end
    end
  end
end
def verify_wallet_email(conn, %{"email" => email, "otp" => otp}) do
  with {:ok, user_id} <- get_user_id_from_token(conn),
       user <- Accounts.get_user(user_id) do
    
    cond do
      user.email ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Email already connected"})
      
      user.pending_email != email ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Email mismatch"})
      
      verify_token(otp, user.email_verification_otp) ->
        # Connect email and start trial
        Repo.transaction(fn ->
          user
          |> User.connect_email_changeset(%{
            email: email,
            email_verified: true,
            pending_email: nil
          })
          |> Repo.update()
          
          # Start trial
          Subscriptions.start_trial(user.id)
        end)
        
        json(conn, %{
          success: true,
          message: "Email connected and trial started"
        })
      
      true ->
        # Invalid OTP
        user
        |> User.increment_verification_attempts_changeset()
        |> Repo.update()
        
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid verification code"})
    end
  end
end
Add to: server/lib/clippster_server_web/router.ex
scope "/api/auth", EmailAuthController do
  # ... existing routes ...
  post "/wallet/connect-email", :connect_wallet_email
  post "/wallet/verify-email", :verify_wallet_email
end
---
Phase 4: Frontend - Subscription UI
New File: client/src/composables/useSubscription.ts
import { ref, computed } from 'vue';
import api from '@/services/api';
export interface SubscriptionStatus {
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  trialEnd?: string;
  subscriptionEnd?: string;
  renewalMethod?: 'stripe' | 'crypto_manual';
  hasAccess: boolean;
}
export function useSubscription() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const subscription = ref<SubscriptionStatus | null>(null);
  const onTrial = computed(() => subscription.value?.status === 'trial');
  const hasActiveSubscription = computed(() => subscription.value?.status === 'active');
  const hasSubscriptionAccess = computed(() => subscription.value?.hasAccess);
  const daysRemaining = computed(() => {
    if (!subscription.value?.subscriptionEnd) return 0;
    const end = new Date(subscription.value.subscriptionEnd);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });
  async function fetchStatus(): Promise<SubscriptionStatus | null> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/subscription/status');
      if (response.data.success) {
        subscription.value = response.data.subscription;
        return subscription.value;
      }
      throw new Error(response.data.error || 'Failed to fetch subscription status');
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to fetch subscription status:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }
  async function startStripeSubscription(): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      const response = await api.post('/subscription/create-checkout');
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }
      // Open Stripe checkout
      await invoke('open_stripe_subscription_window', {
        checkoutUrl: response.data.url
      });
      return true;
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to start subscription:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }
  async function startCryptoSubscription(): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      // Get crypto quote
      const quoteResponse = await api.post('/subscription/crypto-quote');
      if (!quoteResponse.data.success) {
        throw new Error(quoteResponse.data.error || 'Failed to get quote');
      }
      const quote = quoteResponse.data.quote;
      // Open crypto payment window
      await invoke('open_crypto_subscription_window', {
        usd: quote.usd_amount,
        sol: quote.sol_amount,
        companyWallet: quote.company_wallet,
        quoteData: quote
      });
      // Listen for payment completion
      const unlisten = await listen('crypto-subscription-complete', async (event: any) => {
        try {
          const confirmResponse = await api.post('/subscription/crypto-confirm', {
            tx_signature: event.payload.signature,
            from_address: event.payload.from_address,
            quote_data: quote
          });
          if (confirmResponse.data.success) {
            await fetchStatus();
            unlisten();
          }
        } catch (err: any) {
          error.value = err.message;
          unlisten();
        }
      });
      return true;
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to start crypto subscription:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }
  async function cancelSubscription(): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/subscription/cancel');
      if (response.data.success) {
        await fetchStatus();
        return true;
      }
      throw new Error(response.data.error || 'Failed to cancel subscription');
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to cancel subscription:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }
  return {
    loading,
    error,
    subscription,
    onTrial,
    hasActiveSubscription,
    hasSubscriptionAccess,
    daysRemaining,
    fetchStatus,
    startStripeSubscription,
    startCryptoSubscription,
    cancelSubscription
  };
}
New File: client/src/pages/Subscription.vue
<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Subscription Status Card -->
    <div v-if="!subscriptionLoading && subscription" class="bg-card rounded-lg border p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold">Subscription Status</h2>
        <div :class="statusBadgeClass" class="px-3 py-1 rounded-full text-sm font-semibold">
          {{ statusText }}
        </div>
      </div>
      <!-- Trial Countdown -->
      <div v-if="onTrial" class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
        <div class="flex items-center gap-3">
          <Clock class="h-5 w-5 text-yellow-500" />
          <div>
            <p class="font-semibold text-yellow-600">Free Trial Active</p>
            <p class="text-sm text-yellow-600/80">
              {{ daysRemaining }} day{{ daysRemaining !== 1 ? 's' : '' }} remaining
            </p>
          </div>
        </div>
      </div>
      <!-- Subscription Details -->
      <div v-if="hasActiveSubscription" class="space-y-3">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Next billing date:</span>
          <span class="font-semibold">{{ formatDate(subscription.subscriptionEnd) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Payment method:</span>
          <span class="font-semibold capitalize">{{ subscription.renewalMethod }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Monthly cost:</span>
          <span class="font-semibold">$20.00</span>
        </div>
      </div>
      <!-- Expired/Canceled -->
      <div v-if="subscription.status === 'expired'" class="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p class="text-red-600">Your subscription has expired. Subscribe to continue using Clippster.</p>
      </div>
      <div v-if="subscription.status === 'cancelled'" class="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
        <p class="text-orange-600">
          Subscription cancelled. Access continues until {{ formatDate(subscription.subscriptionEnd) }}.
        </p>
      </div>
      <!-- Action Buttons -->
      <div class="flex gap-3 mt-6">
        <button
          v-if="!hasActiveSubscription && subscription.status !== 'cancelled'"
          @click="showSubscribeModal = true"
          class="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold"
        >
          Subscribe Now - $20/mo
        </button>
        <button
          v-if="hasActiveSubscription"
          @click="handleCancel"
          class="flex-1 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg font-semibold"
          :disabled="subscriptionLoading"
        >
          {{ subscriptionLoading ? 'Cancelling...' : 'Cancel Subscription' }}
        </button>
      </div>
    </div>
    <!-- What's Included -->
    <div class="bg-card rounded-lg border p-6 mb-6">
      <h3 class="text-xl font-bold mb-4">What's Included</h3>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="flex items-start gap-3">
          <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-semibold">Video Editor Access</p>
            <p class="text-sm text-muted-foreground">Full timeline editor with all editing tools</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-semibold">Export Videos</p>
            <p class="text-sm text-muted-foreground">Export in any resolution or format</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <X class="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-semibold">AI Features (Requires Credits)</p>
            <p class="text-sm text-muted-foreground">Clip detection, transcription require separate credit purchases</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-semibold">All Platform Features</p>
            <p class="text-sm text-muted-foreground">Organization, profiles, social media</p>
          </div>
        </div>
      </div>
    </div>
    <!-- Credit Purchase CTA -->
    <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
      <h3 class="text-lg font-bold text-blue-600 mb-2">Need AI Features?</h3>
      <p class="text-blue-600/80 mb-4">
        Purchase credit packs to unlock AI-powered clip detection and transcription.
      </p>
      <router-link to="/pricing" class="inline-flex items-center gap-2 text-blue-600 font-semibold hover:underline">
        View Credit Packs <ArrowRight class="h-4 w-4" />
      </router-link>
    </div>
    <!-- Subscribe Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSubscribeModal" class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-card rounded-lg border max-w-md w-full p-6">
            <h3 class="text-xl font-bold mb-4">Choose Payment Method</h3>
            
            <div class="space-y-3">
              <button
                @click="handleStripeSubscribe"
                class="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
                :disabled="subscriptionLoading"
              >
                <CreditCard class="h-6 w-6" />
                <div class="text-left">
                  <p class="font-semibold">Credit Card</p>
                  <p class="text-sm text-muted-foreground">$20/month automatic billing</p>
                </div>
              </button>
              <button
                @click="handleCryptoSubscribe"
                class="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
                :disabled="subscriptionLoading"
              >
                <Wallet class="h-6 w-6" />
                <div class="text-left">
                  <p class="font-semibold">Crypto (SOL)</p>
                  <p class="text-sm text-muted-foreground">Manual monthly payment via Phantom</p>
                </div>
              </button>
            </div>
            <button
              @click="showSubscribeModal = false"
              class="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Clock, Check, X, ArrowRight, CreditCard, Wallet } from 'lucide-vue-next';
import { useSubscription } from '@/composables/useSubscription';
import { useToast } from '@/composables/useToast';
const { subscription, subscriptionLoading, onTrial, hasActiveSubscription, daysRemaining, fetchStatus, startStripeSubscription, startCryptoSubscription, cancelSubscription } = useSubscription();
const { success, error: showError } = useToast();
const showSubscribeModal = ref(false);
const statusText = computed(() => {
  if (!subscription.value) return 'Loading...';
  switch (subscription.value.status) {
    case 'trial': return 'Free Trial';
    case 'active': return 'Active';
    case 'expired': return 'Expired';
    case 'cancelled': return 'Cancelled';
    default: return 'No Subscription';
  }
});
const statusBadgeClass = computed(() => {
  if (!subscription.value) return 'bg-gray-100 text-gray-800';
  switch (subscription.value.status) {
    case 'trial': return 'bg-yellow-100 text-yellow-800';
    case 'active': return 'bg-green-100 text-green-800';
    case 'expired': return 'bg-red-100 text-red-800';
    case 'cancelled': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
});
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
async function handleStripeSubscribe() {
  showSubscribeModal.value = false;
  const success = await startStripeSubscription();
  if (success) {
    success('Checkout opened', 'Complete payment in your browser');
  }
}
async function handleCryptoSubscribe() {
  showSubscribeModal.value = false;
  const success = await startCryptoSubscription();
  if (success) {
    success('Payment window opened', 'Complete payment in your wallet');
  }
}
async function handleCancel() {
  const confirmed = confirm('Are you sure you want to cancel? Access continues until your subscription end date.');
  if (!confirmed) return;
  const success = await cancelSubscription();
  if (success) {
    success('Subscription cancelled', 'You can continue using Clippster until your end date');
    await fetchStatus();
  }
}
onMounted(async () => {
  await fetchStatus();
});
</script>
Update: client/src/components/AuthModal.vue
Add wallet email connection flow:
<!-- Add new view: connect-email -->
<template v-else-if="currentView === 'connect-email'">
  <div class="space-y-4">
    <div class="text-center mb-2">
      <h3 class="text-lg font-semibold text-white">Connect Email</h3>
      <p class="text-xs text-zinc-400">Connect your email to start your 7-day free trial</p>
    </div>
    <form @submit.prevent="handleConnectEmail" class="space-y-3">
      <div>
        <input
          v-model="email"
          type="email"
          required
          placeholder="Email address"
          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
        />
      </div>
      <button
        type="submit"
        :disabled="authStore.loading"
        class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div class="px-4 py-2.5 flex items-center justify-center gap-2 relative">
          <Loader2 v-if="authStore.loading" class="h-4 w-4 animate-spin text-white" />
          <Mail v-else class="h-4 w-4 text-white" />
          <span class="text-sm font-semibold text-white">
            {{ authStore.loading ? 'Sending...' : 'Send Verification Code' }}
          </span>
        </div>
      </button>
    </form>
    <p class="text-center text-xs text-zinc-400">
      <button @click="currentView = 'signin'" class="text-zinc-500 hover:text-zinc-300">Cancel</button>
    </p>
  </div>
</template>
<script setup lang="ts">
// Add state:
const email = ref('');
// Add function:
const handleConnectEmail = async () => {
  successMessage.value = '';
  const result = await authStore.connectWalletEmail(email.value);
  if (result.success) {
    currentView.value = 'verify-otp';
  }
};
// In connectWallet function, check if user has email:
const connectWallet = async () => {
  authMethod.value = 'wallet';
  successMessage.value = '';
  const result = await authStore.authenticateWithWallet();
  if (result.success) {
    // Check if user has email connected
    if (!result.user.email) {
      currentView.value = 'connect-email';
    } else {
      close();
      redirectAfterLogin(result.user);
    }
  }
};
</script>
Update: client/src/stores/auth.ts
Add wallet email connection methods:
async connectWalletEmail(email: string): Promise<any> {
  this.loading = true;
  this.error = null;
  try {
    const response = await api.post('/auth/wallet/connect-email', { email });
    
    if (response.data.success) {
      this.pendingVerificationEmail = email;
      return { success: true };
    }
    
    throw new Error(response.data.error || 'Failed to send verification');
  } catch (err: any) {
    this.error = err.message;
    return { success: false, error: err.message };
  } finally {
    this.loading = false;
  }
}
async verifyWalletEmail(email: string, otp: string): Promise<any> {
  this.loading = true;
  this.error = null;
  try {
    const response = await api.post('/auth/wallet/verify-email', { email, otp });
    
    if (response.data.success) {
      this.user = response.data.user;
      return { success: true, user: response.data.user };
    }
    
    throw new Error(response.data.error || 'Verification failed');
  } catch (err: any) {
    this.error = err.message;
    return { success: false, error: err.message };
  } finally {
    this.loading = false;
  }
}
Update: client/src/composables/useAIPermission.ts
Check subscription access + credits:
export function useAIPermission() {
  const authStore = useAuthStore();
  const { subscription } = useSubscription();
  function checkAIAccess(): { allowed: boolean; reason?: string } {
    // Admins always have access
    if (authStore.user?.is_admin) {
      return { allowed: true };
    }
    // AI features require credits (subscription is for non-AI features)
    // Check if user has personal credits or org allocations
    const hasCredits = (balance.value.totalAvailable !== 0 && 
                       balance.value.totalAvailable !== 'unlimited');
    if (!hasCredits) {
      return { 
        allowed: false, 
        reason: 'AI features require credits. Purchase a credit pack.' 
      };
    }
    return { allowed: true };
  }
  // Check subscription access for non-AI features (video editor)
  function checkSubscriptionAccess(): boolean {
    if (authStore.user?.is_admin) return true;
    return subscription.value?.hasAccess ?? false;
  }
  return {
    checkAIAccess,
    checkSubscriptionAccess
  };
}
Update: client/src/composables/useCreditBalance.ts
Add subscription status to balance:
export interface CreditBalanceResponse {
  success: boolean;
  balance: {
    hours_remaining: number | 'unlimited';
    hours_used: number;
  };
  subscription?: {
    status: string;
    trialEnd?: string;
    subscriptionEnd?: string;
    hasAccess: boolean;
  };
  organization_allocations: OrganizationAllocation[];
  total_available: number | 'unlimited';
}
// In fetchBalance function:
async function fetchBalance(): Promise<CreditBalanceResponse | null> {
  // ... existing code ...
  if (response.data.success) {
    // Personal balance
    hoursRemaining.value = response.data.balance.hours_remaining === 'unlimited'
      ? 'unlimited'
      : response.data.balance.hours_remaining;
    hoursUsed.value = response.data.balance.hours_used || 0;
    isAdmin.value = hoursRemaining.value === 'unlimited';
    // Subscription status
    subscriptionStatus.value = response.data.subscription || null;
    // Organization allocations
    organizationAllocations.value = response.data.organization_allocations || [];
  }
  
  // ... rest of code ...
}
New Component: client/src/components/TrialBanner.vue
<template>
  <div v-if="showBanner" :class="bannerClass">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <Clock class="h-5 w-5" />
        <div>
          <p class="font-semibold">{{ title }}</p>
          <p class="text-sm opacity-90">{{ message }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <router-link 
          v-if="onTrial"
          to="/subscription" 
          class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
        >
          Subscribe Now
        </router-link>
        <button
          @click="$emit('dismiss')"
          class="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Clock, X } from 'lucide-vue-next';
import { useSubscription } from '@/composables/useSubscription';
import { useLocalStorage } from '@vueuse/core';
const { subscription, onTrial, daysRemaining } = useSubscription();
const dismissed = useLocalStorage('trial-banner-dismissed', false);
defineEmits<{
  dismiss: []
}>();
const showBanner = computed(() => {
  if (dismissed.value) return false;
  return onTrial.value || (subscription.value?.status === 'expired');
});
const bannerClass = computed(() => {
  if (subscription.value?.status === 'expired') {
    return 'bg-red-500 text-white p-4 rounded-lg mb-4';
  }
  return 'bg-yellow-500 text-white p-4 rounded-lg mb-4';
});
const title = computed(() => {
  if (subscription.value?.status === 'expired') {
    return 'Trial Expired';
  }
  return 'Free Trial Active';
});
const message = computed(() => {
  if (subscription.value?.status === 'expired') {
    return 'Subscribe to continue using Clippster';
  }
  return `${daysRemaining.value} day${daysRemaining.value !== 1 ? 's' : ''} remaining in your free trial`;
});
</script>
---
Phase 5: Stripe Configuration
Create Stripe Product and Price
# In Stripe Dashboard:
1. Create Product: "Clippster Monthly Subscription"
   - Description: "30 days access to Clippster video editor and platform features"
   - Type: Service
   
2. Create Price:
   - Amount: $20.00 USD
   - Interval: month
   - Billing: recurring
   
3. Copy Price ID to environment variable
Environment Variables
# Add to .env:
STRIPE_SUBSCRIPTION_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxx
Update Stripe Checkout Creation
In backend subscription controller, implement checkout session creation using Stripe SDK.
---
Phase 6: Edge Cases & Testing
Edge Cases to Handle:
1. Wallet user connects email → trial starts
   - Verify OTP first, then connect email and start trial
   - Ensure user doesn't already have subscription
2. Trial expires during active work
   - User warned in advance (2 days before)
   - After expiry, show prompt to subscribe
   - Allow saving work, but no new operations
3. Crypto subscription payment delayed
   - User can purchase credit packs to get AI access immediately
   - Subscription activation waits for payment
4. User has credits but no subscription
   - Can use AI features (detect clips, transcribe)
   - Cannot use video editor/export (requires subscription)
   - REQUIRES YOUR CLARIFICATION ON QUESTION 7
5. Organization members with subscription
   - Org subscription covers all members
   - Org admin purchases subscription
   - All members get subscription access automatically
6. Subscription payment fails (Stripe)
   - Immediately cancel subscription (no grace period)
   - Access ends at billing date
   - User must resubscribe
Testing Checklist:
- [ ] Wallet user signs up → prompted to connect email
- [ ] Email user signs up → trial starts automatically
- [ ] Google user signs up → trial starts automatically
- [ ] Trial user sees banner with countdown
- [ ] Trial user can use video editor
- [ ] Trial user cannot use AI features (no credits)
- [ ] Trial user purchases credits → can use AI features
- [ ] Trial expires → user prompted to subscribe
- [ ] Subscribe with Stripe → subscription activates
- [ ] Subscribe with Crypto → payment verified, subscription activates
- [ ] Crypto payment verification works (same as credit packs)
- [ ] Subscription renews automatically (Stripe)
- [ ] Subscription fails payment → immediately cancelled
- [ ] Cancel subscription → access until end date
- [ ] User with credits but no subscription → AI access, editor access?
- [ ] Organization subscription covers all members
- [ ] Admin users keep unlimited access, no subscription needed
---
Summary
This plan implements:
- ✅ 7-day free trial with email verification requirement
- ✅ $20/month subscription (Stripe and crypto)
- ✅ No credits during trial (separate from subscription)
- ✅ Credits can be purchased anytime for AI access
- ✅ Crypto subscriptions use quote system with auto-verification
- ✅ No grace period (immediate cancellation on failed payment)
- ✅ Removed automatic 1 free hour
- ✅ Admins keep unlimited access
- ✅ Organization subscription covers all members