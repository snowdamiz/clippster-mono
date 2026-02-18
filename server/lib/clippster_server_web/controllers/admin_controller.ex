defmodule ClippsterServerWeb.AdminController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits
  alias ClippsterServer.Organizations
  alias ClippsterServer.AI
  alias ClippsterServer.AppSettings
  alias ClippsterServer.BetaCodes
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.OrganizationSubscriptions
  alias ClippsterServer.PromoCodes
  alias ClippsterServer.ClipperProfiles.LeaderboardWorker

  def get_ai_usage_stats(conn, _params) do
    stats = AI.get_usage_stats()

    # Transform logs for JSON response
    recent_logs_data =
      Enum.map(stats.recent_logs, fn log ->
        %{
          id: log.id,
          user_wallet: log.user.wallet_address,
          project_id: log.project_id,
          provider: log.provider,
          model: log.model,
          tokens: log.total_tokens,
          duration: log.duration_seconds,
          operation: log.operation_type,
          created_at: log.inserted_at
        }
      end)

    json(conn, %{
      success: true,
      stats: %{
        total_tokens: stats.total_tokens,
        total_duration: stats.total_duration,
        provider_stats: stats.provider_stats,
        model_stats: stats.model_stats,
        operation_stats: stats.operation_stats
      },
      recent_logs: recent_logs_data
    })
  end

  def list_users(conn, _params) do
    users = Accounts.list_users()

    # Transform users data for JSON response
    users_data =
      Enum.map(users, fn user ->
        # Get user credits - admins have unlimited credits
        credits_info =
          if user.is_admin do
            %{
              hours_remaining: :unlimited,
              hours_used: 0.0
            }
          else
            {:ok, balance} = Credits.get_user_balance(user.id)

            %{
              hours_remaining: Decimal.to_float(balance.hours_remaining),
              hours_used: Decimal.to_float(balance.hours_used)
            }
          end

        # Get subscription info
        subscription_info = Subscriptions.get_subscription_status(user.id)

        # Check if user is an affiliate
        affiliate = ClippsterServer.Affiliates.get_affiliate_by_user(user.id)
        is_affiliate = affiliate != nil
        affiliate_status = if affiliate, do: affiliate.status, else: nil

        %{
          id: user.id,
          wallet_address: user.wallet_address,
          email: user.email,
          provider: user.provider,
          is_admin: user.is_admin,
          is_moderator: user.is_moderator,
          is_affiliate: is_affiliate,
          affiliate_status: affiliate_status,
          created_at: user.inserted_at,
          updated_at: user.updated_at,
          credits: credits_info,
          subscription: subscription_info
        }
      end)

    json(conn, %{
      success: true,
      users: users_data,
      count: length(users_data)
    })
  end

  def promote_user(conn, %{"user_id" => user_id_string}) do
    case Integer.parse(user_id_string) do
      {user_id, ""} ->
        case Accounts.promote_user_to_admin(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "User successfully promoted to admin",
              user: %{
                id: user.id,
                wallet_address: user.wallet_address,
                is_admin: user.is_admin,
                updated_at: user.updated_at
              }
            })

          {:error, :not_found} ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "User not found"})

          {:error, _reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to promote user"})
        end

      :error ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  def update_user_credits(conn, %{"user_id" => user_id_string} = params) do
    case Integer.parse(user_id_string) do
      {user_id, ""} ->
        # Validate parameters
        case validate_credit_params(params) do
          {:ok, credit_params} ->
            case Accounts.get_user(user_id) do
              nil ->
                conn
                |> put_status(404)
                |> json(%{success: false, error: "User not found"})

              user ->
                if user.is_admin do
                  conn
                  |> put_status(400)
                  |> json(%{success: false, error: "Cannot modify admin credits"})
                else
                  case Credits.add_credits(user_id, credit_params.hours_to_add) do
                    {:ok, user_credit} ->
                      # Get updated balance for response
                      {:ok, balance} = Credits.get_user_balance(user_id)

                      json(conn, %{
                        success: true,
                        message:
                          "Successfully added #{credit_params.hours_to_add} hours to user balance",
                        credits: %{
                          hours_remaining: Decimal.to_float(balance.hours_remaining),
                          hours_used: Decimal.to_float(balance.hours_used)
                        },
                        updated_at: user_credit.updated_at
                      })

                    {:error, changeset} ->
                      conn
                      |> put_status(400)
                      |> json(%{
                        success: false,
                        error: "Failed to add credits",
                        details: format_changeset_errors(changeset)
                      })
                  end
                end
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: reason})
        end

      :error ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # Private helper functions

  defp validate_credit_params(params) do
    # Validate hours_to_add
    case Map.get(params, "hours_to_add") do
      nil ->
        {:error, "hours_to_add is required"}

      value when is_number(value) and value > 0 ->
        {:ok, %{hours_to_add: value}}

      value when is_binary(value) ->
        case Float.parse(value) do
          {float_val, ""} when float_val > 0 ->
            {:ok, %{hours_to_add: float_val}}

          _ ->
            {:error, "Invalid hours_to_add value - must be a positive number"}
        end

      _ ->
        {:error, "Invalid hours_to_add value - must be a positive number"}
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  # ============================================================================
  # Organization Credit Management
  # ============================================================================

  @doc """
  Add credits to an organization's pool.
  Requires admin authentication.
  """
  def add_org_credits(conn, %{"organization_id" => org_id_string} = params) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        case validate_hours_param(params, "hours_to_add") do
          {:ok, hours} ->
            case Organizations.get_organization(org_id) do
              nil ->
                conn
                |> put_status(404)
                |> json(%{success: false, error: "Organization not found"})

              org ->
                case Organizations.add_organization_credits(org_id, hours) do
                  {:ok, org_credit} ->
                    json(conn, %{
                      success: true,
                      message: "Successfully added #{hours} hours to organization #{org.name}",
                      credits: %{
                        hours_remaining: Decimal.to_float(org_credit.hours_remaining),
                        hours_used: Decimal.to_float(org_credit.hours_used)
                      }
                    })

                  {:error, reason} ->
                    conn
                    |> put_status(500)
                    |> json(%{success: false, error: "Failed to add credits: #{inspect(reason)}"})
                end
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: reason})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Set an organization's credit balance to a specific amount.
  Requires admin authentication.
  """
  def set_org_credits(conn, %{"organization_id" => org_id_string} = params) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        case validate_hours_param(params, "hours_remaining") do
          {:ok, hours_remaining} ->
            hours_used =
              case params do
                %{"hours_used" => used} -> parse_float(used) || 0.0
                _ -> nil
              end

            case Organizations.get_organization(org_id) do
              nil ->
                conn
                |> put_status(404)
                |> json(%{success: false, error: "Organization not found"})

              org ->
                case Organizations.set_organization_credits(org_id, hours_remaining, hours_used) do
                  {:ok, org_credit} ->
                    json(conn, %{
                      success: true,
                      message: "Successfully set credits for organization #{org.name}",
                      credits: %{
                        hours_remaining: Decimal.to_float(org_credit.hours_remaining),
                        hours_used: Decimal.to_float(org_credit.hours_used)
                      }
                    })

                  {:error, reason} ->
                    conn
                    |> put_status(500)
                    |> json(%{success: false, error: "Failed to set credits: #{inspect(reason)}"})
                end
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: reason})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Get credits for an organization.
  Requires admin authentication.
  """
  def get_org_credits(conn, %{"organization_id" => org_id_string}) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        case Organizations.get_organization(org_id) do
          nil ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "Organization not found"})

          org ->
            {:ok, credits} = Organizations.get_organization_credits(org_id)

            json(conn, %{
              success: true,
              organization: %{
                id: org.id,
                name: org.name
              },
              credits: %{
                hours_remaining: Decimal.to_float(credits.hours_remaining),
                hours_used: Decimal.to_float(credits.hours_used)
              }
            })
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  List all organizations with their credit balances.
  Requires admin authentication.
  """
  def list_organizations(conn, _params) do
    organizations = Organizations.list_all_organizations()

    orgs_data =
      Enum.map(organizations, fn org ->
        {:ok, credits} = Organizations.get_organization_credits(org.id)
        member_count = Organizations.count_members(org.id)

        %{
          id: org.id,
          name: org.name,
          description: org.description,
          member_count: member_count,
          credits: %{
            hours_remaining: Decimal.to_float(credits.hours_remaining),
            hours_used: Decimal.to_float(credits.hours_used)
          },
          subscription_status: org.subscription_status,
          subscription_tier: org.subscription_tier,
          max_seats: org.max_seats,
          monthly_credits: org.monthly_credits,
          subscription_end_date: org.subscription_end_date,
          admin_price_cents: org.admin_price_cents,
          created_by_admin: org.created_by_admin_id != nil,
          setup_completed: org.setup_completed,
          created_at: org.inserted_at
        }
      end)

    json(conn, %{
      success: true,
      organizations: orgs_data,
      count: length(orgs_data)
    })
  end

  # Helper functions

  defp parse_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> {:ok, int}
      _ -> {:error, :invalid_integer}
    end
  end

  defp parse_integer(value) when is_integer(value), do: {:ok, value}
  defp parse_integer(_), do: {:error, :invalid_integer}

  defp parse_float(value) when is_binary(value) do
    case Float.parse(value) do
      {float, ""} -> float
      _ -> nil
    end
  end

  defp parse_float(value) when is_number(value), do: value / 1
  defp parse_float(_), do: nil

  defp validate_hours_param(params, key) do
    case Map.get(params, key) do
      nil ->
        {:error, "#{key} is required"}

      value when is_number(value) and value >= 0 ->
        {:ok, value}

      value when is_binary(value) ->
        case Float.parse(value) do
          {float_val, ""} when float_val >= 0 ->
            {:ok, float_val}

          _ ->
            {:error, "Invalid #{key} value - must be a non-negative number"}
        end

      _ ->
        {:error, "Invalid #{key} value - must be a non-negative number"}
    end
  end

  # ============================================================================
  # App Settings Management
  # ============================================================================

  @doc """
  Get all application settings.
  Requires admin authentication.
  """
  def get_settings(conn, _params) do
    settings = AppSettings.get_all_settings()
    feature_flags = AppSettings.get_feature_flags()

    json(conn, %{
      success: true,
      settings: settings,
      feature_flags: feature_flags
    })
  end

  @doc """
  Update a specific setting.
  Requires admin authentication.
  """
  def update_setting(conn, %{"key" => key, "value" => value}) do
    case AppSettings.set_setting(key, value) do
      {:ok, setting} ->
        json(conn, %{
          success: true,
          message: "Setting '#{key}' updated successfully",
          setting: %{
            key: setting.key,
            value: setting.value
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Failed to update setting",
          details: format_changeset_errors(changeset)
        })
    end
  end

  def update_setting(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters: key and value"})
  end

  # ============================================================================
  # Beta Codes Management
  # ============================================================================

  @doc """
  Generate new beta codes.
  Requires admin authentication.
  """
  def generate_beta_codes(conn, %{"count" => count}) when is_integer(count) do
    do_generate_beta_codes(conn, count)
  end

  def generate_beta_codes(conn, %{"count" => count}) when is_binary(count) do
    case Integer.parse(count) do
      {int_count, ""} ->
        do_generate_beta_codes(conn, int_count)

      _ ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid count parameter"})
    end
  end

  def generate_beta_codes(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameter: count"})
  end

  defp do_generate_beta_codes(conn, count) when count > 0 and count <= 100 do
    case BetaCodes.generate_codes(count) do
      {:ok, codes} ->
        codes_data =
          Enum.map(codes, fn code ->
            %{
              id: code.id,
              code: code.code,
              created_at: code.inserted_at
            }
          end)

        json(conn, %{
          success: true,
          message: "Generated #{count} beta codes",
          codes: codes_data
        })

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to generate codes: #{inspect(reason)}"})
    end
  end

  defp do_generate_beta_codes(conn, _count) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Count must be between 1 and 100"})
  end

  @doc """
  List all beta codes with their usage status.
  Requires admin authentication.
  """
  def list_beta_codes(conn, _params) do
    codes = BetaCodes.list_codes()
    stats = BetaCodes.get_code_stats()

    codes_data =
      Enum.map(codes, fn code ->
        %{
          id: code.id,
          code: code.code,
          used: not is_nil(code.used_by_user_id),
          used_at: code.used_at,
          used_by:
            if code.used_by_user do
              %{
                id: code.used_by_user.id,
                email: code.used_by_user.email,
                wallet_address: code.used_by_user.wallet_address
              }
            else
              nil
            end,
          created_at: code.inserted_at
        }
      end)

    json(conn, %{
      success: true,
      codes: codes_data,
      stats: stats
    })
  end

  # ============================================================================
  # Subscription Management
  # ============================================================================

  @doc """
  Grant a subscription to a user.
  Requires admin authentication.
  """
  def grant_subscription(conn, %{"user_id" => user_id_string} = params) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        # Validate parameters
        tier = Map.get(params, "tier")
        days = Map.get(params, "days", "30")
        grant_credits = Map.get(params, "grant_credits", "false")

        case validate_tier(tier) do
          :ok ->
            days_int = parse_days(days)
            grant_credits_bool = parse_boolean(grant_credits)

            case Subscriptions.admin_grant_subscription(
                   user_id,
                   tier,
                   days_int,
                   grant_credits_bool
                 ) do
              {:ok, _result} ->
                subscription_info = Subscriptions.get_subscription_status(user_id)

                json(conn, %{
                  success: true,
                  message: "Successfully granted #{tier} subscription to user",
                  subscription: subscription_info
                })

              {:error, :invalid_tier} ->
                conn
                |> put_status(400)
                |> json(%{success: false, error: "Invalid subscription tier"})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{
                  success: false,
                  error: "Failed to grant subscription: #{inspect(reason)}"
                })
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: reason})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Extend a user's subscription.
  Requires admin authentication.
  """
  def extend_subscription(conn, %{"user_id" => user_id_string} = params) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        days = Map.get(params, "days", "30")
        grant_credits = Map.get(params, "grant_credits", "false")

        days_int = parse_days(days)
        grant_credits_bool = parse_boolean(grant_credits)

        case Subscriptions.admin_extend_subscription(user_id, days_int, grant_credits_bool) do
          {:ok, _result} ->
            subscription_info = Subscriptions.get_subscription_status(user_id)

            json(conn, %{
              success: true,
              message: "Successfully extended subscription by #{days_int} days",
              subscription: subscription_info
            })

          {:error, :no_tier} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "User has no subscription tier to extend"})

          {:error, :invalid_tier} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Invalid subscription tier"})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to extend subscription: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Change a user's subscription tier.
  Requires admin authentication.
  """
  def change_subscription_tier(conn, %{"user_id" => user_id_string} = params) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        tier = Map.get(params, "tier")
        grant_credits = Map.get(params, "grant_credits", "false")

        case validate_tier(tier) do
          :ok ->
            grant_credits_bool = parse_boolean(grant_credits)

            case Subscriptions.admin_change_tier(user_id, tier, grant_credits_bool) do
              {:ok, _result} ->
                subscription_info = Subscriptions.get_subscription_status(user_id)

                json(conn, %{
                  success: true,
                  message: "Successfully changed subscription tier to #{tier}",
                  subscription: subscription_info
                })

              {:error, :invalid_tier} ->
                conn
                |> put_status(400)
                |> json(%{success: false, error: "Invalid subscription tier"})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to change tier: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: reason})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Cancel a user's subscription.
  Requires admin authentication.
  """
  def cancel_user_subscription(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Subscriptions.cancel_subscription(user_id) do
          {:ok, _user} ->
            subscription_info = Subscriptions.get_subscription_status(user_id)

            json(conn, %{
              success: true,
              message: "Successfully cancelled subscription for user",
              subscription: subscription_info
            })

          {:error, :not_active} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "User does not have an active subscription"})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to cancel subscription: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Get subscription history for a user.
  Requires admin authentication.
  """
  def get_subscription_history(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        subscriptions = Subscriptions.list_user_subscriptions(user_id)

        subscriptions_data =
          Enum.map(subscriptions, fn sub ->
            %{
              id: sub.id,
              status: sub.status,
              tier: sub.subscription_tier,
              start_date: sub.start_date,
              end_date: sub.end_date,
              credits_granted:
                if(sub.credits_granted, do: Decimal.to_float(sub.credits_granted), else: nil),
              payment_method: sub.payment_method,
              amount_usd: if(sub.amount_usd, do: Decimal.to_float(sub.amount_usd), else: nil),
              created_at: sub.inserted_at
            }
          end)

        json(conn, %{
          success: true,
          subscriptions: subscriptions_data,
          count: length(subscriptions_data)
        })

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================================================
  # Promo Code Management
  # ============================================================================

  @doc """
  List all promo codes with optional filters.
  Filters: is_active (boolean), tier (string), expired (boolean), search (string)
  """
  def list_promos(conn, params) do
    filters =
      %{}
      |> maybe_put_filter(:is_active, params["is_active"])
      |> maybe_put_filter(:tier, params["tier"])
      |> maybe_put_filter(:expired, params["expired"])
      |> maybe_put_filter(:search, params["search"])

    promos = PromoCodes.list_promo_codes(filters)

    promos_data =
      Enum.map(promos, fn promo ->
        %{
          id: promo.id,
          code: promo.code,
          name: promo.name,
          percent_off: promo.percent_off,
          duration_kind: promo.duration_kind,
          duration_months: promo.duration_months,
          allowed_tiers: promo.allowed_tiers,
          max_redemptions: promo.max_redemptions,
          redeem_by: promo.redeem_by,
          is_active: promo.is_active,
          redemption_count: promo.redemption_count,
          stripe_coupon_id: promo.stripe_coupon_id,
          stripe_promo_code_id: promo.stripe_promo_code_id,
          notes: promo.notes,
          created_by: %{
            id: promo.created_by_admin.id,
            wallet_address: promo.created_by_admin.wallet_address
          },
          created_at: promo.inserted_at,
          updated_at: promo.updated_at
        }
      end)

    json(conn, %{
      success: true,
      promos: promos_data,
      count: length(promos_data)
    })
  end

  @doc """
  Get a single promo code with detailed statistics.
  """
  def get_promo(conn, %{"id" => id}) do
    case PromoCodes.get_promo_with_stats(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Promo code not found"})

      promo ->
        redemptions_data =
          Enum.map(Map.get(promo, :redemptions, []), fn redemption ->
            %{
              id: redemption.id,
              user: %{
                id: redemption.user.id,
                wallet_address: redemption.user.wallet_address,
                email: redemption.user.email
              },
              stripe_customer_id: redemption.stripe_customer_id,
              stripe_subscription_id: redemption.stripe_subscription_id,
              stripe_invoice_id: redemption.stripe_invoice_id,
              redeemed_at: redemption.redeemed_at,
              status: redemption.status,
              created_at: redemption.inserted_at
            }
          end)

        json(conn, %{
          success: true,
          promo: %{
            id: promo.id,
            code: promo.code,
            name: promo.name,
            percent_off: promo.percent_off,
            duration_kind: promo.duration_kind,
            duration_months: promo.duration_months,
            allowed_tiers: promo.allowed_tiers,
            max_redemptions: promo.max_redemptions,
            redeem_by: promo.redeem_by,
            is_active: promo.is_active,
            redemption_count: promo.redemption_count,
            stripe_coupon_id: promo.stripe_coupon_id,
            stripe_promo_code_id: promo.stripe_promo_code_id,
            notes: promo.notes,
            created_by: %{
              id: promo.created_by_admin.id,
              wallet_address: promo.created_by_admin.wallet_address
            },
            created_at: promo.inserted_at,
            updated_at: promo.updated_at
          },
          redemptions: redemptions_data
        })
    end
  end

  @doc """
  Create a new promo code.
  """
  def create_promo(conn, params) do
    admin_id = conn.assigns[:current_user_id]

    case PromoCodes.create_promo_code(params, admin_id) do
      {:ok, promo} ->
        json(conn, %{
          success: true,
          message: "Promo code created successfully",
          promo: %{
            id: promo.id,
            code: promo.code,
            name: promo.name,
            percent_off: promo.percent_off,
            duration_kind: promo.duration_kind,
            duration_months: promo.duration_months,
            allowed_tiers: promo.allowed_tiers,
            max_redemptions: promo.max_redemptions,
            redeem_by: promo.redeem_by,
            is_active: promo.is_active,
            stripe_coupon_id: promo.stripe_coupon_id,
            stripe_promo_code_id: promo.stripe_promo_code_id,
            notes: promo.notes
          }
        })

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Failed to create promo code",
          details: format_changeset_errors(changeset)
        })

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Failed to create promo code: #{inspect(reason)}"
        })
    end
  end

  @doc """
  Update a promo code.
  """
  def update_promo(conn, %{"id" => id} = params) do
    case PromoCodes.get_promo_code(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Promo code not found"})

      promo ->
        update_params =
          Map.take(params, ["name", "max_redemptions", "redeem_by", "is_active", "notes"])

        case PromoCodes.update_promo_code(promo, update_params) do
          {:ok, updated_promo} ->
            json(conn, %{
              success: true,
              message: "Promo code updated successfully",
              promo: %{
                id: updated_promo.id,
                code: updated_promo.code,
                name: updated_promo.name,
                percent_off: updated_promo.percent_off,
                duration_kind: updated_promo.duration_kind,
                duration_months: updated_promo.duration_months,
                allowed_tiers: updated_promo.allowed_tiers,
                max_redemptions: updated_promo.max_redemptions,
                redeem_by: updated_promo.redeem_by,
                is_active: updated_promo.is_active,
                notes: updated_promo.notes,
                updated_at: updated_promo.updated_at
              }
            })

          {:error, changeset} ->
            conn
            |> put_status(400)
            |> json(%{
              success: false,
              error: "Failed to update promo code",
              details: format_changeset_errors(changeset)
            })
        end
    end
  end

  @doc """
  Toggle the active status of a promo code.
  """
  def toggle_promo_active(conn, %{"id" => id, "active" => active}) do
    case PromoCodes.get_promo_code(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Promo code not found"})

      promo ->
        active? = parse_boolean(active)

        case PromoCodes.toggle_active(promo, active?) do
          {:ok, updated_promo} ->
            action = if active?, do: "activated", else: "deactivated"

            json(conn, %{
              success: true,
              message: "Promo code #{action} successfully",
              promo: %{
                id: updated_promo.id,
                code: updated_promo.code,
                is_active: updated_promo.is_active,
                updated_at: updated_promo.updated_at
              }
            })

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{
              success: false,
              error: "Failed to toggle promo code: #{inspect(reason)}"
            })
        end
    end
  end

  # Helper functions for subscription management

  defp validate_tier(tier) when tier in ["starter", "creator", "pro"], do: :ok
  defp validate_tier(_), do: {:error, "Invalid tier - must be one of: starter, creator, pro"}

  defp parse_days(value) when is_integer(value) and value > 0, do: value

  defp parse_days(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int > 0 -> int
      _ -> 30
    end
  end

  defp parse_days(_), do: 30

  defp parse_boolean("true"), do: true
  defp parse_boolean("false"), do: false
  defp parse_boolean(true), do: true
  defp parse_boolean(false), do: false
  defp parse_boolean(_), do: false

  defp maybe_put_filter(filters, _key, nil), do: filters
  defp maybe_put_filter(filters, _key, ""), do: filters
  defp maybe_put_filter(filters, key, value), do: Map.put(filters, key, value)

  @doc """
  Save free tier branding configuration (watermark, intro, outro, overlays).
  Admin only.
  """
  def save_free_tier_branding(conn, %{"branding" => branding}) do
    case AppSettings.set_setting("free_tier_branding", Jason.encode!(branding)) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Free tier branding saved"})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to save branding: #{inspect(reason)}"})
    end
  end

  @doc """
  Get free tier branding configuration.
  Admin only.
  """
  def get_free_tier_branding(conn, _params) do
    raw = AppSettings.get_setting("free_tier_branding")

    branding =
      case raw do
        nil ->
          nil

        value when is_binary(value) ->
          case Jason.decode(value) do
            {:ok, decoded} -> decoded
            _ -> nil
          end

        value ->
          value
      end

    json(conn, %{success: true, branding: branding})
  end

  # ============================================================================
  # Organization Subscription Management
  # ============================================================================

  @doc """
  Grant a subscription to an organization.
  """
  def grant_org_subscription(conn, %{"organization_id" => org_id_string} = params) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        tier = Map.get(params, "tier")
        days = parse_days(Map.get(params, "days", "30"))
        grant_credits = parse_boolean(Map.get(params, "grant_credits", "false"))

        case validate_org_tier(tier) do
          :ok ->
            case OrganizationSubscriptions.admin_grant_subscription(
                   org_id,
                   tier,
                   days,
                   grant_credits
                 ) do
              {:ok, _result} ->
                status = OrganizationSubscriptions.get_subscription_status(org_id)

                json(conn, %{success: true, message: "Subscription granted", subscription: status})

              {:error, :invalid_tier} ->
                conn |> put_status(400) |> json(%{success: false, error: "Invalid tier"})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn |> put_status(400) |> json(%{success: false, error: reason})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Admin creates a new org account with email/password, custom seats/credits/price.
  """
  def create_org_account(conn, params) do
    admin_id = conn.assigns[:current_user_id]

    with {:ok, org_name} <- require_param(params, "org_name"),
         {:ok, email} <- require_param(params, "email"),
         {:ok, password} <- require_param(params, "password") do
      max_seats = parse_int_param(params, "max_seats", 0)
      monthly_credits = parse_int_param(params, "monthly_credits", 0)
      price_cents = parse_int_param(params, "price_cents", 0)
      tier = Map.get(params, "tier", "enterprise_base")
      days = parse_int_param(params, "days", 30)

      attrs = %{
        org_name: org_name,
        email: email,
        password: password,
        max_seats: max_seats,
        monthly_credits: monthly_credits,
        price_cents: price_cents,
        admin_id: admin_id,
        tier: tier,
        days: days,
        owner_name: Map.get(params, "owner_name"),
        description: Map.get(params, "description", "")
      }

      case OrganizationSubscriptions.admin_create_org_account(attrs) do
        {:ok, %{organization: org, user: user}} ->
          json(conn, %{
            success: true,
            message: "Organization account created",
            organization: %{
              id: org.id,
              name: org.name,
              subscription_status: org.subscription_status,
              subscription_tier: org.subscription_tier,
              max_seats: org.max_seats,
              monthly_credits: org.monthly_credits,
              admin_price_cents: org.admin_price_cents
            },
            user: %{
              id: user.id,
              email: user.email
            }
          })

        {:error, :email_already_exists} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "An account with this email already exists"})

        {:error, :user_create_error} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Failed to create user account. Please check email and password."})

        {:error, :org_create_error} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Failed to create organization. Please check organization name."})

        {:error, :member_error} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to add owner as organization member"})

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to create org account: #{inspect(reason)}"})
      end
    else
      {:error, reason} ->
        conn |> put_status(400) |> json(%{success: false, error: reason})
    end
  end

  @doc """
  Admin updates an existing org's subscription settings.
  """
  def update_org_subscription(conn, %{"organization_id" => org_id_string} = params) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        attrs = %{}

        attrs =
          if Map.has_key?(params, "max_seats"),
            do: Map.put(attrs, :max_seats, parse_int_param(params, "max_seats", 0)),
            else: attrs

        attrs =
          if Map.has_key?(params, "monthly_credits"),
            do: Map.put(attrs, :monthly_credits, parse_int_param(params, "monthly_credits", 0)),
            else: attrs

        attrs =
          if Map.has_key?(params, "admin_price_cents"),
            do:
              Map.put(attrs, :admin_price_cents, parse_int_param(params, "admin_price_cents", 0)),
            else: attrs

        attrs =
          if Map.has_key?(params, "tier"), do: Map.put(attrs, :tier, params["tier"]), else: attrs

        immediate = parse_boolean(Map.get(params, "immediate", "false"))

        case OrganizationSubscriptions.admin_update_org_subscription(org_id, attrs, immediate) do
          {:ok, _org} ->
            status = OrganizationSubscriptions.get_subscription_status(org_id)
            json(conn, %{success: true, message: "Subscription updated", subscription: status})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Admin sets the seat count for an organization.
  """
  def set_org_seats(conn, %{"organization_id" => org_id_string} = params) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        max_seats =
          case Map.get(params, "max_seats") do
            nil ->
              nil

            0 ->
              nil

            val when is_integer(val) ->
              val

            val when is_binary(val) ->
              case Integer.parse(val) do
                {0, ""} -> nil
                {int, ""} -> int
                _ -> nil
              end

            _ ->
              nil
          end

        case OrganizationSubscriptions.admin_set_seats(org_id, max_seats) do
          {:ok, _org} ->
            json(conn, %{success: true, message: "Seats updated to #{max_seats || "unlimited"}"})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Admin cancels an organization's subscription.
  """
  def cancel_org_subscription(conn, %{"organization_id" => org_id_string}) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        case OrganizationSubscriptions.admin_cancel_subscription(org_id) do
          {:ok, _org} ->
            status = OrganizationSubscriptions.get_subscription_status(org_id)
            json(conn, %{success: true, message: "Subscription cancelled", subscription: status})

          {:error, :not_active} ->
            conn |> put_status(400) |> json(%{success: false, error: "No active subscription"})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  defp validate_org_tier(tier)
       when tier in ["solo", "enterprise_base", "enterprise_ai", "enterprise_unlimited"], do: :ok

  defp validate_org_tier(_),
    do:
      {:error,
       "Invalid tier - must be one of: solo, enterprise_base, enterprise_ai, enterprise_unlimited"}

  defp require_param(params, key) do
    case Map.get(params, key) do
      nil -> {:error, "#{key} is required"}
      "" -> {:error, "#{key} is required"}
      value -> {:ok, value}
    end
  end

  defp parse_int_param(params, key, default) do
    case Map.get(params, key) do
      nil ->
        default

      val when is_integer(val) ->
        val

      val when is_binary(val) ->
        case Integer.parse(val) do
          {int, ""} -> int
          _ -> default
        end

      _ ->
        default
    end
  end

  # ============================================
  # Moderator Management
  # ============================================

  @doc """
  Promotes a user to moderator.
  """
  def promote_to_moderator(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.promote_user_to_moderator(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "User promoted to moderator",
              user: %{id: user.id, is_moderator: user.is_moderator}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, :already_moderator} ->
            conn |> put_status(400) |> json(%{success: false, error: "User is already a moderator"})

          {:error, :must_have_active_subscription} ->
            conn |> put_status(400) |> json(%{success: false, error: "User must have an active subscription to become a moderator"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Demotes a moderator to regular user.
  """
  def demote_moderator(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.demote_moderator(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Moderator demoted",
              user: %{id: user.id, is_moderator: user.is_moderator}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, :not_moderator} ->
            conn |> put_status(400) |> json(%{success: false, error: "User is not a moderator"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Enables moderator discount for a user.
  """
  def enable_mod_discount(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.enable_mod_discount(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Moderator discount enabled",
              user: %{id: user.id, mod_discount_enabled: user.mod_discount_enabled}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Disables moderator discount for a user.
  """
  def disable_mod_discount(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.disable_mod_discount(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Moderator discount disabled",
              user: %{id: user.id, mod_discount_enabled: user.mod_discount_enabled}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================
  # User Restrictions
  # ============================================

  @doc """
  Restricts a user platform-wide.
  """
  def restrict_user(conn, %{"user_id" => user_id_string} = params) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        reason = Map.get(params, "reason", "No reason provided")

        case Accounts.restrict_user(user_id, reason) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "User restricted",
              user: %{id: user.id, is_restricted: user.is_restricted, restricted_reason: user.restricted_reason}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Unrestricts a user.
  """
  def unrestrict_user(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.unrestrict_user(user_id) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "User unrestricted",
              user: %{id: user.id, is_restricted: user.is_restricted}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================
  # User Discounts
  # ============================================

  @doc """
  Applies an admin discount to a user.
  """
  def apply_user_discount(conn, %{"user_id" => user_id_string} = params) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        with {:ok, percent_off} <- require_param(params, "percent_off"),
             {:ok, months} <- require_param(params, "months"),
             {percent_int, ""} <- Integer.parse(to_string(percent_off)),
             {months_int, ""} <- Integer.parse(to_string(months)) do
          case Accounts.apply_admin_discount(user_id, percent_int, months_int) do
            {:ok, user} ->
              json(conn, %{
                success: true,
                message: "Discount applied",
                user: %{
                  id: user.id,
                  admin_discount_percent: user.admin_discount_percent,
                  admin_discount_months_remaining: user.admin_discount_months_remaining
                }
              })

            {:error, :user_not_found} ->
              conn |> put_status(404) |> json(%{success: false, error: "User not found"})

            {:error, reason} ->
              conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
          end
        else
          {:error, msg} ->
            conn |> put_status(400) |> json(%{success: false, error: msg})

          _ ->
            conn |> put_status(400) |> json(%{success: false, error: "Invalid percent_off or months value"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Grants a free month to a user.
  """
  def grant_free_month(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        # Free month = 100% discount for 1 month
        case Accounts.apply_admin_discount(user_id, 100, 1) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Free month granted",
              user: %{id: user.id}
            })

          {:error, :user_not_found} ->
            conn |> put_status(404) |> json(%{success: false, error: "User not found"})

          {:error, reason} ->
            conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================
  # User Deletion
  # ============================================

  @doc """
  Schedules a user for deletion.
  """
  def delete_user(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        user = Accounts.get_user(user_id)

        if is_nil(user) do
          conn |> put_status(404) |> json(%{success: false, error: "User not found"})
        else
          # If user has active Stripe subscription, schedule deletion at end of billing cycle
          deletion_date =
            if user.subscription_status == "active" and user.subscription_end_date do
              user.subscription_end_date
            else
              DateTime.utc_now() |> DateTime.truncate(:second)
            end

          case Accounts.schedule_user_deletion(user_id, deletion_date) do
            {:ok, user} ->
              json(conn, %{
                success: true,
                message: "User scheduled for deletion",
                deletion_date: user.scheduled_deletion_at
              })

            {:error, reason} ->
              conn |> put_status(500) |> json(%{success: false, error: "Failed: #{inspect(reason)}"})
          end
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================
  # User & Organization Profiles
  # ============================================

  @doc """
  Gets detailed user profile for admin view.
  """
  def get_user_profile(conn, %{"user_id" => user_id_string}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        user = Accounts.get_user(user_id)

        if is_nil(user) do
          conn |> put_status(404) |> json(%{success: false, error: "User not found"})
        else
          # Get credits info
          {:ok, balance} = Credits.get_user_balance(user_id)

          # Get subscription info
          subscription_info = Subscriptions.get_subscription_status(user_id)

          # Get organization memberships
          org_memberships = Organizations.list_user_organizations(user_id)

          json(conn, %{
            success: true,
            user: %{
              id: user.id,
              wallet_address: user.wallet_address,
              email: user.email,
              name: user.name,
              avatar_url: user.avatar_url,
              provider: user.provider,
              is_admin: user.is_admin,
              is_moderator: user.is_moderator,
              is_restricted: user.is_restricted,
              restricted_at: user.restricted_at,
              restricted_reason: user.restricted_reason,
              scheduled_deletion_at: user.scheduled_deletion_at,
              account_type: user.account_type,
              owned_organization_id: user.owned_organization_id,
              created_at: user.inserted_at,
              last_active_at: user.last_active_at,
              credits: %{
                hours_remaining: Decimal.to_float(balance.hours_remaining),
                hours_used: Decimal.to_float(balance.hours_used)
              },
              subscription: subscription_info,
              discount: %{
                admin_discount_percent: user.admin_discount_percent,
                admin_discount_months_remaining: user.admin_discount_months_remaining,
                mod_discount_enabled: user.mod_discount_enabled
              },
              organizations: org_memberships
            }
          })
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  @doc """
  Gets detailed organization info for admin view.
  """
  def get_org_details(conn, %{"id" => org_id_string}) do
    case parse_integer(org_id_string) do
      {:ok, org_id} ->
        org = Organizations.get_organization(org_id)

        if is_nil(org) do
          conn |> put_status(404) |> json(%{success: false, error: "Organization not found"})
        else
          # Get subscription info
          subscription_info = OrganizationSubscriptions.get_subscription_status(org_id)

          # Get member count
          member_count = Organizations.count_members(org_id)

          # Get members list with user details
          members = Organizations.list_members(org_id)
          |> Enum.map(fn member ->
            %{
              id: member.id,
              user_id: member.user_id,
              role: member.role,
              user: if member.user do
                %{
                  id: member.user.id,
                  name: member.user.name,
                  email: member.user.email,
                  avatar_url: member.user.avatar_url
                }
              else
                nil
              end
            }
          end)

          # Get owner details
          owner = if org.owner_id do
            Accounts.get_user(org.owner_id)
          else
            nil
          end

          owner_info = if owner do
            %{
              id: owner.id,
              name: owner.name,
              email: owner.email,
              avatar_url: owner.avatar_url
            }
          else
            nil
          end

          json(conn, %{
            success: true,
            organization: %{
              id: org.id,
              name: org.name,
              description: org.description,
              logo_url: org.logo_url,
              owner_id: org.owner_id,
              owner: owner_info,
              created_at: org.inserted_at,
              member_count: member_count,
              members: members,
              subscription: subscription_info
            }
          })
        end

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization ID"})
    end
  end

  @doc """
  Admin endpoint to reset a user's password.
  Only works for email-based accounts.
  """
  def reset_user_password(conn, %{"user_id" => user_id_string, "new_password" => new_password}) do
    case parse_integer(user_id_string) do
      {:ok, user_id} ->
        case Accounts.admin_reset_password(user_id, new_password) do
          {:ok, user} ->
            json(conn, %{
              success: true,
              message: "Password successfully reset",
              user: %{
                id: user.id,
                email: user.email
              }
            })

          {:error, :not_found} ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "User not found"})

          {:error, :not_email_account} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Cannot reset password for non-email accounts (wallet/OAuth)"})

          {:error, changeset} ->
            errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Invalid password", details: errors})
        end

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid user ID"})
    end
  end

  # ============================================
  # Moderator Action Logs
  # ============================================

  @doc """
  Lists all moderator action logs.
  """
  def list_mod_logs(conn, params) do
    page = Map.get(params, "page", "1") |> String.to_integer()
    per_page = Map.get(params, "per_page", "50") |> String.to_integer()

    logs = ClippsterServer.ModLogs.list_all_logs(page: page, per_page: per_page)
    total = ClippsterServer.ModLogs.count_all_logs()

    logs_data =
      Enum.map(logs, fn log ->
        %{
          id: log.id,
          moderator: %{
            id: log.moderator.id,
            name: log.moderator.name || log.moderator.email || log.moderator.wallet_address
          },
          action_type: log.action_type,
          target_type: log.target_type,
          target_id: log.target_id,
          details: log.details,
          created_at: log.inserted_at
        }
      end)

    json(conn, %{
      success: true,
      logs: logs_data,
      total: total,
      page: page,
      per_page: per_page
    })
  end

  @doc """
  Gets moderator action logs for a specific user.
  """
  def get_mod_logs_for_user(conn, %{"mod_id" => mod_id_string} = params) do
    case parse_integer(mod_id_string) do
      {:ok, mod_id} ->
        page = Map.get(params, "page", "1") |> String.to_integer()
        per_page = Map.get(params, "per_page", "50") |> String.to_integer()

        logs = ClippsterServer.ModLogs.list_logs_for_moderator(mod_id, page: page, per_page: per_page)
        total = ClippsterServer.ModLogs.count_logs_for_moderator(mod_id)

        logs_data =
          Enum.map(logs, fn log ->
            %{
              id: log.id,
              action_type: log.action_type,
              target_type: log.target_type,
              target_id: log.target_id,
              details: log.details,
              created_at: log.inserted_at
            }
          end)

        json(conn, %{
          success: true,
          logs: logs_data,
          total: total,
          page: page,
          per_page: per_page
        })

      {:error, _} ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid moderator ID"})
    end
  end

  # ============================================================================
  # Leaderboard Management
  # ============================================================================

  @doc """
  Manually trigger leaderboard recalculation for a given period type.
  Accepts period_type: "weekly" | "monthly" | "both" (default: "both")
  """
  def refresh_leaderboard(conn, params) do
    period_type = Map.get(params, "period_type", "both")

    results =
      case period_type do
        "weekly" ->
          LeaderboardWorker.calculate_weekly_leaderboard()
          %{weekly: true, monthly: false}

        "monthly" ->
          LeaderboardWorker.calculate_monthly_leaderboard()
          %{weekly: false, monthly: true}

        _ ->
          LeaderboardWorker.calculate_weekly_leaderboard()
          LeaderboardWorker.calculate_monthly_leaderboard()
          %{weekly: true, monthly: true}
      end

    json(conn, %{
      success: true,
      message: "Leaderboard recalculated successfully",
      recalculated: results
    })
  end
end
