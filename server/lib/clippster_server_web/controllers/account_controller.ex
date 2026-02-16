defmodule ClippsterServerWeb.AccountController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Accounts

  @doc """
  Changes user's email address.
  Requires current password for verification.
  """
  def change_email(conn, %{"new_email" => new_email, "password" => password}) do
    user = conn.assigns.current_user

    case Accounts.change_email(user.id, new_email, password) do
      {:ok, _user} ->
        json(conn, %{
          success: true,
          message: "Verification email sent to #{new_email}. Please check your inbox."
        })

      {:error, :not_email_user} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Email changes are only available for email-authenticated accounts"
        })

      {:error, :invalid_password} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{
          success: false,
          error: "Invalid password"
        })

      {:error, :email_already_in_use} ->
        conn
        |> put_status(:conflict)
        |> json(%{
          success: false,
          error: "This email address is already in use"
        })

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{
          success: false,
          error: "Failed to change email. Please try again."
        })
    end
  end

  @doc """
  Verifies email change using verification token.
  """
  def verify_email_change(conn, %{"token" => token}) do
    case Accounts.verify_email_change(token) do
      {:ok, user} ->
        json(conn, %{
          success: true,
          message: "Email successfully changed to #{user.email}",
          user: %{
            id: user.id,
            email: user.email,
            name: user.name
          }
        })

      {:error, :invalid_token} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Invalid or expired verification link"
        })

      {:error, :token_expired} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Verification link has expired. Please request a new email change."
        })

      {:error, :email_already_in_use} ->
        conn
        |> put_status(:conflict)
        |> json(%{
          success: false,
          error: "This email address is already in use"
        })

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{
          success: false,
          error: "Failed to verify email change. Please try again."
        })
    end
  end

  @doc """
  Changes user's password.
  Requires current password for verification.
  """
  def change_password(conn, %{
        "current_password" => current_password,
        "new_password" => new_password
      }) do
    user = conn.assigns.current_user

    case Accounts.change_password(user.id, current_password, new_password) do
      {:ok, _user} ->
        json(conn, %{
          success: true,
          message: "Password successfully changed"
        })

      {:error, :not_email_user} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Password changes are only available for email-authenticated accounts"
        })

      {:error, :invalid_current_password} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{
          success: false,
          error: "Current password is incorrect"
        })

      {:error, changeset} ->
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Enum.reduce(opts, msg, fn {key, value}, acc ->
              String.replace(acc, "%{#{key}}", to_string(value))
            end)
          end)

        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Invalid password",
          errors: errors
        })
    end
  end
end
