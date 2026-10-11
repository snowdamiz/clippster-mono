defmodule ClippsterServer.Social.PostApprovalTest do
  use ClippsterServer.DataCase, async: true
  import ClippsterServer.AccountsFixtures
  alias ClippsterServer.{Organizations, Social}
  alias ClippsterServer.Organizations.OrganizationMember
  alias ClippsterServer.Social.{PostApproval, PostSubmission, SocialAccount}

  setup do
    owner = email_user_fixture()
    member = email_user_fixture()
    outsider = email_user_fixture()
    {:ok, org} = Organizations.create_organization(owner, %{name: "Review organization"})

    {:ok, org} =
      Organizations.update_restriction_defaults(org.id, %{"require_clip_approval" => true}, owner)

    %OrganizationMember{}
    |> OrganizationMember.create_changeset(%{
      organization_id: org.id,
      user_id: member.id,
      role: "member",
      is_restricted: true
    })
    |> Repo.insert!()

    account =
      Repo.insert!(%SocialAccount{
        organization_id: org.id,
        platform: "youtube",
        username: "review-account",
        platform_user_id: "review-account",
        connected_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })

    attrs = %{
      organization_id: org.id,
      organization_social_account_id: account.id,
      platform: "youtube",
      media_url: "https://example.com/clip.mp4",
      owner_type: "org",
      scheduled_at: DateTime.add(DateTime.utc_now(), 3600) |> DateTime.truncate(:second)
    }

    %{owner: owner, member: member, outsider: outsider, org: org, attrs: attrs}
  end

  test "restricted submissions wait for review; only admins may release them once", context do
    {:ok, post} = Social.schedule_post(context.attrs, context.member)
    assert post.status == "awaiting_approval"

    assert {:error, :unauthorized} =
             PostApproval.review(context.org.id, post.id, context.member, :approve, "")

    assert {:error, :unauthorized} =
             PostApproval.review(context.org.id, post.id, context.outsider, :approve, "")

    {:ok, approved} =
      PostApproval.review(context.org.id, post.id, context.owner, :approve, "Ready")

    assert approved.status == "scheduled"
    assert approved.scheduled_at == post.scheduled_at
    assert approved.reviewed_by_user_id == context.owner.id

    assert {:error, :already_reviewed} =
             PostApproval.review(context.org.id, post.id, context.owner, :approve, "")
  end

  test "caption and media changes invalidate approval", context do
    {:ok, post} = Social.schedule_post(context.attrs, context.member)
    {:ok, approved} = PostApproval.review(context.org.id, post.id, context.owner, :approve, "")

    {:ok, edited} =
      Social.update_scheduled_post(approved, %{caption: "Changed caption"}, context.member)

    assert edited.status == "awaiting_approval"
    assert is_nil(edited.reviewed_at)
    {:ok, approved} = PostApproval.review(context.org.id, post.id, context.owner, :approve, "")

    {:ok, edited} =
      Social.update_scheduled_post_media(
        approved,
        %{media_url: "https://example.com/replacement.mp4", status: "scheduled"},
        context.member
      )

    assert edited.status == "awaiting_approval"
  end

  test "rejected clips are never publishable and review requests are scoped", context do
    {:ok, post} = Social.create_immediate_post(context.attrs, context.member)

    {:ok, rejected} =
      PostApproval.review(context.org.id, post.id, context.owner, :reject, "Needs changes")

    assert rejected.status == "rejected"
    assert rejected.review_notes == "Needs changes"
    refute PostSubmission.can_edit?(rejected)
    assert {:ok, canceled} = Social.cancel_scheduled_post(rejected, context.member)
    assert canceled.status == "canceled"

    assert {:error, :not_found} =
             PostApproval.review(context.org.id, post.id + 100_000, context.owner, :approve, "")
  end

  test "personal publishing cannot bypass review policy", context do
    assert PostApproval.personal_restricted?(context.member.id)

    changeset =
      PostSubmission.create_changeset(
        %PostSubmission{},
        Map.drop(context.attrs, [:organization_id, :organization_social_account_id])
      )
      |> PostApproval.apply_policy(context.member)

    assert "submit to your organization for clip approval" in errors_on(changeset).organization_id
  end
end
