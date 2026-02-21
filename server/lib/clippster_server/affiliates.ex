defmodule ClippsterServer.Affiliates do
  @moduledoc """
  The Affiliates context - manages affiliate accounts, commission tracking, and payouts.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Storage
  alias ClippsterServer.Affiliates.{Affiliate, AffiliateReferral, AffiliatePayout}

  # ============================================================================
  # Affiliate CRUD
  # ============================================================================

  @doc """
  Creates a new affiliate account. Admin-only.
  """
  def create_affiliate(user_id, attrs, admin_id) do
    %Affiliate{}
    |> Affiliate.create_changeset(
      attrs
      |> Map.put(:user_id, user_id)
      |> Map.put(:approved_by_admin_id, admin_id)
    )
    |> Repo.insert()
  end

  @doc """
  Updates an affiliate's settings/rates.
  Accepts either an `%Affiliate{}` struct or an affiliate ID.
  """
  def update_affiliate(affiliate_or_id, attrs)

  def update_affiliate(%Affiliate{} = affiliate, attrs) do
    affiliate
    |> Affiliate.update_changeset(attrs)
    |> Repo.update()
  end

  def update_affiliate(id, attrs) do
    case get_affiliate(id) do
      nil -> {:error, :not_found}
      affiliate -> update_affiliate(affiliate, attrs)
    end
  end

  @doc """
  Deactivates an affiliate.
  """
  def deactivate_affiliate(id) do
    case get_affiliate(id) do
      nil -> {:error, :not_found}
      affiliate ->
        affiliate
        |> Affiliate.update_changeset(%{status: "deactivated"})
        |> Repo.update()
    end
  end

  @doc """
  Activates an affiliate.
  """
  def activate_affiliate(id) do
    case get_affiliate(id) do
      nil -> {:error, :not_found}
      affiliate ->
        affiliate
        |> Affiliate.update_changeset(%{status: "active"})
        |> Repo.update()
    end
  end

  @doc """
  Gets an affiliate by ID.
  """
  def get_affiliate(id) do
    Repo.get(Affiliate, id)
  end

  @doc """
  Gets an affiliate by ID with preloaded associations.
  """
  def get_affiliate_with_details(id) do
    Affiliate
    |> where([a], a.id == ^id)
    |> preload([:user, :approved_by_admin, referrals: :referred_user, payouts: :paid_by_admin])
    |> Repo.one()
  end

  @doc """
  Gets an affiliate by user ID.
  """
  def get_affiliate_by_user(user_id) do
    Repo.get_by(Affiliate, user_id: user_id)
  end

  @doc """
  Gets an affiliate by referral code.
  """
  def get_affiliate_by_code(code) when is_binary(code) do
    normalized = String.upcase(String.trim(code))
    Repo.get_by(Affiliate, referral_code: normalized)
  end

  def get_affiliate_by_code(_), do: nil

  @doc """
  Checks if a user has an active affiliate account.
  """
  def is_affiliate?(user_id) do
    Affiliate
    |> where([a], a.user_id == ^user_id and a.status == "active")
    |> Repo.exists?()
  end

  @doc """
  Lists all affiliates with optional filters.
  """
  def list_affiliates(opts \\ []) do
    query =
      Affiliate
      |> preload(:user)
      |> order_by([a], desc: a.inserted_at)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [a], a.status == ^status)
      end

    affiliates = Repo.all(query)

    # Attach summary stats to each affiliate
    Enum.map(affiliates, fn affiliate ->
      stats = get_affiliate_summary_stats(affiliate.id)
      Map.put(affiliate, :stats, stats)
    end)
  end

  # ============================================================================
  # Commission Recording
  # ============================================================================

  @doc """
  Records a signup (first subscription) commission.
  Called when a referred user subscribes for the first time.
  """
  def record_signup_commission(referred_user_id, subscription_tier, amount_usd) do
    with {:ok, user} <- get_referred_user(referred_user_id),
         {:ok, affiliate} <- get_active_affiliate(user.referred_by_affiliate_id) do
      now = DateTime.utc_now()
      commission_pct = affiliate.signup_commission_pct
      commission_usd = Decimal.mult(amount_usd, Decimal.div(commission_pct, Decimal.new("100")))

      %AffiliateReferral{}
      |> AffiliateReferral.create_changeset(%{
        affiliate_id: affiliate.id,
        referred_user_id: referred_user_id,
        event_type: "first_subscription",
        subscription_tier: subscription_tier,
        amount_usd: amount_usd,
        commission_pct: commission_pct,
        commission_usd: commission_usd,
        status: "confirmed",
        period_month: now.month,
        period_year: now.year
      })
      |> Repo.insert()
    end
  end

  @doc """
  Records a recurring subscription renewal commission.
  """
  def record_recurring_commission(referred_user_id, amount_usd) do
    with {:ok, user} <- get_referred_user(referred_user_id),
         {:ok, affiliate} <- get_active_affiliate(user.referred_by_affiliate_id) do
      now = DateTime.utc_now()
      commission_pct = affiliate.recurring_commission_pct
      commission_usd = Decimal.mult(amount_usd, Decimal.div(commission_pct, Decimal.new("100")))

      %AffiliateReferral{}
      |> AffiliateReferral.create_changeset(%{
        affiliate_id: affiliate.id,
        referred_user_id: referred_user_id,
        event_type: "recurring",
        amount_usd: amount_usd,
        commission_pct: commission_pct,
        commission_usd: commission_usd,
        status: "confirmed",
        period_month: now.month,
        period_year: now.year
      })
      |> Repo.insert()
    end
  end

  @doc """
  Records a credit pack purchase commission.
  Only if the affiliate has credit_pack_commission_enabled.
  """
  def record_credit_pack_commission(referred_user_id, amount_usd) do
    with {:ok, user} <- get_referred_user(referred_user_id),
         {:ok, affiliate} <- get_active_affiliate(user.referred_by_affiliate_id),
         true <- affiliate.credit_pack_commission_enabled do
      now = DateTime.utc_now()
      commission_pct = affiliate.credit_pack_commission_pct
      commission_usd = Decimal.mult(amount_usd, Decimal.div(commission_pct, Decimal.new("100")))

      %AffiliateReferral{}
      |> AffiliateReferral.create_changeset(%{
        affiliate_id: affiliate.id,
        referred_user_id: referred_user_id,
        event_type: "credit_pack",
        amount_usd: amount_usd,
        commission_pct: commission_pct,
        commission_usd: commission_usd,
        status: "confirmed",
        period_month: now.month,
        period_year: now.year
      })
      |> Repo.insert()
    else
      false -> {:ok, :credit_pack_commission_disabled}
      error -> error
    end
  end

  @doc """
  Cancels all unpaid commissions for a referred user.
  Called on subscription cancellation or payment failure.
  Only cancels 'confirmed' commissions (not yet paid out) — 'paid' commissions are already disbursed.
  """
  def cancel_pending_commissions(referred_user_id) do
    {count, _} =
      AffiliateReferral
      |> where([r], r.referred_user_id == ^referred_user_id and r.status == "confirmed")
      |> Repo.update_all(set: [status: "cancelled", updated_at: DateTime.utc_now() |> DateTime.truncate(:second)])

    {:ok, count}
  end

  # ============================================================================
  # Dashboard & Stats
  # ============================================================================

  @doc """
  Gets dashboard stats for an affiliate.
  """
  def get_affiliate_dashboard(affiliate_id) do
    now = DateTime.utc_now()
    current_month = now.month
    current_year = now.year

    # This month
    this_month = get_period_stats(affiliate_id, current_year, current_month)

    # Last 3 months
    three_months = get_range_stats(affiliate_id, months_ago(3))

    # Year to date
    ytd = get_range_stats(affiliate_id, {current_year, 1})

    # All time
    all_time = get_all_time_stats(affiliate_id)

    # Breakdown by event type
    breakdown = get_event_type_breakdown(affiliate_id)

    %{
      this_month: this_month,
      three_months: three_months,
      ytd: ytd,
      all_time: all_time,
      breakdown: breakdown
    }
  end

  @doc """
  Gets admin overview stats across all affiliates.
  """
  def get_admin_overview do
    total_affiliates = Repo.aggregate(Affiliate, :count)
    active_affiliates = Repo.aggregate(from(a in Affiliate, where: a.status == "active"), :count)

    total_referrals =
      Repo.aggregate(
        from(r in AffiliateReferral, where: r.status in ["confirmed", "paid"]),
        :count
      )

    total_commission =
      Repo.aggregate(
        from(r in AffiliateReferral, where: r.status in ["confirmed", "paid"]),
        :sum,
        :commission_usd
      ) || Decimal.new("0")

    total_pending =
      Repo.aggregate(
        from(r in AffiliateReferral, where: r.status == "confirmed"),
        :sum,
        :commission_usd
      ) || Decimal.new("0")

    total_paid =
      Repo.aggregate(
        from(r in AffiliateReferral, where: r.status == "paid"),
        :sum,
        :commission_usd
      ) || Decimal.new("0")

    %{
      total_affiliates: total_affiliates,
      active_affiliates: active_affiliates,
      total_referrals: total_referrals,
      total_commission: total_commission,
      total_pending: total_pending,
      total_paid: total_paid
    }
  end

  @doc """
  Gets pending payouts for a given period, grouped by affiliate.
  """
  def get_pending_payouts_for_period(month, year) do
    AffiliateReferral
    |> where([r], r.period_month == ^month and r.period_year == ^year and r.status == "confirmed")
    |> group_by([r], r.affiliate_id)
    |> select([r], %{
      affiliate_id: r.affiliate_id,
      total_commission: sum(r.commission_usd),
      referral_count: count(r.id)
    })
    |> Repo.all()
    |> Enum.map(fn row ->
      affiliate = get_affiliate(row.affiliate_id) |> Repo.preload(:user)
      Map.put(row, :affiliate, affiliate)
    end)
  end

  # ============================================================================
  # Payouts
  # ============================================================================

  @doc """
  Creates a payout record and marks all confirmed referrals for that period as paid.
  """
  def create_payout(affiliate_id, period_month, period_year, admin_id, attrs) do
    Repo.transaction(fn ->
      affiliate = get_affiliate(affiliate_id)

      if is_nil(affiliate) do
        Repo.rollback(:affiliate_not_found)
      end

      # Calculate total from confirmed referrals
      total =
        Repo.aggregate(
          from(r in AffiliateReferral,
            where:
              r.affiliate_id == ^affiliate_id and
                r.period_month == ^period_month and
                r.period_year == ^period_year and
                r.status == "confirmed"
          ),
          :sum,
          :commission_usd
        ) || Decimal.new("0")

      # Allow manual amount for testing or manual payouts
      total = if attrs[:manual_amount], do: Decimal.new(to_string(attrs[:manual_amount])), else: total

      if Decimal.equal?(total, Decimal.new("0")) do
        Repo.rollback(:no_pending_commissions)
      end

      # Determine payout address
      payout_address =
        case attrs[:payout_method] || affiliate.payout_method do
          "crypto" -> affiliate.solana_usdc_address
          "paypal" -> affiliate.paypal_email
          _ -> nil
        end

      if is_nil(payout_address) do
        Repo.rollback(:no_payout_address)
      end

      # Create payout record
      payout_attrs =
        Map.merge(attrs, %{
          affiliate_id: affiliate_id,
          period_month: period_month,
          period_year: period_year,
          amount_usd: total,
          payout_method: attrs[:payout_method] || affiliate.payout_method,
          payout_address: payout_address,
          paid_by_admin_id: admin_id,
          paid_at: DateTime.utc_now() |> DateTime.truncate(:second),
          status: "completed"
        })

      {:ok, payout} =
        %AffiliatePayout{}
        |> AffiliatePayout.create_changeset(payout_attrs)
        |> Repo.insert()

      # Mark all confirmed referrals for this period as paid
      {_count, _} =
        AffiliateReferral
        |> where(
          [r],
          r.affiliate_id == ^affiliate_id and
            r.period_month == ^period_month and
            r.period_year == ^period_year and
            r.status == "confirmed"
        )
        |> Repo.update_all(set: [status: "paid", updated_at: DateTime.utc_now() |> DateTime.truncate(:second)])

      payout
    end)
  end

  @doc """
  Uploads a payout proof screenshot to R2.
  """
  def upload_payout_proof(file_binary, filename, affiliate_id) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    sanitized = String.replace(filename, ~r/[^\w\-\.]/, "_") |> String.slice(0, 100)
    key = "affiliate-payouts/#{affiliate_id}/#{timestamp}_#{sanitized}"

    content_type =
      cond do
        String.ends_with?(filename, ".png") -> "image/png"
        String.ends_with?(filename, ".jpg") or String.ends_with?(filename, ".jpeg") -> "image/jpeg"
        String.ends_with?(filename, ".webp") -> "image/webp"
        true -> "application/octet-stream"
      end

    Storage.upload_file(file_binary, key, content_type: content_type)
  end

  @doc """
  Gets an affiliate's referrals with pagination.
  """
  def get_affiliate_referrals(affiliate_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    per_page = Keyword.get(opts, :per_page, 50)
    offset = (page - 1) * per_page

    query =
      AffiliateReferral
      |> where([r], r.affiliate_id == ^affiliate_id)
      |> order_by([r], desc: r.inserted_at)
      |> limit(^per_page)
      |> offset(^offset)
      |> preload(:referred_user)

    Repo.all(query)
  end

  @doc """
  Gets an affiliate's payout history.
  """
  def get_affiliate_payouts(affiliate_id) do
    AffiliatePayout
    |> where([p], p.affiliate_id == ^affiliate_id)
    |> order_by([p], desc: p.inserted_at)
    |> preload(:paid_by_admin)
    |> Repo.all()
  end

  @doc """
  Updates an affiliate's own payout settings.
  """
  def update_affiliate_settings(%Affiliate{} = affiliate, attrs) do
    affiliate
    |> Affiliate.settings_changeset(attrs)
    |> Repo.update()
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp get_referred_user(user_id) do
    case Repo.get(User, user_id) do
      nil -> {:error, :user_not_found}
      %User{referred_by_affiliate_id: nil} -> {:error, :not_referred}
      user -> {:ok, user}
    end
  end

  defp get_active_affiliate(nil), do: {:error, :no_affiliate}

  defp get_active_affiliate(affiliate_id) do
    case Repo.get(Affiliate, affiliate_id) do
      nil -> {:error, :affiliate_not_found}
      %Affiliate{status: "active"} = affiliate -> {:ok, affiliate}
      _ -> {:error, :affiliate_not_active}
    end
  end

  defp get_affiliate_summary_stats(affiliate_id) do
    total_referrals =
      Repo.aggregate(
        from(r in AffiliateReferral,
          where: r.affiliate_id == ^affiliate_id and r.status in ["confirmed", "paid"]
        ),
        :count
      )

    total_earned =
      Repo.aggregate(
        from(r in AffiliateReferral,
          where: r.affiliate_id == ^affiliate_id and r.status in ["confirmed", "paid"]
        ),
        :sum,
        :commission_usd
      ) || Decimal.new("0")

    total_pending =
      Repo.aggregate(
        from(r in AffiliateReferral,
          where: r.affiliate_id == ^affiliate_id and r.status == "confirmed"
        ),
        :sum,
        :commission_usd
      ) || Decimal.new("0")

    %{
      total_referrals: total_referrals,
      total_earned: total_earned,
      total_pending: total_pending
    }
  end

  defp get_period_stats(affiliate_id, year, month) do
    query =
      from(r in AffiliateReferral,
        where:
          r.affiliate_id == ^affiliate_id and
            r.period_year == ^year and
            r.period_month == ^month and
            r.status in ["confirmed", "paid"]
      )

    %{
      count: Repo.aggregate(query, :count),
      total: Repo.aggregate(query, :sum, :commission_usd) || Decimal.new("0")
    }
  end

  defp get_range_stats(affiliate_id, {from_year, from_month}) do
    query =
      from(r in AffiliateReferral,
        where:
          r.affiliate_id == ^affiliate_id and
            r.status in ["confirmed", "paid"] and
            (r.period_year > ^from_year or
               (r.period_year == ^from_year and r.period_month >= ^from_month))
      )

    %{
      count: Repo.aggregate(query, :count),
      total: Repo.aggregate(query, :sum, :commission_usd) || Decimal.new("0")
    }
  end

  defp get_all_time_stats(affiliate_id) do
    query =
      from(r in AffiliateReferral,
        where: r.affiliate_id == ^affiliate_id and r.status in ["confirmed", "paid"]
      )

    %{
      count: Repo.aggregate(query, :count),
      total: Repo.aggregate(query, :sum, :commission_usd) || Decimal.new("0")
    }
  end

  defp get_event_type_breakdown(affiliate_id) do
    AffiliateReferral
    |> where([r], r.affiliate_id == ^affiliate_id and r.status in ["confirmed", "paid"])
    |> group_by([r], r.event_type)
    |> select([r], %{
      event_type: r.event_type,
      count: count(r.id),
      total: sum(r.commission_usd)
    })
    |> Repo.all()
    |> Enum.into(%{}, fn row -> {row.event_type, %{count: row.count, total: row.total}} end)
  end

  defp months_ago(n) do
    now = DateTime.utc_now()
    # Simple month subtraction
    total_months = now.year * 12 + now.month - n
    year = div(total_months - 1, 12)
    month = rem(total_months - 1, 12) + 1
    {year, month}
  end
end
