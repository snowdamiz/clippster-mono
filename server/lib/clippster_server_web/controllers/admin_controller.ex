defmodule ClippsterServerWeb.AdminController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits
  alias ClippsterServer.Organizations
  alias ClippsterServer.AI

  def get_ai_usage_stats(conn, _params) do
    stats = AI.get_usage_stats()

    # Transform logs for JSON response
    recent_logs_data = Enum.map(stats.recent_logs, fn log ->
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
    users_data = Enum.map(users, fn user ->
      # Get user credits - admins have unlimited credits
      credits_info = if user.is_admin do
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

      %{
        id: user.id,
        wallet_address: user.wallet_address,
        email: user.email,
        provider: user.provider,
        is_admin: user.is_admin,
        created_at: user.inserted_at,
        updated_at: user.updated_at,
        credits: credits_info
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
                        message: "Successfully added #{credit_params.hours_to_add} hours to user balance",
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
            hours_used = case params do
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

    orgs_data = Enum.map(organizations, fn org ->
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
end