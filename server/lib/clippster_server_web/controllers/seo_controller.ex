defmodule ClippsterServerWeb.SeoController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.Organizations

  @doc """
  GET /api/seo/sitemap

  Public index of crawlable clipper and organization profiles.
  Used by the landing site to build sitemap.xml and directory pages.
  """
  def sitemap(conn, _params) do
    json(conn, %{
      success: true,
      clippers: Enum.map(ClipperProfiles.list_sitemap_clippers(), &serialize_clipper/1),
      organizations: Enum.map(Organizations.list_sitemap_organizations(), &serialize_organization/1)
    })
  end

  defp serialize_clipper(entry) do
    %{
      slug: entry.slug,
      updated_at: entry.updated_at,
      display_name: entry.display_name,
      bio: entry.bio
    }
  end

  defp serialize_organization(entry) do
    %{
      slug: entry.slug,
      updated_at: entry.updated_at,
      name: entry.name,
      description: entry.description
    }
  end
end
