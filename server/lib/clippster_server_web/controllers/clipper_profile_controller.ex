defmodule ClippsterServerWeb.ClipperProfileController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Campaigns

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Social Accounts
  # ============================================================================

  @doc """
  List social accounts for the current user.
  """
  def list_social_accounts(conn, _params) do
    user = conn.assigns.current_user
    accounts = Campaigns.list_user_social_accounts(user.id)

    json(conn, %{
      success: true,
      social_accounts: Enum.map(accounts, &serialize_social_account/1)
    })
  end

  @doc """
  Create a social account.
  """
  def create_social_account(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      platform: Map.get(params, "platform"),
      platform_user_id: Map.get(params, "platform_user_id"),
      username: Map.get(params, "username"),
      display_name: Map.get(params, "display_name"),
      profile_url: Map.get(params, "profile_url"),
      follower_count: Map.get(params, "follower_count")
    }

    case Campaigns.create_social_account(user, attrs) do
      {:ok, account} ->
        json(conn, %{
          success: true,
          social_account: serialize_social_account(account)
        })

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  Update a social account.
  """
  def update_social_account(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    case Campaigns.get_social_account(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Social account not found"})

      account ->
        attrs = Map.take(params, ["username", "display_name", "profile_url", "follower_count"])

        case Campaigns.update_social_account(account, attrs, user) do
          {:ok, updated} ->
            json(conn, %{
              success: true,
              social_account: serialize_social_account(updated)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Delete a social account.
  """
  def delete_social_account(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_social_account(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Social account not found"})

      account ->
        case Campaigns.delete_social_account(account, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Payment Methods
  # ============================================================================

  @doc """
  List payment methods for the current user.
  """
  def list_payment_methods(conn, _params) do
    user = conn.assigns.current_user
    methods = Campaigns.list_user_payment_methods(user.id)

    json(conn, %{
      success: true,
      payment_methods: Enum.map(methods, &serialize_payment_method/1)
    })
  end

  @doc """
  Create a payment method.
  """
  def create_payment_method(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      method_type: Map.get(params, "method_type"),
      details: encode_details(Map.get(params, "details")),
      is_default: Map.get(params, "is_default", false)
    }

    case Campaigns.create_payment_method(user, attrs) do
      {:ok, method} ->
        json(conn, %{
          success: true,
          payment_method: serialize_payment_method(method)
        })

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  Update a payment method.
  """
  def update_payment_method(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    case Campaigns.get_payment_method(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Payment method not found"})

      method ->
        attrs = %{}
        attrs = if Map.has_key?(params, "details"), do: Map.put(attrs, :details, encode_details(Map.get(params, "details"))), else: attrs
        attrs = if Map.has_key?(params, "is_default"), do: Map.put(attrs, :is_default, Map.get(params, "is_default")), else: attrs

        case Campaigns.update_payment_method(method, attrs, user) do
          {:ok, updated} ->
            json(conn, %{
              success: true,
              payment_method: serialize_payment_method(updated)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Delete a payment method.
  """
  def delete_payment_method(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_payment_method(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Payment method not found"})

      method ->
        case Campaigns.delete_payment_method(method, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Serializers
  # ============================================================================

  defp serialize_social_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      platform_user_id: account.platform_user_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      is_verified: account.is_verified,
      is_active: account.is_active,
      token_expires_at: account.token_expires_at,
      connected_at: account.connected_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }
  end

  defp serialize_payment_method(method) do
    %{
      id: method.id,
      method_type: method.method_type,
      details: decode_details(method.details),
      is_default: method.is_default,
      inserted_at: method.inserted_at,
      updated_at: method.updated_at
    }
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp format_errors(error) when is_binary(error), do: error
  defp format_errors(error), do: inspect(error)

  defp encode_details(nil), do: nil
  defp encode_details(details) when is_map(details) do
    Jason.encode!(details)
  end
  defp encode_details(details) when is_binary(details), do: details

  defp decode_details(nil), do: nil
  defp decode_details(details) when is_binary(details) do
    case Jason.decode(details) do
      {:ok, decoded} -> decoded
      _ -> %{}
    end
  end
  defp decode_details(_), do: %{}
end
