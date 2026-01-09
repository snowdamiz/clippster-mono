defmodule ClippsterServer.Campaigns.Campaign do
  @moduledoc """
  Schema for clipping campaigns where organizations can create campaigns
  for clippers to join and submit clips.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.{Organization, OrganizationCreatorProfile}
  alias ClippsterServer.Campaigns.{CampaignParticipant, CampaignSubmission, CampaignPayment}

  @join_types ~w(open application_required)
  @statuses ~w(draft active paused completed)
  @platforms ~w(tiktok instagram x youtube)
  @payment_methods ~w(paypal crypto venmo cashapp bank_transfer)

  schema "clipping_campaigns" do
    field :title, :string
    field :description, :string
    field :cover_image_url, :string
    field :budget, :decimal, default: Decimal.new(0)
    field :spent, :decimal, default: Decimal.new(0)
    field :cpm, :decimal, default: Decimal.new(0)
    field :cpm_views, :integer, default: 1000
    field :min_views_for_payment, :integer, default: 0
    field :join_type, :string, default: "open"
    field :allowed_platforms, {:array, :string}, default: []
    field :payment_methods, {:array, :string}, default: []
    field :status, :string, default: "draft"
    field :starts_at, :utc_datetime
    field :ends_at, :utc_datetime

    belongs_to :organization, Organization
    belongs_to :creator_profile, OrganizationCreatorProfile
    has_many :participants, CampaignParticipant
    has_many :submissions, CampaignSubmission
    has_many :payments, CampaignPayment

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new campaign.
  """
  def create_changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [
      :organization_id,
      :creator_profile_id,
      :title,
      :description,
      :cover_image_url,
      :budget,
      :cpm,
      :cpm_views,
      :min_views_for_payment,
      :join_type,
      :allowed_platforms,
      :payment_methods,
      :status,
      :starts_at,
      :ends_at
    ])
    |> validate_required([:organization_id, :title])
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, max: 5000)
    |> validate_inclusion(:join_type, @join_types)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:budget, greater_than_or_equal_to: 0)
    |> validate_number(:cpm, greater_than_or_equal_to: 0)
    |> validate_number(:cpm_views, greater_than: 0)
    |> validate_number(:min_views_for_payment, greater_than_or_equal_to: 0)
    |> validate_platforms()
    |> validate_payment_methods()
    |> validate_dates()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:creator_profile_id)
  end

  @doc """
  Changeset for updating a campaign.
  """
  def update_changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [
      :creator_profile_id,
      :title,
      :description,
      :cover_image_url,
      :budget,
      :cpm,
      :cpm_views,
      :min_views_for_payment,
      :join_type,
      :allowed_platforms,
      :payment_methods,
      :status,
      :starts_at,
      :ends_at
    ])
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, max: 5000)
    |> validate_inclusion(:join_type, @join_types)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:budget, greater_than_or_equal_to: 0)
    |> validate_number(:cpm, greater_than_or_equal_to: 0)
    |> validate_number(:cpm_views, greater_than: 0)
    |> validate_number(:min_views_for_payment, greater_than_or_equal_to: 0)
    |> validate_platforms()
    |> validate_payment_methods()
    |> validate_dates()
    |> foreign_key_constraint(:creator_profile_id)
  end

  @doc """
  Changeset for updating spent amount.
  """
  def update_spent_changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [:spent])
    |> validate_number(:spent, greater_than_or_equal_to: 0)
  end

  defp validate_platforms(changeset) do
    case get_change(changeset, :allowed_platforms) do
      nil -> changeset
      platforms ->
        if Enum.all?(platforms, &(&1 in @platforms)) do
          changeset
        else
          add_error(changeset, :allowed_platforms, "contains invalid platform")
        end
    end
  end

  defp validate_payment_methods(changeset) do
    case get_change(changeset, :payment_methods) do
      nil -> changeset
      methods ->
        if Enum.all?(methods, &(&1 in @payment_methods)) do
          changeset
        else
          add_error(changeset, :payment_methods, "contains invalid payment method")
        end
    end
  end

  defp validate_dates(changeset) do
    starts_at = get_field(changeset, :starts_at)
    ends_at = get_field(changeset, :ends_at)

    cond do
      is_nil(starts_at) or is_nil(ends_at) ->
        changeset

      DateTime.compare(ends_at, starts_at) == :lt ->
        add_error(changeset, :ends_at, "must be after start date")

      true ->
        changeset
    end
  end

  def join_types, do: @join_types
  def statuses, do: @statuses
  def platforms, do: @platforms
  def payment_method_types, do: @payment_methods
end
