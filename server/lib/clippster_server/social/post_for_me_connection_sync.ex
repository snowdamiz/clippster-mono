defmodule ClippsterServer.Social.PostForMeConnectionSync do
  @moduledoc """
  Shared Post For Me connect completion logic for user/org flows.
  """

  alias ClippsterServer.{Accounts, Campaigns, Social}
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.Providers.PostForMe

  def complete_user_connect(user, account_ids, external_id, platform) do
    with {:ok, listing} <- list_provider_accounts(account_ids, external_id, platform),
         {:ok, synced_accounts} <- upsert_user_accounts(user, listing.data, platform) do
      {:ok,
       %{
         platform: normalized_primary_platform(synced_accounts, platform),
         primary_account: pick_primary_account(synced_accounts, platform),
         accounts: synced_accounts,
         provider_accounts: listing.data,
         account_ids: extract_account_ids(listing.data)
       }}
    end
  end

  def complete_org_connect(org_id, user, account_ids, external_id, platform) do
    with {:ok, listing} <- list_provider_accounts(account_ids, external_id, platform),
         {:ok, synced_accounts} <- upsert_org_accounts(org_id, user, listing.data, platform) do
      {:ok,
       %{
         platform: normalized_primary_platform(synced_accounts, platform),
         primary_account: pick_primary_account(synced_accounts, platform),
         accounts: synced_accounts,
         provider_accounts: listing.data,
         account_ids: extract_account_ids(listing.data)
       }}
    end
  end

  def complete_session_connect(%PostForMeConnectionSession{} = session, opts \\ %{}) do
    account_ids =
      Map.get(opts, :account_ids, Map.get(opts, "account_ids")) ||
        extract_account_ids_from_payload(session.callback_payload)

    platform = normalize_optional_platform(Map.get(opts, :platform, session.platform))

    with {:ok, user} <- fetch_user(session.user_id) do
      case session.scope do
        "org" ->
          case session.organization_id do
            nil ->
              {:error, :missing_organization_id}

            org_id ->
              complete_org_connect(org_id, user, account_ids, session.external_id, platform)
          end

        "user" ->
          complete_user_connect(user, account_ids, session.external_id, platform)

        _ ->
          {:error, :invalid_scope}
      end
    end
  end

  def parse_account_ids(params) when is_map(params) do
    [
      params["account_id"],
      params["account_ids"],
      params["accountIds"],
      params["account_ids[]"]
    ]
    |> Enum.flat_map(&normalize_account_id_param/1)
    |> Enum.uniq()
  end

  def parse_account_ids(_), do: []

  def extract_account_ids_from_payload(payload) when is_map(payload) do
    parse_account_ids(payload)
  end

  def extract_account_ids_from_payload(_), do: []

  def normalize_optional_platform(nil), do: nil

  def normalize_optional_platform(platform) when is_binary(platform) do
    case ProviderMode.normalize_platform(platform) do
      "" -> nil
      normalized -> normalized
    end
  end

  def normalize_optional_platform(_), do: nil

  defp fetch_user(user_id) do
    case Accounts.get_user(user_id) do
      nil -> {:error, :user_not_found}
      user -> {:ok, user}
    end
  end

  defp list_provider_accounts(account_ids, external_id, platform) do
    with {:ok, filters} <- build_post_for_me_filters(account_ids, external_id, platform),
         {:ok, listing} <- PostForMe.list_social_accounts(filters) do
      {:ok, listing}
    else
      {:error, :missing_identifiers} -> {:error, :missing_identifiers}
      {:error, reason} -> {:error, {:provider, reason}}
    end
  end

  defp build_post_for_me_filters(account_ids, external_id, platform) do
    filters =
      %{}
      |> maybe_put_filter(:id, normalize_account_ids(account_ids))
      |> maybe_put_filter(:external_id, external_id)
      |> maybe_put_filter(:platform, normalize_optional_platform(platform))

    if map_size(filters) == 0 do
      {:error, :missing_identifiers}
    else
      {:ok, filters}
    end
  end

  defp maybe_put_filter(filters, _key, nil), do: filters
  defp maybe_put_filter(filters, _key, []), do: filters
  defp maybe_put_filter(filters, key, value), do: Map.put(filters, key, value)

  defp normalize_account_ids(account_ids) when is_list(account_ids) do
    account_ids
    |> Enum.flat_map(&normalize_account_id_param/1)
    |> Enum.uniq()
  end

  defp normalize_account_ids(account_id), do: normalize_account_id_param(account_id)

  defp normalize_account_id_param(nil), do: []

  defp normalize_account_id_param(value) when is_binary(value) do
    trimmed = String.trim(value)

    cond do
      trimmed == "" ->
        []

      String.starts_with?(trimmed, "[") and String.ends_with?(trimmed, "]") ->
        trimmed
        |> String.trim_leading("[")
        |> String.trim_trailing("]")
        |> String.split(",")
        |> Enum.map(&String.trim/1)
        |> Enum.map(&String.trim(&1, "\"'"))
        |> Enum.reject(&(&1 == ""))

      true ->
        trimmed
        |> String.split(",", trim: true)
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))
    end
  end

  defp normalize_account_id_param(value) when is_list(value) do
    Enum.flat_map(value, &normalize_account_id_param/1)
  end

  defp normalize_account_id_param(value), do: [to_string(value)]

  defp extract_account_ids(provider_accounts) when is_list(provider_accounts) do
    provider_accounts
    |> Enum.map(& &1.id)
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&to_string/1)
    |> Enum.uniq()
  end

  defp upsert_user_accounts(user, provider_accounts, platform_override)
       when is_list(provider_accounts) do
    provider_accounts
    |> Enum.reduce_while({:ok, []}, fn provider_account, {:ok, acc} ->
      if provider_account.status == "disconnected" do
        {:cont, {:ok, acc}}
      else
        attrs = provider_account_to_user_attrs(provider_account, platform_override)

        case upsert_user_account(user, attrs) do
          {:ok, account} -> {:cont, {:ok, [account | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end
    end)
    |> case do
      {:ok, accounts} -> {:ok, Enum.reverse(accounts)}
      other -> other
    end
  end

  defp upsert_user_account(user, attrs) do
    case Campaigns.get_social_account_by_provider(
           user.id,
           "post_for_me",
           attrs.provider_account_id
         ) do
      nil ->
        Campaigns.create_social_account(user, attrs)

      existing ->
        Campaigns.update_social_account(existing, attrs, user)
    end
  end

  defp provider_account_to_user_attrs(provider_account, platform_override) do
    normalized_platform =
      provider_account.platform
      |> normalize_optional_platform()
      |> case do
        nil -> platform_override || "x"
        platform -> platform
      end

    platform_user_id = provider_account.user_id || provider_account.id
    username = provider_account.username || platform_user_id || provider_account.id

    %{
      platform: normalized_platform,
      platform_user_id: platform_user_id,
      provider: "post_for_me",
      provider_platform: provider_account.platform || normalized_platform,
      provider_account_id: provider_account.id,
      provider_payload: provider_account.raw,
      username: username,
      display_name: provider_display_name(provider_account),
      profile_image_url: provider_account.profile_photo_url,
      profile_url: extract_profile_url(provider_account, normalized_platform, username),
      is_verified: extract_verified_status(provider_account),
      is_active: provider_account.status != "disconnected"
    }
  end

  defp extract_profile_url(provider_account, platform, username) do
    # Try metadata first
    profile_url =
      get_in(provider_account.metadata, ["profile_url"]) ||
        get_in(provider_account.raw, ["profile_url"])

    if profile_url do
      profile_url
    else
      # Construct from platform and username
      construct_profile_url(platform, username)
    end
  end

  defp construct_profile_url(platform, username) when is_binary(username) do
    clean_username = String.replace(username, "@", "")

    case platform do
      "instagram" -> "https://instagram.com/#{clean_username}"
      "tiktok" -> "https://tiktok.com/@#{clean_username}"
      "twitter" -> "https://twitter.com/#{clean_username}"
      "x" -> "https://twitter.com/#{clean_username}"
      "youtube" -> "https://youtube.com/@#{clean_username}"
      "twitch" -> "https://twitch.tv/#{clean_username}"
      "kick" -> "https://kick.com/#{clean_username}"
      _ -> nil
    end
  end

  defp construct_profile_url(_, _), do: nil

  defp extract_verified_status(provider_account) do
    get_in(provider_account.metadata, ["is_verified"]) ||
      get_in(provider_account.metadata, ["verified"]) ||
      get_in(provider_account.raw, ["is_verified"]) ||
      get_in(provider_account.raw, ["verified"]) ||
      false
  end

  defp upsert_org_accounts(org_id, user, provider_accounts, platform_override)
       when is_list(provider_accounts) do
    provider_accounts
    |> Enum.reduce_while({:ok, []}, fn provider_account, {:ok, acc} ->
      if provider_account.status == "disconnected" do
        {:cont, {:ok, acc}}
      else
        attrs = provider_account_to_org_attrs(provider_account, platform_override)

        case upsert_org_account(org_id, user, attrs) do
          {:ok, account} -> {:cont, {:ok, [account | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end
    end)
    |> case do
      {:ok, accounts} -> {:ok, Enum.reverse(accounts)}
      other -> other
    end
  end

  defp upsert_org_account(org_id, user, attrs) do
    case Social.get_social_account_by_provider(org_id, "post_for_me", attrs.provider_account_id) do
      nil ->
        Social.create_social_account(org_id, attrs, user)

      existing ->
        Social.update_social_account(existing, attrs)
    end
  end

  defp provider_account_to_org_attrs(provider_account, platform_override) do
    normalized_platform =
      provider_account.platform
      |> normalize_optional_platform()
      |> case do
        nil -> platform_override || "x"
        platform -> platform
      end

    platform_user_id = provider_account.user_id || provider_account.id
    username = provider_account.username || platform_user_id || provider_account.id

    %{
      platform: normalized_platform,
      platform_user_id: platform_user_id,
      provider: "post_for_me",
      provider_platform: provider_account.platform || normalized_platform,
      provider_account_id: provider_account.id,
      provider_payload: provider_account.raw,
      username: username,
      display_name: provider_display_name(provider_account),
      profile_image_url: provider_account.profile_photo_url,
      profile_url: extract_profile_url(provider_account, normalized_platform, username),
      is_verified: extract_verified_status(provider_account),
      is_active: provider_account.status != "disconnected"
    }
  end

  defp provider_display_name(%PostForMe.SocialAccount{metadata: metadata})
       when is_map(metadata) do
    metadata["display_name"] || metadata["name"] || metadata["full_name"]
  end

  defp provider_display_name(_), do: nil

  defp pick_primary_account([], _platform), do: nil
  defp pick_primary_account([first | _], nil), do: first

  defp pick_primary_account(accounts, platform) do
    Enum.find(accounts, fn account -> account.platform == platform end) || List.first(accounts)
  end

  defp normalized_primary_platform(accounts, platform) do
    case pick_primary_account(accounts, platform) do
      nil -> nil
      account -> account.platform
    end
  end
end
