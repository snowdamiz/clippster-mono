defmodule ClippsterServer.Credits do
  @moduledoc """
  The Credits context - manages user credit balances and transactions.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Credits.{CreditTransaction, UserCredit, ProcessingJob}
  alias ClippsterServer.Analytics

  # Personal user credit packs (for individual purchases)
  # 1 credit = 1 minute of video processing
  @credit_packs %{
    "small" => %{hours: 240, usd: 10.00, name: "Small Pack"},
    "medium" => %{hours: 600, usd: 20.00, name: "Medium Pack"},
    "large" => %{hours: 1_800, usd: 39.99, name: "Large Pack"}
  }

  # Organization credit packs (for team purchases)
  # 1 credit = 1 minute of video processing
  @org_credit_packs %{
    "small" => %{hours: 10_000, usd: 100.00, name: "10k Credits"},
    "medium" => %{hours: 20_000, usd: 200.00, name: "20k Credits"},
    "large" => %{hours: 40_000, usd: 400.00, name: "40k Credits"}
  }

  @doc """
  Gets the pricing information for all personal user credit packs
  """
  def get_credit_packs, do: @credit_packs

  @doc """
  Gets the pricing information for all organization credit packs
  """
  def get_org_credit_packs, do: @org_credit_packs

  @doc """
  Gets pricing info for a specific personal user pack
  """
  def get_pack_info(pack_type) when is_binary(pack_type) do
    Map.get(@credit_packs, pack_type)
  end

  @doc """
  Gets pricing info for a specific organization pack
  """
  def get_org_pack_info(pack_type) when is_binary(pack_type) do
    Map.get(@org_credit_packs, pack_type)
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
        {:ok,
         %{
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
  Creates and confirms a Stripe transaction.
  Called from the Stripe webhook when payment is confirmed.
  """
  def create_stripe_transaction(attrs) do
    # Check if transaction already exists (idempotency)
    stripe_session_id = attrs[:stripe_session_id] || attrs["stripe_session_id"]

    case get_transaction_by_stripe_session(stripe_session_id) do
      nil ->
        Repo.transaction(fn ->
          # Create the transaction
          case CreditTransaction.stripe_changeset(attrs) |> Repo.insert() do
            {:ok, transaction} ->
              # Add credits to user balance
              {:ok, _user_credit} =
                add_credits(transaction.user_id, Decimal.to_float(transaction.hours_purchased))

              Analytics.track_event("credits_purchased", transaction.user_id, %{
                hours: transaction.hours_purchased,
                amount_usd: transaction.amount_usd,
                payment_method: "stripe"
              })

              transaction

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)

      _existing ->
        {:error, :already_processed}
    end
  end

  @doc """
  Gets a transaction by Stripe session ID
  """
  def get_transaction_by_stripe_session(session_id) when is_binary(session_id) do
    Repo.get_by(CreditTransaction, stripe_session_id: session_id)
  end

  def get_transaction_by_stripe_session(_), do: nil

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

  # Maximum credits a free tier user can hold
  @free_tier_credit_cap 60

  @doc """
  Adds hours to user balance (uncapped — used by subscription activation and renewals).
  """
  def add_credits(user_id, hours) do
    {:ok, user_credit} = get_or_create_user_credits(user_id)

    user_credit
    |> UserCredit.add_hours_changeset(hours)
    |> Repo.update()
  end

  @doc """
  Adds credits with free tier cap enforcement.
  Free tier users (subscription_status is nil or "none") cannot exceed #{@free_tier_credit_cap} credits.
  Used for promo codes, referral bonuses, and other non-subscription credit grants.
  Returns {:error, :free_tier_cap_reached} if the user is free tier and already at/above cap.
  """
  def add_credits_capped(user_id, hours) do
    alias ClippsterServer.Accounts

    user = Accounts.get_user(user_id)
    is_free_tier = is_nil(user) or user.subscription_status in [nil, "none"]

    if is_free_tier do
      {:ok, %{hours_remaining: remaining}} = get_user_balance(user_id)
      current = Decimal.to_float(remaining)

      if current >= @free_tier_credit_cap do
        {:error, :free_tier_cap_reached}
      else
        # Only add enough to reach the cap
        capped_hours = min(hours, @free_tier_credit_cap - current)

        if capped_hours > 0 do
          add_credits(user_id, capped_hours)
        else
          {:error, :free_tier_cap_reached}
        end
      end
    else
      # Paid subscribers have no cap
      add_credits(user_id, hours)
    end
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
          Analytics.track_event("credits_spent", user_id, %{
            hours: hours
          })

          updated_credit

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  @doc """
  Deducts credits with organization context.

  If organization_id is provided, deducts from the member's org allocation.
  If organization_id is nil, deducts from personal credits.

  Returns:
  - {:ok, %{source: :organization, org_id: id}} on org deduction success
  - {:ok, %{source: :personal}} on personal deduction success
  - {:error, :insufficient_credits, remaining, needed} on failure
  - {:error, :not_a_member} if user is not a member of the org
  - {:error, reason} on other failures
  """
  def deduct_credits_with_org_context(user_id, hours, organization_id)
      when is_nil(organization_id) do
    # No org context - use personal credits
    case deduct_credits(user_id, hours) do
      {:ok, _} ->
        {:ok, %{source: :personal}}

      {:error, _} ->
        {:ok, %{hours_remaining: remaining}} = get_user_balance(user_id)
        {:error, :insufficient_credits, Decimal.to_float(remaining), hours}
    end
  end

  def deduct_credits_with_org_context(user_id, hours, organization_id) do
    alias ClippsterServer.Organizations

    # Check if user is a member of the organization
    unless Organizations.is_member?(organization_id, user_id) do
      {:error, :not_a_member}
    else
      # Try to deduct from member's org allocation
      case Organizations.deduct_member_credits(organization_id, user_id, hours) do
        {:ok, _allocation} ->
          {:ok, %{source: :organization, org_id: organization_id}}

        {:error, :insufficient_credits} ->
          # Get remaining allocation for error message
          allocation = Organizations.get_member_allocation(organization_id, user_id)

          remaining =
            if allocation do
              Organizations.MemberCreditAllocation.remaining_hours(allocation)
              |> Decimal.to_float()
            else
              0.0
            end

          {:error, :insufficient_credits, remaining, hours}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Gets the available credits for a specific context (personal or organization).
  Returns the remaining hours available.
  """
  def get_context_balance(user_id, organization_id) when is_nil(organization_id) do
    {:ok, %{hours_remaining: remaining}} = get_user_balance(user_id)
    {:ok, %{source: :personal, hours_remaining: Decimal.to_float(remaining)}}
  end

  def get_context_balance(user_id, organization_id) do
    alias ClippsterServer.Organizations

    case Organizations.get_member_allocation(organization_id, user_id) do
      nil ->
        {:ok, %{source: :organization, hours_remaining: 0.0, org_id: organization_id}}

      allocation ->
        remaining = Organizations.MemberCreditAllocation.remaining_hours(allocation)

        {:ok,
         %{
           source: :organization,
           hours_remaining: Decimal.to_float(remaining),
           org_id: organization_id
         }}
    end
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
  Checks if user has enough credits for a given duration.
  Also checks organization credits if user is a member.
  """
  def has_enough_credits?(user_id, hours_needed) do
    {:ok, %{hours_remaining: remaining}} = get_user_balance(user_id)

    if Decimal.compare(remaining, Decimal.new(to_string(hours_needed))) != :lt do
      true
    else
      # Check organization allocations
      check_organization_credits(user_id, hours_needed)
    end
  end

  @doc """
  Checks if user has credits in any organization they belong to.
  """
  def check_organization_credits(user_id, hours_needed) do
    alias ClippsterServer.Organizations

    hours_decimal = Decimal.new(to_string(hours_needed))

    # Get all organizations the user is a member of
    organizations = Organizations.list_user_organizations(user_id)

    Enum.any?(organizations, fn %{organization: org} ->
      case Organizations.get_member_allocation(org.id, user_id) do
        nil ->
          false

        allocation ->
          remaining =
            ClippsterServer.Organizations.MemberCreditAllocation.remaining_hours(allocation)

          Decimal.compare(remaining, hours_decimal) != :lt
      end
    end)
  end

  @doc """
  Gets the total available credits for a user including personal and org allocations.
  """
  def get_total_available_credits(user_id) do
    alias ClippsterServer.Organizations

    {:ok, %{hours_remaining: personal_remaining}} = get_user_balance(user_id)

    # Sum up all organization allocations
    organizations = Organizations.list_user_organizations(user_id)

    org_remaining =
      Enum.reduce(organizations, Decimal.new("0"), fn %{organization: org}, acc ->
        case Organizations.get_member_allocation(org.id, user_id) do
          nil ->
            acc

          allocation ->
            remaining =
              ClippsterServer.Organizations.MemberCreditAllocation.remaining_hours(allocation)

            Decimal.add(acc, remaining)
        end
      end)

    {:ok,
     %{
       personal: personal_remaining,
       organization: org_remaining,
       total: Decimal.add(personal_remaining, org_remaining)
     }}
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
      job_type: Keyword.get(opts, :job_type, "clip_detection"),
      organization_id: Keyword.get(opts, :organization_id)
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
      job =
        case get_processing_job(job_id, user_id) do
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
      {:ok, updated_job} =
        job
        |> ProcessingJob.cancel_changeset(refund_amount, reason)
        |> Repo.update()

      # Add credits back to user's balance
      {:ok, _updated_credit} = add_credits(user_id, Decimal.to_float(refund_amount))

      IO.puts(
        "[Credits] Refunded #{Decimal.to_string(refund_amount)} credits to user #{user_id} for cancelled job #{job_id}"
      )

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
  Cancels all active processing jobs of a given type for a project and refunds
  their credits. Used to refund transcription costs when a subsequent detect
  step fails with insufficient credits.

  Returns {:ok, total_refunded} where total_refunded is the sum of all credits
  returned to the user.
  """
  def cancel_jobs_by_project_and_type(project_id, user_id, job_type, reason \\ "Subsequent step failed") do
    jobs =
      ProcessingJob
      |> where([j], j.project_id == ^project_id)
      |> where([j], j.user_id == ^user_id)
      |> where([j], j.job_type == ^job_type)
      |> where([j], j.status == "processing")
      |> Repo.all()

    total_refunded =
      Enum.reduce(jobs, 0.0, fn job, acc ->
        case cancel_processing_job(job.id, user_id, reason) do
          {:ok, %{refunded: amount}} ->
            acc + Decimal.to_float(amount)

          _ ->
            acc
        end
      end)

    {:ok, total_refunded}
  end

  @doc """
  Marks a processing job as completed.
  """
  def complete_processing_job(job_id, result_data \\ nil) do
    case Repo.get(ProcessingJob, job_id) do
      nil ->
        {:error, :not_found}

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
      nil ->
        {:error, :not_found}

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
    query =
      ProcessingJob
      |> where([j], j.user_id == ^user_id)
      |> order_by([j], desc: j.inserted_at)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [j], j.status == ^status)
      end

    query =
      case Keyword.get(opts, :limit) do
        nil -> query
        limit -> limit(query, ^limit)
      end

    Repo.all(query)
  end
end
