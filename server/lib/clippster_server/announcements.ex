defmodule ClippsterServer.Announcements do
  @moduledoc """
  Context for managing system announcements.
  """
  import Ecto.Query

  alias ClippsterServer.Repo
  alias ClippsterServer.Announcements.Announcement

  @doc """
  Returns all announcements (admin view).
  """
  def list_all do
    Repo.all(
      from a in Announcement,
        order_by: [desc: a.inserted_at],
        preload: [:creator]
    )
  end

  @doc """
  Returns active, non-expired announcements filtered by account type.
  account_type: "personal" | "organization" | nil (treat as personal)
  """
  def list_active_for_account_type(account_type) do
    now = DateTime.utc_now()

    audience_filter =
      case account_type do
        "organization" -> ["everyone", "orgs_only"]
        _ -> ["everyone", "users_only"]
      end

    Repo.all(
      from a in Announcement,
        where: a.is_active == true,
        where: a.audience in ^audience_filter,
        where: is_nil(a.expires_at) or a.expires_at > ^now,
        order_by: [desc: a.published_at]
    )
  end

  @doc """
  Gets a single announcement.
  """
  def get(id), do: Repo.get(Announcement, id)

  @doc """
  Creates an announcement (saved as draft, not yet active).
  """
  def create(attrs, user_id) do
    %Announcement{}
    |> Announcement.changeset(Map.put(attrs, "created_by", user_id))
    |> Repo.insert()
  end

  @doc """
  Updates an announcement. If is_active is being set to true and it wasn't before,
  sets published_at and broadcasts via PubSub.
  """
  def update(%Announcement{} = announcement, attrs) do
    was_active = announcement.is_active
    becoming_active = Map.get(attrs, "is_active", Map.get(attrs, :is_active, was_active))

    attrs =
      if !was_active && becoming_active do
        Map.put(attrs, "published_at", DateTime.utc_now() |> DateTime.truncate(:second))
      else
        attrs
      end

    result =
      announcement
      |> Announcement.changeset(attrs)
      |> Repo.update()

    case result do
      {:ok, updated} ->
        if !was_active && updated.is_active do
          broadcast_new_announcement(updated)
        end
        {:ok, updated}

      error ->
        error
    end
  end

  @doc """
  Deletes an announcement.
  """
  def delete(%Announcement{} = announcement) do
    Repo.delete(announcement)
  end

  @doc """
  Publishes an announcement immediately (sets active + published_at + broadcasts).
  """
  def publish(%Announcement{} = announcement) do
    update(announcement, %{
      "is_active" => true,
      "published_at" => DateTime.utc_now() |> DateTime.truncate(:second)
    })
  end

  defp broadcast_new_announcement(announcement) do
    Phoenix.PubSub.broadcast(
      ClippsterServer.PubSub,
      "announcements:lobby",
      {:new_announcement, announcement}
    )
  end
end
