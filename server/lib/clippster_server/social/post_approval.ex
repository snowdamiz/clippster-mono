defmodule ClippsterServer.Social.PostApproval do
  @moduledoc "Organization review policy and atomic review transitions."
  import Ecto.Query
  import Ecto.Changeset
  alias ClippsterServer.{Organizations, Repo}
  alias ClippsterServer.Social.PostSubmission

  def personal_restricted?(user_id) do
    restrictions = Organizations.get_user_restrictions(user_id) || %{}
    restrictions["require_clip_approval"] == true
  end

  def apply_policy(changeset, user) do
    organization_id = get_field(changeset, :organization_id)

    if organization_id do
      restrictions = Organizations.get_effective_restrictions(organization_id, user.id) || %{}

      if restrictions["require_clip_approval"] == true,
        do:
          changeset
          |> put_change(:status, "awaiting_approval")
          |> put_change(:reviewed_at, nil)
          |> put_change(:reviewed_by_user_id, nil)
          |> put_change(:review_notes, nil),
        else: changeset
    else
      if personal_restricted?(user.id),
        do:
          add_error(changeset, :organization_id, "submit to your organization for clip approval"),
        else: changeset
    end
  end

  def review(organization_id, post_id, reviewer, action, notes)
      when action in [:approve, :reject] do
    cond do
      not Organizations.is_admin?(organization_id, reviewer.id) ->
        {:error, :unauthorized}

      not is_binary(notes) or String.length(notes) > 2000 ->
        {:error, :invalid_notes}

      true ->
        Repo.transaction(fn ->
          post =
            Repo.one(
              from p in PostSubmission,
                where: p.organization_id == ^organization_id and p.id == ^post_id,
                lock: "FOR UPDATE"
            )

          if is_nil(post), do: Repo.rollback(:not_found)
          if post.status != "awaiting_approval", do: Repo.rollback(:already_reviewed)
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          scheduled_at =
            if post.scheduled_at && DateTime.compare(post.scheduled_at, now) == :gt,
              do: post.scheduled_at,
              else: now

          attrs = %{
            status: if(action == :approve, do: "scheduled", else: "rejected"),
            reviewed_by_user_id: reviewer.id,
            reviewed_at: now,
            review_notes: notes,
            scheduled_at: scheduled_at
          }

          case Repo.update(change(post, attrs)) do
            {:ok, updated} -> updated
            {:error, error} -> Repo.rollback(error)
          end
        end)
    end
  end
end
