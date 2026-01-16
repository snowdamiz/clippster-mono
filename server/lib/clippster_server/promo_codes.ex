defmodule ClippsterServer.PromoCodes do
  @moduledoc """
  Context module for managing promo/discount codes.
  """
  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.PromoCodes.PromoCode
  alias ClippsterServer.PromoCodes.PromoRedemption

  # ============================================================================
  # Validation
  # ============================================================================

  @doc """
  Validates a promo code for use with a specific tier and user.
  Returns {:ok, promo_code} if valid, {:error, reason} if invalid.
  """
  def validate_promo(code, tier, user_id) when is_binary(code) do
    normalized_code = String.upcase(String.trim(code))

    case get_active_code(normalized_code) do
      nil ->
        {:error, :invalid_code}

      promo ->
        cond do
          !is_active?(promo) ->
            {:error, :inactive_code}

          is_expired?(promo) ->
            {:error, :expired_code}

          !tier_allowed?(promo, tier) ->
            {:error, :tier_not_allowed}

          max_redemptions_reached?(promo) ->
            {:error, :max_redemptions_reached}

          user_already_redeemed?(promo.id, user_id) ->
            {:error, :already_redeemed}

          true ->
            {:ok, promo}
        end
    end
  end

  # ============================================================================
  # CRUD Operations
  # ============================================================================

  @doc """
  Creates a new promo code with Stripe integration.
  Returns {:ok, promo_code} or {:error, changeset}.
  """
  def create_promo_code(attrs, admin_id) do
    Repo.transaction(fn ->
      # Normalize and validate code
      attrs =
        attrs
        |> Map.put("code", normalize_code(attrs["code"] || attrs[:code]))
        |> Map.put("created_by_admin_id", admin_id)

      # Create local promo code
      changeset = %PromoCode{} |> PromoCode.create_changeset(attrs)

      unless changeset.valid? do
        Repo.rollback(changeset)
      end

      # Create Stripe coupon
      with {:ok, promo} <- Repo.insert(changeset),
           {:ok, stripe_coupon_id} <- create_stripe_coupon(promo),
           {:ok, stripe_promo_code_id} <- create_stripe_promotion_code(promo, stripe_coupon_id) do
        # Update promo code with Stripe IDs
        {:ok, updated_promo} =
          promo
          |> PromoCode.create_changeset(%{
            stripe_coupon_id: stripe_coupon_id,
            stripe_promo_code_id: stripe_promo_code_id
          })
          |> Repo.update()

        updated_promo
      else
        {:error, reason} -> Repo.rollback(reason)
        error -> Repo.rollback(error)
      end
    end)
  end

  @doc """
  Updates a promo code.
  Only allows updating certain fields (not the code or percent off).
  Returns {:ok, promo_code} or {:error, changeset}.
  """
  def update_promo_code(%PromoCode{} = promo, attrs) do
    promo
    |> PromoCode.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Toggles the active status of a promo code.
  Also updates Stripe if needed.
  Returns {:ok, promo_code} or {:error, changeset}.
  """
  def toggle_active(%PromoCode{} = promo, active?) do
    Repo.transaction(fn ->
      # Update local
      {:ok, updated_promo} =
        promo
        |> PromoCode.update_changeset(%{is_active: active?})
        |> Repo.update()

      # Update Stripe promotion code
      if active? do
        # Reactivate in Stripe
        case activate_stripe_promotion_code(promo.stripe_promo_code_id) do
          {:ok, _} -> updated_promo
          {:error, reason} -> Repo.rollback(reason)
        end
      else
        # Deactivate in Stripe
        case deactivate_stripe_promotion_code(promo.stripe_promo_code_id) do
          {:ok, _} -> updated_promo
          {:error, reason} -> Repo.rollback(reason)
        end
      end
    end)
  end

  @doc """
  Lists promo codes with optional filters.
  Filters: is_active (boolean), tier (string), expired (boolean), search (string)
  """
  def list_promo_codes(filters \\ %{}) do
    query = from(p in PromoCode)

    query =
      Enum.reduce(filters, query, fn
        {:is_active, active}, q ->
          where(q, [p], p.is_active == ^active)

        {:tier, tier}, q ->
          where(q, [p], ^tier in p.allowed_tiers)

        {:expired, expired}, q when expired ->
          where(q, [p], p.redeem_by < ^DateTime.utc_now())

        {:expired, expired}, q when not expired ->
          where(q, [p], is_nil(p.redeem_by) or p.redeem_by >= ^DateTime.utc_now())

        {:search, search}, q ->
          search_pattern = "%#{search}%"
          where(q, [p], like(p.code, ^search_pattern) or like(p.name, ^search_pattern))

        _, q ->
          q
      end)

    query
    |> order_by([p], desc: p.inserted_at)
    |> preload(:created_by_admin)
    |> Repo.all()
    |> Enum.map(&load_redemption_count/1)
  end

  @doc """
  Gets a single promo code by ID.
  """
  def get_promo_code(id) do
    case Repo.get(PromoCode, id) do
      nil -> nil
      promo -> load_redemption_count(promo)
    end
  end

  @doc """
  Gets a promo code with detailed statistics.
  """
  def get_promo_with_stats(id) do
    case Repo.get(PromoCode, id) do
      nil ->
        nil

      promo ->
        promo = promo |> Repo.preload(:created_by_admin) |> load_redemption_count()

        # Get redemptions with user info
        redemptions =
          from(r in PromoRedemption,
            where: r.promo_code_id == ^id,
            order_by: [desc: r.redeemed_at],
            preload: [:user]
          )
          |> Repo.all()

        %{promo | redemptions: redemptions}
    end
  end

  # ============================================================================
  # Redemption Tracking
  # ============================================================================

  @doc """
  Creates a redemption record when a promo code is used.
  Returns {:ok, redemption} or {:error, changeset}.
  """
  def create_redemption(promo_code_id, user_id, stripe_data \\ %{}) do
    attrs = %{
      promo_code_id: promo_code_id,
      user_id: user_id,
      stripe_customer_id: Map.get(stripe_data, :customer_id),
      stripe_subscription_id: Map.get(stripe_data, :subscription_id),
      stripe_invoice_id: Map.get(stripe_data, :invoice_id),
      redeemed_at: DateTime.utc_now() |> DateTime.truncate(:second),
      status: "active"
    }

    %PromoRedemption{}
    |> PromoRedemption.create_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates the status of a redemption.
  Returns {:ok, redemption} or {:error, changeset}.
  """
  def update_redemption_status(%PromoRedemption{} = redemption, status) do
    redemption
    |> PromoRedemption.update_status_changeset(status)
    |> Repo.update()
  end

  @doc """
  Gets a redemption by Stripe subscription ID.
  """
  def get_redemption_by_subscription(stripe_subscription_id) do
    Repo.get_by(PromoRedemption, stripe_subscription_id: stripe_subscription_id)
  end

  # ============================================================================
  # Stripe Helper Functions
  # ============================================================================

  @doc """
  Creates a Stripe coupon.
  Returns {:ok, coupon_id} or {:error, reason}.
  """
  def create_stripe_coupon(%PromoCode{} = promo) do
    coupon_params = %{
      percent_off: promo.percent_off,
      duration: promo.duration_kind
    }

    coupon_params =
      case promo.duration_kind do
        "repeating" -> Map.put(coupon_params, :duration_in_months, promo.duration_months)
        _ -> coupon_params
      end

    case Stripe.Coupon.create(coupon_params) do
      {:ok, coupon} -> {:ok, coupon.id}
      {:error, %Stripe.Error{message: message}} -> {:error, message}
      {:error, error} -> {:error, inspect(error)}
    end
  end

  @doc """
  Creates a Stripe promotion code.
  Returns {:ok, promotion_code_id} or {:error, reason}.
  """
  def create_stripe_promotion_code(%PromoCode{} = promo, coupon_id) do
    promo_params = %{
      coupon: coupon_id,
      code: promo.code,
      max_redemptions: promo.max_redemptions
    }

    promo_params =
      if promo.redeem_by do
        Map.put(promo_params, :expires_at, DateTime.to_unix(promo.redeem_by))
      else
        promo_params
      end

    case Stripe.PromotionCode.create(promo_params) do
      {:ok, promo_code} -> {:ok, promo_code.id}
      {:error, %Stripe.Error{message: message}} -> {:error, message}
      {:error, error} -> {:error, inspect(error)}
    end
  end

  @doc """
  Deactivates a Stripe promotion code.
  Returns {:ok, promotion_code} or {:error, reason}.
  """
  def deactivate_stripe_promotion_code(promo_code_id) do
    case Stripe.PromotionCode.update(promo_code_id, %{active: false}) do
      {:ok, promo_code} -> {:ok, promo_code}
      {:error, %Stripe.Error{message: message}} -> {:error, message}
      {:error, error} -> {:error, inspect(error)}
    end
  end

  @doc """
  Activates a Stripe promotion code.
  Returns {:ok, promotion_code} or {:error, reason}.
  """
  def activate_stripe_promotion_code(promo_code_id) do
    case Stripe.PromotionCode.update(promo_code_id, %{active: true}) do
      {:ok, promo_code} -> {:ok, promo_code}
      {:error, %Stripe.Error{message: message}} -> {:error, message}
      {:error, error} -> {:error, inspect(error)}
    end
  end

  # ============================================================================
  # Private Helper Functions
  # ============================================================================

  defp get_active_code(code) do
    PromoCode
    |> where([p], p.code == ^code)
    |> Repo.one()
  end

  defp is_active?(%PromoCode{is_active: true}), do: true
  defp is_active?(_), do: false

  defp is_expired?(%PromoCode{redeem_by: nil}), do: false

  defp is_expired?(%PromoCode{redeem_by: redeem_by}) do
    DateTime.compare(redeem_by, DateTime.utc_now()) == :lt
  end

  defp tier_allowed?(%PromoCode{allowed_tiers: tiers}, tier) do
    tier in tiers
  end

  defp max_redemptions_reached?(%PromoCode{max_redemptions: nil}), do: false

  defp max_redemptions_reached?(%PromoCode{id: id, max_redemptions: max}) do
    count =
      Repo.aggregate(
        from(r in PromoRedemption, where: r.promo_code_id == ^id),
        :count
      )

    count >= max
  end

  defp user_already_redeemed?(promo_code_id, user_id) do
    Repo.exists?(
      from(r in PromoRedemption,
        where: r.promo_code_id == ^promo_code_id and r.user_id == ^user_id
      )
    )
  end

  defp load_redemption_count(%PromoCode{id: id} = promo) do
    count =
      Repo.aggregate(
        from(r in PromoRedemption, where: r.promo_code_id == ^id),
        :count
      )

    Map.put(promo, :redemption_count, count)
  end

  defp normalize_code(code) when is_binary(code) do
    String.upcase(String.trim(code))
  end

  defp normalize_code(_), do: nil
end
