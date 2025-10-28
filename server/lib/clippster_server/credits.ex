defmodule ClippsterServer.Credits do
  @moduledoc """
  The Credits context - manages user credit balances and transactions.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Credits.{CreditTransaction, UserCredit}

  @credit_packs %{
    "starter" => %{hours: 10, usd: 10.00},
    "creator" => %{hours: 30, usd: 27.00},
    "pro" => %{hours: 100, usd: 80.00}
  }

  @doc """
  Gets the pricing information for all credit packs
  """
  def get_credit_packs, do: @credit_packs

  @doc """
  Gets pricing info for a specific pack
  """
  def get_pack_info(pack_type) when is_binary(pack_type) do
    Map.get(@credit_packs, pack_type)
  end

  @doc """
  Gets the company wallet address for receiving payments
  Loads from PAYMENT_ADDRESS environment variable at runtime
  """
  def get_company_wallet_address do
    System.get_env("PAYMENT_ADDRESS") || raise "PAYMENT_ADDRESS not set in environment"
  end

  @doc """
  Gets the Solana RPC URL for client connections
  Defaults to public endpoint if not set (not recommended for production)
  """
  def get_solana_rpc_url do
    System.get_env("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com"
  end

  @doc """
  Gets or creates user credit record
  """
  def get_or_create_user_credits(user_id) do
    case Repo.get(UserCredit, user_id) do
      nil ->
        %UserCredit{user_id: user_id}
        |> UserCredit.changeset(%{})
        |> Repo.insert()

      user_credit ->
        {:ok, user_credit}
    end
  end

  @doc """
  Gets user's credit balance
  """
  def get_user_balance(user_id) do
    case Repo.get(UserCredit, user_id) do
      nil ->
        {:ok, %{hours_remaining: Decimal.new("0"), hours_used: Decimal.new("0")}}

      user_credit ->
        {:ok, %{
          hours_remaining: user_credit.hours_remaining,
          hours_used: user_credit.hours_used
        }}
    end
  end

  @doc """
  Creates a pending credit transaction
  """
  def create_pending_transaction(attrs) do
    CreditTransaction.pending_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Confirms a transaction and adds credits to user balance
  """
  def confirm_transaction(tx_signature) do
    Repo.transaction(fn ->
      transaction =
        CreditTransaction
        |> where([t], t.tx_signature == ^tx_signature)
        |> where([t], t.status == "pending")
        |> Repo.one()

      case transaction do
        nil ->
          Repo.rollback(:transaction_not_found)

        transaction ->
          # Update transaction status
          {:ok, confirmed_tx} =
            transaction
            |> CreditTransaction.confirm_changeset()
            |> Repo.update()

          # Get or create user credits
          {:ok, user_credit} = get_or_create_user_credits(transaction.user_id)

          # Add hours to balance
          {:ok, updated_credit} =
            user_credit
            |> UserCredit.add_hours_changeset(transaction.hours_purchased)
            |> Repo.update()

          %{transaction: confirmed_tx, user_credit: updated_credit}
      end
    end)
  end

  @doc """
  Marks a transaction as failed
  """
  def fail_transaction(tx_signature) do
    transaction =
      CreditTransaction
      |> where([t], t.tx_signature == ^tx_signature)
      |> where([t], t.status == "pending")
      |> Repo.one()

    case transaction do
      nil ->
        {:error, :transaction_not_found}

      transaction ->
        transaction
        |> CreditTransaction.fail_changeset()
        |> Repo.update()
    end
  end

  @doc """
  Adds hours to user balance
  """
  def add_credits(user_id, hours) do
    {:ok, user_credit} = get_or_create_user_credits(user_id)

    user_credit
    |> UserCredit.add_hours_changeset(hours)
    |> Repo.update()
  end

  @doc """
  Deducts hours from user balance (for video processing)
  """
  def deduct_credits(user_id, hours) do
    Repo.transaction(fn ->
      {:ok, user_credit} = get_or_create_user_credits(user_id)

      case UserCredit.deduct_hours_changeset(user_credit, hours) |> Repo.update() do
        {:ok, updated_credit} ->
          updated_credit

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  @doc """
  Lists all transactions for a user
  """
  def list_user_transactions(user_id) do
    CreditTransaction
    |> where([t], t.user_id == ^user_id)
    |> order_by([t], desc: t.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets a transaction by signature
  """
  def get_transaction_by_signature(tx_signature) do
    Repo.get_by(CreditTransaction, tx_signature: tx_signature)
  end

  @doc """
  Checks if user has enough credits for a given duration
  """
  def has_enough_credits?(user_id, hours_needed) do
    {:ok, %{hours_remaining: remaining}} = get_user_balance(user_id)
    Decimal.compare(remaining, Decimal.new(to_string(hours_needed))) != :lt
  end
end
