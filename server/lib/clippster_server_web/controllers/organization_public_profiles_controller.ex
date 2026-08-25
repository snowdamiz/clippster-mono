defmodule ClippsterServerWeb.OrganizationPublicProfilesController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  def show(conn, %{"slug" => slug}) do
    case Organizations.get_public_profile_by_slug(slug) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      payload ->
        json(conn, %{
          success: true,
          profile: serialize_public_profile(payload)
        })
    end
  end

  @doc """
  Public endpoint to check if an organization name is available.
  Used by signup forms and admin org creation.
  """
  def check_name(conn, %{"name" => name} = params) do
    exclude_org_id =
      case Map.get(params, "exclude_org_id") do
        nil -> nil
        id when is_binary(id) -> String.to_integer(id)
        id when is_integer(id) -> id
      end

    {:ok, available} = Organizations.is_org_name_available?(name, exclude_org_id)
    json(conn, %{success: true, available: available})
  end

  defp serialize_public_profile(payload) do
    org = payload.organization

    %{
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      bio: org.bio,
      logo_url: maybe_presign_url(org.logo_url),
      website_url: org.website_url,
      public_contact_email: org.public_contact_email,
      public_discord: org.public_discord,
      public_telegram: org.public_telegram,
      content_type_tags: org.content_type_tags || [],
      stats: payload.stats,
      streamers: Enum.map(payload.streamers, &serialize_streamer/1),
      social_accounts: Enum.map(payload.social_accounts, &serialize_social_account/1),
      hiring: serialize_hiring(payload.hiring_post)
    }
  end

  defp serialize_streamer(profile) do
    primary_link =
      Enum.find(profile.platform_links, fn link -> link.is_primary end) ||
        List.first(profile.platform_links)

    platform = if primary_link, do: primary_link.platform, else: nil
    platform_id = if primary_link, do: primary_link.platform_id, else: nil
    display_name = if primary_link, do: primary_link.display_name, else: nil
    platform_image = if primary_link, do: primary_link.profile_image_url, else: nil

    %{
      id: profile.id,
      name: profile.name,
      description: profile.description,
      profile_image_url: maybe_presign_url(profile.profile_image_url || platform_image),
      platform: platform,
      platform_id: platform_id,
      display_name: display_name
    }
  end

  defp serialize_social_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: maybe_presign_url(account.profile_image_url)
    }
  end

  defp serialize_hiring(nil), do: nil

  defp serialize_hiring(post) do
    %{
      id: post.id,
      title: post.title,
      description: post.description,
      content_types: post.content_types || [],
      languages: post.languages || [],
      platforms: post.platforms || [],
      payment_type: post.payment_type,
      payment_details: post.payment_details,
      streamer_count: post.streamer_count,
      clipper_slots: post.clipper_slots,
      clipper_slots_filled: post.clipper_slots_filled || 0,
      experience_level: post.experience_level,
      status: post.status
    }
  end

  defp maybe_presign_url(nil), do: nil

  defp maybe_presign_url(url) when is_binary(url) do
    if is_r2_storage_url?(url) do
      Storage.presigned_url!(url)
    else
      url
    end
  end

  defp is_r2_storage_url?(url) do
    base = Storage.public_url_base()

    cond do
      base && String.starts_with?(url, base) -> true
      String.contains?(url, ".r2.cloudflarestorage.com/") -> true
      String.starts_with?(url, "organizations/") -> true
      String.starts_with?(url, "orgs/") -> true
      true -> false
    end
  end
end
