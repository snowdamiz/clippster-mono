defmodule ClippsterServerWeb.AdminController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits
  alias ClippsterServer.Organizations
  alias ClippsterServer.AI
  alias ClippsterServer.AppSettings
  alias ClippsterServer.BetaCodes
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.PromoCodes

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

        %{
          id: user.id,
          wallet_address: user.wallet_address,
          email: user.email,
          provider: user.provider,
          is_admin: user.is_admin,
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
end
