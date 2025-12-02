defmodule ClippsterServer.Credits do
  @moduledoc """
  The Credits context - manages user credit balances and transactions.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Credits.{CreditTransaction, UserCredit, ProcessingJob}

  @credit_packs %{
    "starter" => %{hours: 4, usd: 10.00},
    "creator" => %{hours: 12, usd: 20.00},
    "pro" => %{hours: 40, usd: 50.00},
    "studio" => %{hours: 200, usd: 200.00}
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
  Sets user credit balance to a specific amount
  """
  def set_credits(user_id, hours_remaining, hours_used \\ 0) do
    {:ok, user_credit} = get_or_create_user_credits(user_id)

    user_credit
    |> UserCredit.changeset(%{
      hours_remaining: Decimal.new(to_string(hours_remaining)),
      hours_used: Decimal.new(to_string(hours_used))
    })
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

  # ============================================================================
  # Processing Job Management (for secure credit refunds)
  # ============================================================================

  @doc """
  Creates a new processing job record when credits are deducted.
  Returns {:ok, job} with the job_id that can be used for cancellation.
  """
  def create_processing_job(user_id, credits_deducted, duration_hours, opts \\ []) do
    attrs = %{
      user_id: user_id,
      credits_deducted: Decimal.new(to_string(credits_deducted)),
      video_duration_hours: Decimal.new(to_string(duration_hours)),
      status: "processing",
      project_id: Keyword.get(opts, :project_id),
      video_url: Keyword.get(opts, :video_url),
      job_type: Keyword.get(opts, :job_type, "clip_detection")
    }

    ProcessingJob.create_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Gets a processing job by ID, ensuring it belongs to the specified user.
  Returns {:ok, job} or {:error, :not_found} or {:error, :unauthorized}
  """
  def get_processing_job(job_id, user_id) do
    case Repo.get(ProcessingJob, job_id) do
      nil ->
        {:error, :not_found}
      
      %ProcessingJob{user_id: ^user_id} = job ->
        {:ok, job}
      
      _job ->
        # Job exists but belongs to a different user
        {:error, :unauthorized}
    end
  end

  @doc """
  Gets a processing job by project_id and user_id (for client convenience).
  Only returns jobs in 'processing' status.
  """
  def get_active_job_by_project(project_id, user_id) do
    ProcessingJob
    |> where([j], j.project_id == ^project_id)
    |> where([j], j.user_id == ^user_id)
    |> where([j], j.status == "processing")
    |> order_by([j], desc: j.inserted_at)
    |> limit(1)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      job -> {:ok, job}
    end
  end

  @doc """
  Cancels a processing job and refunds the credits.
  This is the main server-authoritative cancellation function.
  
  Security checks:
  - Job must exist
  - Job must belong to the requesting user
  - Job must be in 'processing' status
  - Refund cannot exceed original charge
  
  Returns {:ok, %{job: job, refunded: amount}} or {:error, reason}
  """
  def cancel_processing_job(job_id, user_id, reason \\ "User cancelled") do
    Repo.transaction(fn ->
      # Get and validate the job
      job = case get_processing_job(job_id, user_id) do
        {:ok, job} -> job
        {:error, :not_found} -> Repo.rollback(:job_not_found)
        {:error, :unauthorized} -> Repo.rollback(:unauthorized)
      end

      # Check if job can be cancelled
      unless ProcessingJob.can_cancel?(job) do
        Repo.rollback(:job_not_cancellable)
      end

      # Check if already refunded
      if ProcessingJob.was_refunded?(job) do
        Repo.rollback(:already_refunded)
      end

      # Calculate refund amount (full refund of deducted credits)
      refund_amount = job.credits_deducted

      # Update job status to cancelled with refund info
      {:ok, updated_job} = job
        |> ProcessingJob.cancel_changeset(refund_amount, reason)
        |> Repo.update()

      # Add credits back to user's balance
      {:ok, _updated_credit} = add_credits(user_id, Decimal.to_float(refund_amount))

      IO.puts("[Credits] Refunded #{Decimal.to_string(refund_amount)} credits to user #{user_id} for cancelled job #{job_id}")

      %{job: updated_job, refunded: refund_amount}
    end)
  end

  @doc """
  Cancels a job by project_id (convenience function for clients).
  Finds the active job for the project and cancels it.
  """
  def cancel_job_by_project(project_id, user_id, reason \\ "User cancelled") do
    case get_active_job_by_project(project_id, user_id) do
      {:ok, job} -> cancel_processing_job(job.id, user_id, reason)
      {:error, :not_found} -> {:error, :no_active_job}
    end
  end

  @doc """
  Marks a processing job as completed.
  """
  def complete_processing_job(job_id, result_data \\ nil) do
    case Repo.get(ProcessingJob, job_id) do
      nil -> {:error, :not_found}
      job ->
        job
        |> ProcessingJob.complete_changeset(result_data)
        |> Repo.update()
    end
  end

  @doc """
  Marks a processing job as failed.
  Note: Failed jobs do NOT automatically refund credits.
  Admin intervention may be needed for failed job refunds.
  """
  def fail_processing_job(job_id, error_info \\ nil) do
    case Repo.get(ProcessingJob, job_id) do
      nil -> {:error, :not_found}
      job ->
        job
        |> ProcessingJob.fail_changeset(error_info)
        |> Repo.update()
    end
  end

  @doc """
  Lists all processing jobs for a user.
  """
  def list_user_processing_jobs(user_id, opts \\ []) do
    query = ProcessingJob
      |> where([j], j.user_id == ^user_id)
      |> order_by([j], desc: j.inserted_at)

    query = case Keyword.get(opts, :status) do
      nil -> query
      status -> where(query, [j], j.status == ^status)
    end

    query = case Keyword.get(opts, :limit) do
      nil -> query
      limit -> limit(query, ^limit)
    end

    Repo.all(query)
  end
end
