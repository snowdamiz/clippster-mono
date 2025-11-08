defmodule ClippsterServerWeb.AdminController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits

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
end