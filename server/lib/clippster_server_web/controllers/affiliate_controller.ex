defmodule ClippsterServerWeb.AffiliateController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Affiliates
  alias ClippsterServer.Storage

  # ============================================================================
  # Admin Endpoints
  # ============================================================================

  @doc """
  List all affiliates with summary stats.
  """
  def list_affiliates(conn, params) do
    opts =
      case params["status"] do
        nil -> []
        status -> [status: status]
      end

    affiliates = Affiliates.list_affiliates(opts)

    affiliates_data =
      Enum.map(affiliates, fn affiliate ->
        %{
          id: affiliate.id,
          user: format_user(affiliate.user),
          status: affiliate.status,
          referral_code: affiliate.referral_code,
          signup_commission_pct: Decimal.to_float(affiliate.signup_commission_pct),
          recurring_commission_pct: Decimal.to_float(affiliate.recurring_commission_pct),
          credit_pack_commission_enabled: affiliate.credit_pack_commission_enabled,
          credit_pack_commission_pct: Decimal.to_float(affiliate.credit_pack_commission_pct),
          payout_method: affiliate.payout_method,
          notes: affiliate.notes,
          stats: %{
            total_referrals: affiliate.stats.total_referrals,
            total_earned: Decimal.to_float(affiliate.stats.total_earned),
            total_pending: Decimal.to_float(affiliate.stats.total_pending)
          },
          inserted_at: affiliate.inserted_at,
          updated_at: affiliate.updated_at
        }
      end)

    json(conn, %{success: true, affiliates: affiliates_data, count: length(affiliates_data)})
  end

  @doc """
  Create a new affiliate.
  """
  def create_affiliate(conn, params) do
    admin_id = conn.assigns[:current_user_id]

    user_id =
      case params["user_id"] do
        id when is_binary(id) -> String.to_integer(id)
        id when is_integer(id) -> id
        _ -> nil
      end

    if is_nil(user_id) do
      conn |> put_status(400) |> json(%{success: false, error: "user_id is required"})
    else
      attrs = %{
        referral_code: params["referral_code"],
        signup_commission_pct: params["signup_commission_pct"],
        recurring_commission_pct: params["recurring_commission_pct"],
        credit_pack_commission_enabled: params["credit_pack_commission_enabled"] || false,
        credit_pack_commission_pct: params["credit_pack_commission_pct"],
        notes: params["notes"]
      }

      case Affiliates.create_affiliate(user_id, attrs, admin_id) do
        {:ok, affiliate} ->
          conn
          |> put_status(201)
          |> json(%{
            success: true,
            message: "Affiliate created successfully",
            affiliate: %{
              id: affiliate.id,
              referral_code: affiliate.referral_code,
              status: affiliate.status,
              inserted_at: affiliate.inserted_at
            }
          })

        {:error, %Ecto.Changeset{} = changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(422) |> json(%{success: false, error: errors})

        {:error, reason} ->
          conn |> put_status(400) |> json(%{success: false, error: inspect(reason)})
      end
    end
  end

  @doc """
  Admin overview aggregate stats.
  """
  def admin_overview(conn, _params) do
    overview = Affiliates.get_admin_overview()

    json(conn, %{
      success: true,
      overview: %{
        total_affiliates: overview.total_affiliates,
        active_affiliates: overview.active_affiliates,
        total_referrals: overview.total_referrals,
        total_commission: Decimal.to_float(overview.total_commission),
        total_pending: Decimal.to_float(overview.total_pending),
        total_paid: Decimal.to_float(overview.total_paid)
      }
    })
  end

  @doc """
  List pending/completed payouts for a period.
  """
  def pending_payouts(conn, params) do
    now = DateTime.utc_now()
    month = parse_int(params["month"]) || now.month
    year = parse_int(params["year"]) || now.year

    payouts = Affiliates.get_pending_payouts_for_period(month, year)

    payouts_data =
      Enum.map(payouts, fn row ->
        %{
          affiliate_id: row.affiliate_id,
          affiliate: if(row.affiliate, do: %{
            id: row.affiliate.id,
            referral_code: row.affiliate.referral_code,
            payout_method: row.affiliate.payout_method,
            solana_usdc_address: row.affiliate.solana_usdc_address,
            paypal_email: row.affiliate.paypal_email,
            user: format_user(row.affiliate.user)
          }),
          total_commission: Decimal.to_float(row.total_commission),
          referral_count: row.referral_count
        }
      end)

    json(conn, %{success: true, payouts: payouts_data, period: %{month: month, year: year}})
  end

  @doc """
  Get detailed affiliate view.
  """
  def show_affiliate(conn, %{"id" => id}) do
    case Affiliates.get_affiliate_with_details(parse_int(id)) do
      nil ->
        conn |> put_status(404) |> json(%{success: false, error: "Affiliate not found"})

      affiliate ->
        referrals_data =
          Enum.map(affiliate.referrals, fn r ->
            %{
              id: r.id,
              event_type: r.event_type,
              subscription_tier: r.subscription_tier,
              amount_usd: Decimal.to_float(r.amount_usd),
              commission_pct: Decimal.to_float(r.commission_pct),
              commission_usd: Decimal.to_float(r.commission_usd),
              status: r.status,
              period_month: r.period_month,
              period_year: r.period_year,
              referred_user: if(r.referred_user, do: %{
                id: r.referred_user.id,
                email: anonymize_email(r.referred_user.email),
                name: r.referred_user.name
              }),
              inserted_at: r.inserted_at
            }
          end)

        payouts_data =
          Enum.map(affiliate.payouts, fn p ->
            %{
              id: p.id,
              period_month: p.period_month,
              period_year: p.period_year,
              amount_usd: Decimal.to_float(p.amount_usd),
              payout_method: p.payout_method,
              payout_address: p.payout_address,
              transaction_id: p.transaction_id,
              proof_screenshot_url: presign_url(p.proof_screenshot_url),
              status: p.status,
              paid_at: p.paid_at,
              paid_by: if(p.paid_by_admin, do: %{id: p.paid_by_admin.id, email: p.paid_by_admin.email}),
              notes: p.notes,
              inserted_at: p.inserted_at
            }
          end)

        json(conn, %{
          success: true,
          affiliate: %{
            id: affiliate.id,
            user: format_user(affiliate.user),
            status: affiliate.status,
            referral_code: affiliate.referral_code,
            signup_commission_pct: Decimal.to_float(affiliate.signup_commission_pct),
            recurring_commission_pct: Decimal.to_float(affiliate.recurring_commission_pct),
            credit_pack_commission_enabled: affiliate.credit_pack_commission_enabled,
            credit_pack_commission_pct: Decimal.to_float(affiliate.credit_pack_commission_pct),
            payout_method: affiliate.payout_method,
            solana_usdc_address: affiliate.solana_usdc_address,
            paypal_email: affiliate.paypal_email,
            notes: affiliate.notes,
            approved_by: if(affiliate.approved_by_admin, do: %{id: affiliate.approved_by_admin.id, email: affiliate.approved_by_admin.email}),
            inserted_at: affiliate.inserted_at,
            updated_at: affiliate.updated_at
          },
          referrals: referrals_data,
          payouts: payouts_data
        })
    end
  end

  @doc """
  Update affiliate settings/rates.
  """
  def update_affiliate(conn, %{"id" => id} = params) do
    attrs = %{}
    |> maybe_put(params, "status", :status)
    |> maybe_put(params, "referral_code", :referral_code)
    |> maybe_put(params, "signup_commission_pct", :signup_commission_pct)
    |> maybe_put(params, "recurring_commission_pct", :recurring_commission_pct)
    |> maybe_put(params, "credit_pack_commission_enabled", :credit_pack_commission_enabled)
    |> maybe_put(params, "credit_pack_commission_pct", :credit_pack_commission_pct)
    |> maybe_put(params, "payout_method", :payout_method)
    |> maybe_put(params, "solana_usdc_address", :solana_usdc_address)
    |> maybe_put(params, "paypal_email", :paypal_email)
    |> maybe_put(params, "notes", :notes)

    case Affiliates.update_affiliate(parse_int(id), attrs) do
      {:ok, affiliate} ->
        json(conn, %{
          success: true,
          message: "Affiliate updated",
          affiliate: %{
            id: affiliate.id,
            status: affiliate.status,
            referral_code: affiliate.referral_code,
            updated_at: affiliate.updated_at
          }
        })

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Affiliate not found"})

      {:error, %Ecto.Changeset{} = changeset} ->
        errors = format_changeset_errors(changeset)
        conn |> put_status(422) |> json(%{success: false, error: errors})
    end
  end

  @doc """
  Deactivate an affiliate.
  """
  def deactivate(conn, %{"id" => id}) do
    case Affiliates.deactivate_affiliate(parse_int(id)) do
      {:ok, affiliate} ->
        json(conn, %{success: true, message: "Affiliate deactivated", affiliate: %{id: affiliate.id, status: affiliate.status}})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Affiliate not found"})
    end
  end

  @doc """
  Activate an affiliate.
  """
  def activate(conn, %{"id" => id}) do
    case Affiliates.activate_affiliate(parse_int(id)) do
      {:ok, affiliate} ->
        json(conn, %{success: true, message: "Affiliate activated", affiliate: %{id: affiliate.id, status: affiliate.status}})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Affiliate not found"})
    end
  end

  @doc """
  Record a payout (multipart: transaction_id + optional screenshot file).
  """
  def record_payout(conn, %{"id" => id} = params) do
    admin_id = conn.assigns[:current_user_id]
    affiliate_id = parse_int(id)
    month = parse_int(params["period_month"])
    year = parse_int(params["period_year"])

    if is_nil(month) or is_nil(year) do
      conn |> put_status(400) |> json(%{success: false, error: "period_month and period_year are required"})
    else
      # Handle screenshot upload if present
      proof_url =
        case params["screenshot"] do
          %Plug.Upload{path: path, filename: filename} ->
            case File.read(path) do
              {:ok, binary} ->
                case Affiliates.upload_payout_proof(binary, filename, affiliate_id) do
                  {:ok, url} -> url
                  _ -> nil
                end
              _ -> nil
            end
          _ -> nil
        end

      attrs = %{
        transaction_id: params["transaction_id"],
        proof_screenshot_url: proof_url,
        payout_method: params["payout_method"],
        notes: params["notes"]
      }

      case Affiliates.create_payout(affiliate_id, month, year, admin_id, attrs) do
        {:ok, payout} ->
          json(conn, %{
            success: true,
            message: "Payout recorded",
            payout: %{
              id: payout.id,
              amount_usd: Decimal.to_float(payout.amount_usd),
              status: payout.status,
              paid_at: payout.paid_at
            }
          })

        {:error, :affiliate_not_found} ->
          conn |> put_status(404) |> json(%{success: false, error: "Affiliate not found"})

        {:error, :no_pending_commissions} ->
          conn |> put_status(400) |> json(%{success: false, error: "No pending commissions for this period"})

        {:error, :no_payout_address} ->
          conn |> put_status(400) |> json(%{success: false, error: "Affiliate has no payout address configured"})

        {:error, %Ecto.Changeset{} = changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(422) |> json(%{success: false, error: errors})

        {:error, reason} ->
          conn |> put_status(400) |> json(%{success: false, error: inspect(reason)})
      end
    end
  end

  # ============================================================================
  # Authenticated User Endpoints (Affiliate's own dashboard)
  # ============================================================================

  @doc """
  Get own affiliate dashboard stats.
  """
  def my_dashboard(conn, _params) do
    user_id = conn.assigns[:current_user_id]

    case Affiliates.get_affiliate_by_user(user_id) do
      nil ->
        conn |> put_status(404) |> json(%{success: false, error: "You are not an affiliate"})

      affiliate ->
        dashboard = Affiliates.get_affiliate_dashboard(affiliate.id)

        json(conn, %{
          success: true,
          affiliate: %{
            id: affiliate.id,
            referral_code: affiliate.referral_code,
            status: affiliate.status,
            payout_method: affiliate.payout_method,
            solana_usdc_address: affiliate.solana_usdc_address,
            paypal_email: affiliate.paypal_email
          },
          dashboard: format_dashboard(dashboard)
        })
    end
  end

  @doc """
  Get own referral list (paginated).
  """
  def my_referrals(conn, params) do
    user_id = conn.assigns[:current_user_id]

    case Affiliates.get_affiliate_by_user(user_id) do
      nil ->
        conn |> put_status(404) |> json(%{success: false, error: "You are not an affiliate"})

      affiliate ->
        page = parse_int(params["page"]) || 1
        referrals = Affiliates.get_affiliate_referrals(affiliate.id, page: page)

        referrals_data =
          Enum.map(referrals, fn r ->
            %{
              id: r.id,
              event_type: r.event_type,
              amount_usd: Decimal.to_float(r.amount_usd),
              commission_usd: Decimal.to_float(r.commission_usd),
              status: r.status,
              period_month: r.period_month,
              period_year: r.period_year,
              inserted_at: r.inserted_at
            }
          end)

        json(conn, %{success: true, referrals: referrals_data})
    end
  end

  @doc """
  Get own payout history.
  """
  def my_payouts(conn, _params) do
    user_id = conn.assigns[:current_user_id]

    case Affiliates.get_affiliate_by_user(user_id) do
      nil ->
        conn |> put_status(404) |> json(%{success: false, error: "You are not an affiliate"})

      affiliate ->
        payouts = Affiliates.get_affiliate_payouts(affiliate.id)

        payouts_data =
          Enum.map(payouts, fn p ->
            %{
              id: p.id,
              period_month: p.period_month,
              period_year: p.period_year,
              amount_usd: Decimal.to_float(p.amount_usd),
              payout_method: p.payout_method,
              transaction_id: p.transaction_id,
              status: p.status,
              paid_at: p.paid_at,
              inserted_at: p.inserted_at
            }
          end)

        json(conn, %{success: true, payouts: payouts_data})
    end
  end

  @doc """
  Update own payout settings.
  """
  def update_settings(conn, params) do
    user_id = conn.assigns[:current_user_id]

    case Affiliates.get_affiliate_by_user(user_id) do
      nil ->
        conn |> put_status(404) |> json(%{success: false, error: "You are not an affiliate"})

      affiliate ->
        attrs = %{}
        |> maybe_put(params, "payout_method", :payout_method)
        |> maybe_put(params, "solana_usdc_address", :solana_usdc_address)
        |> maybe_put(params, "paypal_email", :paypal_email)

        case Affiliates.update_affiliate_settings(affiliate, attrs) do
          {:ok, updated} ->
            json(conn, %{
              success: true,
              message: "Settings updated",
              settings: %{
                payout_method: updated.payout_method,
                solana_usdc_address: updated.solana_usdc_address,
                paypal_email: updated.paypal_email
              }
            })

          {:error, %Ecto.Changeset{} = changeset} ->
            errors = format_changeset_errors(changeset)
            conn |> put_status(422) |> json(%{success: false, error: errors})
        end
    end
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp format_user(nil), do: nil
  defp format_user(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      wallet_address: user.wallet_address
    }
  end

  defp format_dashboard(dashboard) do
    %{
      this_month: format_stat(dashboard.this_month),
      three_months: format_stat(dashboard.three_months),
      ytd: format_stat(dashboard.ytd),
      all_time: format_stat(dashboard.all_time),
      breakdown: Enum.into(dashboard.breakdown, %{}, fn {k, v} ->
        {k, %{count: v.count, total: Decimal.to_float(v.total)}}
      end)
    }
  end

  defp format_stat(%{count: count, total: total}) do
    %{count: count, total: Decimal.to_float(total)}
  end

  defp anonymize_email(nil), do: nil
  defp anonymize_email(email) do
    case String.split(email, "@") do
      [local, domain] ->
        masked = String.slice(local, 0, 2) <> "***"
        "#{masked}@#{domain}"
      _ -> "***"
    end
  end

  defp presign_url(nil), do: nil
  defp presign_url(url) do
    case Storage.presigned_url(url) do
      {:ok, presigned} -> presigned
      _ -> url
    end
  end

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp maybe_put(map, params, param_key, map_key) do
    case Map.get(params, param_key) do
      nil -> map
      value -> Map.put(map, map_key, value)
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
