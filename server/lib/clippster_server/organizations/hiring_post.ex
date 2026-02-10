defmodule ClippsterServer.Organizations.HiringPost do
  use Ecto.Schema
  import Ecto.Changeset

  @statuses ["active", "paused", "closed"]
  @payment_types ["cpm", "flat_rate", "revenue_share", "negotiable"]

  schema "hiring_posts" do
    field :title, :string
    field :description, :string
    field :content_types, {:array, :string}, default: []
    field :languages, {:array, :string}, default: []
    field :platforms, {:array, :string}, default: []
    field :payment_type, :string
    field :payment_details, :string
    field :streamer_count, :integer
    field :clipper_slots, :integer
    field :clipper_slots_filled, :integer, default: 0
    field :experience_level, :string
    field :status, :string, default: "active"
    field :is_public, :boolean, default: true

    belongs_to :organization, ClippsterServer.Organizations.Organization
    has_many :applications, ClippsterServer.Organizations.HiringApplication

    timestamps(type: :utc_datetime)
  end

  def create_changeset(hiring_post, attrs) do
    hiring_post
    |> cast(attrs, [
      :organization_id, :title, :description, :content_types, :languages,
      :platforms, :payment_type, :payment_details, :streamer_count,
      :clipper_slots, :experience_level, :status, :is_public
    ])
    |> nilify_blank(:payment_type)
    |> nilify_blank(:experience_level)
    |> validate_required([:organization_id, :title])
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, max: 5000)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:payment_type, @payment_types ++ [nil])
    |> validate_number(:clipper_slots, greater_than: 0)
    |> validate_number(:streamer_count, greater_than_or_equal_to: 0)
    |> unique_constraint(:organization_id)
    |> foreign_key_constraint(:organization_id)
  end

  def update_changeset(hiring_post, attrs) do
    hiring_post
    |> cast(attrs, [
      :title, :description, :content_types, :languages, :platforms,
      :payment_type, :payment_details, :streamer_count, :clipper_slots,
      :experience_level, :status, :is_public
    ])
    |> nilify_blank(:payment_type)
    |> nilify_blank(:experience_level)
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, max: 5000)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:payment_type, @payment_types ++ [nil])
    |> validate_number(:clipper_slots, greater_than: 0)
    |> validate_number(:streamer_count, greater_than_or_equal_to: 0)
  end

  defp nilify_blank(changeset, field) do
    case get_change(changeset, field) do
      "" -> put_change(changeset, field, nil)
      _ -> changeset
    end
  end

  def statuses, do: @statuses
  def payment_types, do: @payment_types
end
