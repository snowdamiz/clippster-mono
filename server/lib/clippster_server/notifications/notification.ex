defmodule ClippsterServer.Notifications.Notification do
  @moduledoc """
  Schema for in-app notifications.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  @notification_types ~w(
    payment_verified
    payment_pending
    campaign_joined
    campaign_approved
    campaign_rejected
    submission_verified
    submission_rejected
  )

  schema "notifications" do
    field :type, :string
    field :title, :string
    field :message, :string
    field :data, :map, default: %{}
    field :read_at, :utc_datetime
    field :action_url, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a notification.
  """
  def create_changeset(notification, attrs) do
    notification
    |> cast(attrs, [:user_id, :type, :title, :message, :data, :action_url])
    |> validate_required([:user_id, :type, :title])
    |> validate_inclusion(:type, @notification_types)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for marking a notification as read.
  """
  def mark_read_changeset(notification) do
    notification
    |> change(read_at: DateTime.utc_now() |> DateTime.truncate(:second))
  end

  def notification_types, do: @notification_types
end
