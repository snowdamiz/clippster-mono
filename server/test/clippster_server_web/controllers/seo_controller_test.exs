defmodule ClippsterServerWeb.SeoControllerTest do
  use ClippsterServerWeb.ConnCase, async: true

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.Organizations
  alias ClippsterServer.Repo

  import ClippsterServer.AccountsFixtures

  describe "GET /api/seo/sitemap" do
    test "lists public clippers and organizations without emails", %{conn: conn} do
      public_user = email_user_fixture(%{name: "Public Clipper"})

      {:ok, _public_profile} =
        ClipperProfiles.create_profile(%{
          user_id: public_user.id,
          display_name: "Public Clipper",
          slug: "public-clipper-seo",
          bio: "I clip Twitch streams",
          is_public: true
        })

      private_user = email_user_fixture(%{name: "Private Clipper"})

      {:ok, _private_profile} =
        ClipperProfiles.create_profile(%{
          user_id: private_user.id,
          display_name: "Private Clipper",
          slug: "private-clipper-seo",
          is_public: false
        })

      basic_user = email_user_fixture(%{name: "Basic Clipper"})

      basic_user
      |> Ecto.Changeset.change(%{subscription_tier: "basic"})
      |> Repo.update!()

      {:ok, _basic_profile} =
        ClipperProfiles.create_profile(%{
          user_id: basic_user.id,
          display_name: "Basic Clipper",
          slug: "basic-clipper-seo",
          bio: "Basic tier bio",
          is_public: true
        })

      owner = email_user_fixture(%{name: "Org Owner"})

      {:ok, org} =
        Organizations.create_organization(owner, %{
          name: "Seo Test Org",
          description: "We hire clippers"
        })

      {:ok, _enabled_org} =
        Organizations.update_organization(org, %{"public_profile_enabled" => true}, owner)

      private_owner = email_user_fixture(%{name: "Private Org Owner"})

      {:ok, _private_org} =
        Organizations.create_organization(private_owner, %{
          name: "Private Seo Org",
          description: "Should stay off sitemap"
        })

      conn = get(conn, "/api/seo/sitemap")

      assert %{"success" => true, "clippers" => clippers, "organizations" => organizations} =
               json_response(conn, 200)

      clipper_slugs = Enum.map(clippers, & &1["slug"])
      assert "public-clipper-seo" in clipper_slugs
      refute "private-clipper-seo" in clipper_slugs
      refute "basic-clipper-seo" in clipper_slugs

      public_entry = Enum.find(clippers, &(&1["slug"] == "public-clipper-seo"))
      assert public_entry["display_name"] == "Public Clipper"
      assert public_entry["bio"] == "I clip Twitch streams"
      refute Map.has_key?(public_entry, "email")

      org_slugs = Enum.map(organizations, & &1["slug"])
      assert org.slug in org_slugs
      refute Enum.any?(organizations, &(&1["name"] == "Private Seo Org"))

      org_entry = Enum.find(organizations, &(&1["slug"] == org.slug))
      assert org_entry["name"] == "Seo Test Org"
      assert org_entry["description"] == "We hire clippers"
    end

    test "public clipper show payload omits email and hides basic tier", %{conn: conn} do
      user = email_user_fixture(%{name: "Shown Clipper", email: "shown-clipper@example.com"})

      {:ok, _profile} =
        ClipperProfiles.create_profile(%{
          user_id: user.id,
          display_name: "Shown Clipper",
          slug: "shown-clipper-seo",
          bio: "Portfolio ready",
          is_public: true
        })

      conn = get(conn, "/api/clippers/shown-clipper-seo")
      assert %{"success" => true, "profile" => profile} = json_response(conn, 200)
      assert profile["user"]["name"] == "Shown Clipper"
      refute Map.has_key?(profile["user"], "email")

      basic_user = email_user_fixture(%{name: "Hidden Basic"})
      basic_user |> Ecto.Changeset.change(%{subscription_tier: "basic"}) |> Repo.update!()

      {:ok, _} =
        ClipperProfiles.create_profile(%{
          user_id: basic_user.id,
          display_name: "Hidden Basic",
          slug: "hidden-basic-seo",
          bio: "Should 404",
          is_public: true
        })

      conn = get(build_conn(), "/api/clippers/hidden-basic-seo")
      assert %{"success" => false} = json_response(conn, 404)
    end

    test "organization public profile requires opt-in", %{conn: conn} do
      owner = email_user_fixture(%{name: "Gate Owner"})

      {:ok, org} =
        Organizations.create_organization(owner, %{
          name: "Gated Org",
          description: "Has content but not opted in"
        })

      conn = get(conn, "/api/orgs/#{org.slug}")
      assert %{"success" => false} = json_response(conn, 404)

      {:ok, _} = Organizations.update_organization(org, %{"public_profile_enabled" => true}, owner)
      conn = get(build_conn(), "/api/orgs/#{org.slug}")
      assert %{"success" => true, "profile" => profile} = json_response(conn, 200)
      assert profile["name"] == "Gated Org"
    end
  end
end
