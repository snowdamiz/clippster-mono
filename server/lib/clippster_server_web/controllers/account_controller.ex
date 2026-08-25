defmodule ClippsterServerWeb.AccountController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Accounts
  alias ClippsterServer.Auth.TokenGenerator

  @doc """
  Requests an email change. Sends OTP + magic link to the new address.

  Email users: requires `password` (current).
  OAuth users converting to email: requires `new_password`.
  """
  def change_email(conn, %{"new_email" => new_email} = params) do
    user = conn.assigns.current_user

    opts =
      cond do
        is_binary(params["new_password"]) and params["new_password"] != "" ->
          %{new_password: params["new_password"]}

        is_binary(params["password"]) ->
          %{password: params["password"]}

        true ->
          %{}
      end

    case Accounts.change_email(user.id, new_email, opts) do
      {:ok, pending_user} ->
        converting = user.provider != "email" and is_binary(pending_user.email_change_password_hash)

        json(conn, %{
          success: true,
          message: "Verification code sent to #{pending_user.email_change_new_email}.",
          pending_email: pending_user.email_change_new_email,
          otp_required: true,
          converting_from_oauth: converting
        })

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: "User not found"})

      {:error, :not_email_user} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Email changes are not available for this account type"
        })

      {:error, :new_password_required} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          error: "Set a password to switch from Google to email login"
        })

      {:error, :invalid_password} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{success: false, error: "Invalid password"})

      {:error, :email_already_in_use} ->
        conn
        |> put_status(:conflict)
        |> json(%{success: false, error: "This email address is already in use"})

      {:error, :invalid_email} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Invalid email address"})

      {:error, %Ecto.Changeset{} = changeset} ->
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Enum.reduce(opts, msg, fn {key, value}, acc ->
              String.replace(acc, "%{#{key}}", to_string(value))
            end)
          end)

        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Invalid password", errors: errors})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: "Failed to change email. Please try again."})
    end
  end

  def change_email(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "new_email is required"})
  end

  @doc """
  Verifies a pending email change with the OTP from the new inbox.
  """
  def verify_email_change_otp(conn, %{"otp" => otp}) do
    user = conn.assigns.current_user

    case Accounts.verify_email_change_otp(user.id, otp) do
      {:ok, updated_user} ->
        case issue_user_token(updated_user) do
          {:ok, token} ->
            json(conn, %{
              success: true,
              message: "Email successfully changed to #{updated_user.email}",
              token: token,
              user: user_payload(updated_user)
            })

          {:error, _} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{success: false, error: "Email changed but failed to issue session token"})
        end

      {:error, :no_change_pending} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "No email change is pending"})

      {:error, :invalid_otp} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{success: false, error: "Invalid verification code"})

      {:error, :otp_expired} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Verification code expired. Please request a new one."})

      {:error, :too_many_attempts} ->
        conn
        |> put_status(:too_many_requests)
        |> json(%{
          success: false,
          error: "Too many attempts. Please request a new verification code."
        })

      {:error, :email_already_in_use} ->
        conn
        |> put_status(:conflict)
        |> json(%{success: false, error: "This email address is already in use"})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: "Failed to verify email change"})
    end
  end

  def verify_email_change_otp(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "otp is required"})
  end

  @doc """
  Resends OTP + magic link for a pending email change.
  """
  def resend_email_change(conn, _params) do
    user = conn.assigns.current_user

    case Accounts.resend_email_change_verification(user.id) do
      {:ok, pending_user} ->
        json(conn, %{
          success: true,
          message: "Verification code resent to #{pending_user.email_change_new_email}",
          pending_email: pending_user.email_change_new_email
        })

      {:error, :no_change_pending} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "No email change is pending"})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: "Failed to resend verification code"})
    end
  end

  @doc """
  Verifies email change using verification token (magic link).
  """
  def verify_email_change(conn, %{"token" => token}) do
    case Accounts.verify_email_change(token) do
      {:ok, user} ->
        json(conn, %{
          success: true,
          message: "Email successfully changed to #{user.email}",
          user: user_payload(user)
        })

      {:error, :invalid_token} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Invalid or expired verification link"})

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
        |> json(%{success: false, error: "This email address is already in use"})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: "Failed to verify email change. Please try again."})
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

  defp user_payload(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      provider: user.provider,
      provider_id: user.provider_id
    }
  end

  defp issue_user_token(user) do
    TokenGenerator.generate_token(%{
      "sub" => "#{user.provider}:#{user.provider_id}",
      "iat" => DateTime.utc_now() |> DateTime.to_unix(),
      "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
      "provider" => user.provider,
      "provider_id" => user.provider_id,
      "user_id" => user.id,
      "is_admin" => user.is_admin,
      "is_moderator" => user.is_moderator,
      "email" => user.email
    })
  end
end
