defmodule ClippsterServer.BetaCodes do
  @moduledoc """
  Context module for managing beta codes used in controlled beta launches.
  """
  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.BetaCodes.BetaCode
  alias ClippsterServer.Accounts

  # Characters used for generating codes (excluding confusing chars like 0/O, 1/I/l)
  @code_chars ~c"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  @code_length 8

  @doc """
  Generates N unique beta codes.
  Returns {:ok, codes} on success or {:error, reason} on failure.
  """
  def generate_codes(count) when is_integer(count) and count > 0 do
    codes = Enum.map(1..count, fn _ -> generate_unique_code() end)

    Repo.transaction(fn ->
      Enum.map(codes, fn code ->
        %BetaCode{}
        |> BetaCode.changeset(%{code: code})
        |> Repo.insert!()
      end)
    end)
  end

  @doc """
  Validates a beta code and marks it as used by the given user.
  Also activates the user's beta status.
  Returns {:ok, beta_code} on success or {:error, reason} on failure.
  """
  def validate_and_use_code(code, user_id) when is_binary(code) do
    # Normalize code to uppercase
    normalized_code = String.upcase(String.trim(code))

    Repo.transaction(fn ->
      case get_available_code(normalized_code) do
        nil ->
          Repo.rollback(:invalid_code)

        beta_code ->
          # Mark code as used
          {:ok, updated_code} =
            beta_code
            |> BetaCode.use_changeset(user_id)
            |> Repo.update()

          # Activate user's beta status
          case Accounts.activate_user_beta(user_id) do
            {:ok, _user} -> updated_code
            {:error, reason} -> Repo.rollback(reason)
          end
      end
    end)
  end

  @doc """
  Lists all beta codes with their usage status.
  """
  def list_codes do
    BetaCode
    |> order_by([c], desc: c.inserted_at)
    |> preload(:used_by_user)
    |> Repo.all()
  end

  @doc """
  Gets statistics about beta codes.
  Returns a map with total, used, and available counts.
  """
  def get_code_stats do
    total = Repo.aggregate(BetaCode, :count)
    used = Repo.aggregate(from(c in BetaCode, where: not is_nil(c.used_by_user_id)), :count)

    %{
      total: total,
      used: used,
      available: total - used
    }
  end

  @doc """
  Gets a single beta code by its code string.
  """
  def get_code(code) when is_binary(code) do
    normalized_code = String.upcase(String.trim(code))
    Repo.get_by(BetaCode, code: normalized_code)
  end

  @doc """
  Deletes unused beta codes.
  """
  def delete_unused_codes do
    from(c in BetaCode, where: is_nil(c.used_by_user_id))
    |> Repo.delete_all()
  end

  @doc """
  Deletes a specific beta code by ID.
  Returns {:ok, beta_code} on success or {:error, reason} on failure.
  """
  def delete_code(code_id) when is_integer(code_id) do
    case Repo.get(BetaCode, code_id) do
      nil ->
        {:error, :not_found}

      beta_code ->
        Repo.delete(beta_code)
    end
  end

  @doc """
  Generates a single beta code assigned to a specific email.
  Returns {:ok, beta_code} on success or {:error, changeset} on failure.
  """
  def generate_assigned_code(email) when is_binary(email) do
    code = generate_unique_code()

    %BetaCode{}
    |> BetaCode.changeset(%{code: code, assigned_email: email})
    |> Repo.insert()
  end

  @doc """
  Verifies a beta code for landing page access and records verification.
  Returns {:ok, beta_code} if valid, {:error, reason} if invalid.
  """
  def verify_code_for_landing(code, ip_address) when is_binary(code) do
    normalized_code = String.upcase(String.trim(code))

    case get_available_code(normalized_code) do
      nil ->
        {:error, :invalid_code}

      beta_code ->
        beta_code
        |> BetaCode.verify_changeset(ip_address)
        |> Repo.update()
    end
  end

  # Private functions

  defp generate_unique_code do
    code = generate_code()

    # Check if code already exists, regenerate if it does
    case get_code(code) do
      nil -> code
      _ -> generate_unique_code()
    end
  end

  defp generate_code do
    chars_list = Enum.to_list(@code_chars)

    1..@code_length
    |> Enum.map(fn _ -> Enum.random(chars_list) end)
    |> List.to_string()
  end

  defp get_available_code(code) do
    BetaCode
    |> where([c], c.code == ^code and is_nil(c.used_by_user_id))
    |> Repo.one()
  end
end
