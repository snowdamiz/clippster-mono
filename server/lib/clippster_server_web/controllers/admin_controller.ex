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
        case Credits.get_user_balance(user.id) do
          {:ok, balance} ->
            %{
              hours_remaining: Decimal.to_float(balance.hours_remaining),
              hours_used: Decimal.to_float(balance.hours_used)
            }
          {:error, _reason} ->
            %{
              hours_remaining: 0.0,
              hours_used: 0.0
            }
        end
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
end