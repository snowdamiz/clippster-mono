defmodule ClippsterServer.Social.PostForMeConnectionSync do
  @moduledoc """
  Shared Post For Me connect completion logic for user/org flows.
  """

  require Logger

  alias ClippsterServer.{Accounts, Campaigns, Social, Repo}
  alias ClippsterServer.Campaigns.ClipperSocialAccount
  alias ClippsterServer.Campaigns.UserPost
  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.Providers.PostForMe
  alias ClippsterServer.Social.UserPostsAnalyticsSync

  import Ecto.Query

  @doc """
  Resolves the Post For Me external_id for an existing provider account.

  Reconnect must reuse this value — creating a new external_id causes
  "External Id already exists for account" errors from Post For Me.
  """
  def resolve_provider_external_id(provider_account_id) when is_binary(provider_account_id) do
    trimmed = String.trim(provider_account_id)

    if trimmed == "" do
      {:error, :missing_provider_account_id}
    else
      case PostForMe.get_social_account(trimmed) do
        {:ok, account} ->
          case account.external_id do
            external_id when is_binary(external_id) and external_id != "" ->
              {:ok, external_id}

            _ ->
              {:error, :missing_external_id}
          end

        {:error, _} ->
          with {:ok, listing} <- PostForMe.list_social_accounts(%{id: trimmed}),
               account when not is_nil(account) <- find_provider_account(listing.data, trimmed) do
            case account.external_id do
              external_id when is_binary(external_id) and external_id != "" ->
                {:ok, external_id}

              _ ->
                {:error, :missing_external_id}
            end
          else
            _ -> {:error, :provider_account_not_found}
          end
      end
    end
  end

  def resolve_provider_external_id(_), do: {:error, :missing_provider_account_id}

  def resolve_provider_external_id_from_payload(%{provider_payload: payload})
      when is_map(payload) do
    case Map.get(payload, "external_id") || Map.get(payload, :external_id) do
      external_id when is_binary(external_id) and external_id != "" -> {:ok, external_id}
      _ -> {:error, :missing_external_id}
    end
  end

  def resolve_provider_external_id_from_payload(_), do: {:error, :missing_external_id}

  def build_user_connect_session_attrs(user, platform, params, return_mode, return_url) do
    base = %{
      scope: "user",
      user_id: user.id,
      platform: platform,
      return_mode: return_mode,
      return_url: return_url
    }

    case reconnect_requested?(params) do
      true ->
        with {:ok, provider_account_id, local_account} <-
               resolve_user_reconnect_account(user, params),
             {:ok, external_id} <-
               resolve_reconnect_external_id(provider_account_id, local_account) do
          {:ok,
           Map.merge(base, %{
             external_id: external_id,
             account_ids: [provider_account_id],
             reconnect: true
           })}
        end

      false ->
        {:ok, base}
    end
  end

  def build_org_connect_session_attrs(org_id, user_id, platform, params, return_mode, return_url) do
    base = %{
      scope: "org",
      organization_id: org_id,
      user_id: user_id,
      platform: platform,
      return_mode: return_mode,
      return_url: return_url
    }

    case reconnect_requested?(params) do
      true ->
        with {:ok, provider_account_id, local_account} <-
               resolve_org_reconnect_account(org_id, params),
             {:ok, external_id} <-
               resolve_reconnect_external_id(provider_account_id, local_account) do
          {:ok,
           Map.merge(base, %{
             external_id: external_id,
             account_ids: [provider_account_id],
             reconnect: true
           })}
        end

      false ->
        {:ok, base}
    end
  end

  defp reconnect_requested?(params) when is_map(params) do
    provider_id = params["provider_account_id"] || params["providerAccountId"]
    social_id = params["social_account_id"] || params["socialAccountId"]

    (is_binary(provider_id) and String.trim(provider_id) != "") or
      parse_optional_integer(social_id) != nil
  end

  defp reconnect_requested?(_), do: false

  defp resolve_user_reconnect_account(user, params) do
    provider_account_id = params["provider_account_id"] || params["providerAccountId"]
    social_account_id = parse_optional_integer(params["social_account_id"] || params["socialAccountId"])

    cond do
      is_binary(provider_account_id) and String.trim(provider_account_id) != "" ->
        trimmed = String.trim(provider_account_id)

        case Campaigns.get_social_account_by_provider(user.id, "post_for_me", trimmed) do
          nil -> {:error, :account_not_found}
          account -> {:ok, trimmed, account}
        end

      not is_nil(social_account_id) ->
        case Campaigns.get_social_account(social_account_id) do
          %{user_id: account_user_id} = account when account_user_id == user.id ->
            if is_binary(account.provider_account_id) and account.provider_account_id != "" do
              {:ok, account.provider_account_id, account}
            else
              {:error, :missing_provider_account_id}
            end

          _ ->
            {:error, :account_not_found}
        end

      true ->
        {:error, :missing_reconnect_account}
    end
  end

  defp resolve_org_reconnect_account(org_id, params) do
    provider_account_id = params["provider_account_id"] || params["providerAccountId"]
    social_account_id = parse_optional_integer(params["social_account_id"] || params["socialAccountId"])

    cond do
      is_binary(provider_account_id) and String.trim(provider_account_id) != "" ->
        trimmed = String.trim(provider_account_id)

        case Social.get_social_account_by_provider(org_id, "post_for_me", trimmed) do
          nil -> {:error, :account_not_found}
          account -> {:ok, trimmed, account}
        end

      not is_nil(social_account_id) ->
        case Social.get_social_account(social_account_id) do
          %{organization_id: account_org_id} = account when account_org_id == org_id ->
            if is_binary(account.provider_account_id) and account.provider_account_id != "" do
              {:ok, account.provider_account_id, account}
            else
              {:error, :missing_provider_account_id}
            end

          _ ->
            {:error, :account_not_found}
        end

      true ->
        {:error, :missing_reconnect_account}
    end
  end

  defp resolve_reconnect_external_id(provider_account_id, local_account) do
    case resolve_provider_external_id(provider_account_id) do
      {:ok, external_id} ->
        {:ok, external_id}

      {:error, _} ->
        resolve_provider_external_id_from_payload(local_account)
    end
  end

  defp parse_optional_integer(value) when is_integer(value), do: value

  defp parse_optional_integer(value) when is_binary(value) do
    case Integer.parse(String.trim(value)) do
      {parsed, _} -> parsed
      :error -> nil
    end
  end

  defp parse_optional_integer(_), do: nil

  def complete_user_connect(user, account_ids, external_id, platform) do
    with {:ok, listing} <- list_provider_accounts(account_ids, external_id, platform),
         {:ok, synced_accounts} <- upsert_user_accounts(user, listing.data, platform) do
      reassign_user_posts_to_connected_accounts(user, synced_accounts)
      Task.start(fn -> UserPostsAnalyticsSync.sync_for_user(user.id) end)

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

  defp find_provider_account(accounts, provider_account_id) when is_list(accounts) do
    Enum.find(accounts, fn account -> account.id == provider_account_id end)
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
    existing =
      Campaigns.get_social_account_by_provider(
        user.id,
        "post_for_me",
        attrs.provider_account_id
      ) || find_existing_user_account_by_platform_identity(user.id, attrs)

    case existing do
      nil ->
        Campaigns.create_social_account(user, attrs)

      account ->
        Campaigns.update_social_account(account, attrs, user)
    end
  end

  defp find_existing_user_account_by_platform_identity(user_id, attrs) do
    platform = Map.get(attrs, :platform)
    platform_user_id = Map.get(attrs, :platform_user_id)

    if is_binary(platform) and platform != "" and is_binary(platform_user_id) and
         platform_user_id != "" do
      platform_aliases = platform_identity_aliases(platform)

      from(a in ClipperSocialAccount,
        where: a.user_id == ^user_id,
        where: a.provider == "post_for_me",
        where: a.platform in ^platform_aliases,
        where: a.platform_user_id == ^platform_user_id,
        order_by: [desc: a.updated_at],
        limit: 1
      )
      |> Repo.one()
    else
      nil
    end
  end

  defp platform_identity_aliases(platform) do
    normalized = ProviderMode.normalize_platform(platform)

    case normalized do
      "x" -> ["x", "twitter"]
      "twitter" -> ["x", "twitter"]
      other -> [other]
    end
  end

  @doc """
  Moves published posts from inactive duplicate Post For Me accounts onto the active account
  for the same platform identity after reconnect.
  """
  def reassign_user_posts_to_connected_accounts(user, accounts) when is_list(accounts) do
    Enum.each(accounts, fn account ->
      inactive_account_ids =
        from(a in ClipperSocialAccount,
          where: a.user_id == ^user.id,
          where: a.id != ^account.id,
          where: a.platform in ^platform_identity_aliases(account.platform),
          where: a.is_active == false,
          select: a.id
        )
        |> Repo.all()

      if inactive_account_ids != [] do
        {updated, _} =
          from(p in UserPost,
            where: p.user_id == ^user.id,
            where: p.clipper_social_account_id in ^inactive_account_ids
          )
          |> Repo.update_all(set: [clipper_social_account_id: account.id])

        if updated > 0 do
          Logger.info(
            "[PostForMeConnectionSync] Reassigned #{updated} user posts to account #{account.id} (#{account.platform})"
          )
        end
      end
    end)
  end

  def reassign_user_posts_to_connected_accounts(_user, _accounts), do: :ok

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
      is_active: provider_account.status != "disconnected",
      token_expires_at: extract_token_expires_at(provider_account)
    }
  end

  def extract_token_expires_at(provider_account) do
    raw = provider_account.raw || %{}

    expires_at_str =
      raw["access_token_expires_at"] ||
        get_in(provider_account.metadata || %{}, ["access_token_expires_at"]) ||
        raw["token_expires_at"]

    parse_token_expires_at(expires_at_str)
  end

  defp parse_token_expires_at(expires_at_str) when is_binary(expires_at_str) do
    case DateTime.from_iso8601(expires_at_str) do
      {:ok, dt, _} -> DateTime.truncate(dt, :second)
      _ -> nil
    end
  end

  defp parse_token_expires_at(_), do: nil

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
      is_active: provider_account.status != "disconnected",
      token_expires_at: extract_token_expires_at(provider_account)
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

  @doc """
  Refreshes provider connection state on local Post For Me accounts (best-effort).
  Syncs `is_active` from provider status and `token_expires_at` when available.
  """
  def sync_user_accounts_from_provider(user) do
    user.id
    |> Campaigns.list_user_social_accounts()
    |> sync_provider_accounts(&update_user_from_provider/2)
  end

  def sync_org_accounts_from_provider(accounts) do
    sync_provider_accounts(accounts, &update_org_from_provider/2)
  end

  @doc false
  def sync_user_token_expiry(user), do: sync_user_accounts_from_provider(user)

  @doc false
  def sync_org_token_expiry(accounts), do: sync_org_accounts_from_provider(accounts)

  def sync_user_account_for_publish(%ClipperSocialAccount{} = account) do
    [account]
    |> sync_provider_accounts(&update_user_from_provider/2)
    |> List.first()
  end

  def sync_org_account_for_publish(%Social.SocialAccount{} = account) do
    [account]
    |> sync_provider_accounts(&update_org_from_provider/2)
    |> List.first()
  end

  def ensure_user_publish_ready(%ClipperSocialAccount{} = account, platform_label) do
    account = sync_user_account_for_publish(account)

    case ClippsterServer.Social.PostForMeAccountHealth.validate_publishable(
           account,
           platform_label
         ) do
      :ok -> {:ok, account}
      {:error, :token_expired, message} -> {:error, :token_expired, message}
    end
  end

  def ensure_org_publish_ready(%SocialAccount{} = account, platform_label) do
    account = sync_org_account_for_publish(account)

    case ClippsterServer.Social.PostForMeAccountHealth.validate_publishable(
           account,
           platform_label
         ) do
      :ok -> {:ok, account}
      {:error, :token_expired, message} -> {:error, :token_expired, message}
    end
  end

  defp sync_provider_accounts(accounts, update_fn) do
    provider_accounts =
      Enum.filter(accounts, fn account ->
        account.provider == "post_for_me" and is_binary(account.provider_account_id)
      end)

    if provider_accounts == [] do
      accounts
    else
      case PostForMe.list_social_accounts(%{}) do
        {:ok, listing} ->
          provider_by_id = Map.new(listing.data, &{&1.id, &1})

          Enum.map(accounts, fn account ->
            # Only refresh Post For Me rows — native providers (e.g. Tokend) must not
            # match by coincidental provider_account_id against the PFM catalog.
            if account.provider == "post_for_me" and is_binary(account.provider_account_id) do
              case Map.get(provider_by_id, account.provider_account_id) do
                nil ->
                  account

                provider_account ->
                  attrs = provider_status_attrs(provider_account)

                  if provider_state_changed?(account, attrs) do
                    case update_fn.(account, attrs) do
                      {:ok, updated} -> updated
                      _ -> account
                    end
                  else
                    account
                  end
              end
            else
              account
            end
          end)

        _ ->
          accounts
      end
    end
  end

  defp provider_status_attrs(provider_account) do
    ClippsterServer.Social.PostForMeAccountHealth.provider_status_attrs(provider_account)
  end

  defp provider_state_changed?(account, attrs) do
    account.is_active != attrs.is_active or account.token_expires_at != attrs.token_expires_at
  end

  defp update_user_from_provider(%ClipperSocialAccount{} = account, attrs) do
    account
    |> ClipperSocialAccount.update_changeset(attrs)
    |> Repo.update()
  end

  defp update_org_from_provider(%SocialAccount{} = account, attrs) do
    Social.update_social_account(account, attrs)
  end
end
