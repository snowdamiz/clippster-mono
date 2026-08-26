defmodule ClippsterServer.Social.SchedulingAccountValidator do
  @moduledoc """
  Validates scheduled-post account ownership and provider routing before persistence.
  """

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Organizations
  alias ClippsterServer.Social
  alias ClippsterServer.Social.PublishingProvider
  alias ClippsterServer.Tokend.Publisher

  @spec validate(map(), map(), String.t(), keyword()) :: {:ok, map()} | {:error, atom()}
  def validate(params, user, owner_type, opts \\ [])

  def validate(params, user, "user", opts) do
    loader = Keyword.get(opts, :user_account_loader, &Campaigns.get_social_account/1)

    with account_id when account_id not in [nil, ""] <- params["user_social_account_id"],
         account when not is_nil(account) <- loader.(account_id),
         true <- account.user_id == user.id || {:error, :unauthorized},
         :ok <- validate_common(account, params["platform"]) do
      {:ok, account}
    else
      nil -> {:error, :account_not_found}
      false -> {:error, :account_not_found}
      {:error, _} = error -> error
      _ -> {:error, :account_not_found}
    end
  end

  def validate(params, user, "org", opts) do
    loader = Keyword.get(opts, :org_account_loader, &Social.get_social_account/1)
    access_fun = Keyword.get(opts, :org_access, &Social.has_account_access?/3)
    membership_fun = Keyword.get(opts, :org_membership, &Organizations.is_member?/2)
    org_id = params["organization_id"]

    with true <- membership_fun.(org_id, user.id) || {:error, :unauthorized},
         account_id when account_id not in [nil, ""] <- params["social_account_id"],
         account when not is_nil(account) <- loader.(account_id),
         true <- account.organization_id == parse_id(org_id) || {:error, :unauthorized},
         true <- access_fun.(org_id, account_id, user.id) || {:error, :unauthorized},
         :ok <- validate_common(account, params["platform"]) do
      {:ok, account}
    else
      nil -> {:error, :account_not_found}
      false -> {:error, :account_not_found}
      {:error, _} = error -> error
      _ -> {:error, :account_not_found}
    end
  end

  def validate(_params, _user, _owner_type, _opts), do: {:error, :invalid_owner_type}

  defp validate_common(account, platform) do
    with true <- account.is_active || {:error, :account_inactive},
         true <- account.platform == platform || {:error, :platform_mismatch},
         {:ok, provider} <- PublishingProvider.route(account),
         :ok <- validate_capability(provider, account) do
      :ok
    end
  end

  defp validate_capability(:post_for_me, _account), do: :ok
  defp validate_capability(:tokend, account), do: Publisher.readiness(account)

  defp parse_id(id) when is_integer(id), do: id

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed, ""} -> parsed
      _ -> id
    end
  end

  defp parse_id(id), do: id
end
