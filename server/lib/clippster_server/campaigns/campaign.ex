defmodule ClippsterServer.Campaigns.Campaign do
  @moduledoc """
  Schema for clipping campaigns where organizations can create campaigns
  for clippers to join and submit clips.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.{
    Organization,
    OrganizationCreatorProfile,
    OrganizationAsset
  }

  alias ClippsterServer.Campaigns.{
    CampaignParticipant,
    CampaignSubmission,
    CampaignPayment,
    CampaignCreatorProfile,
    CampaignResource
  }

  @join_types ~w(open application_required)
  @statuses ~w(draft active paused completed)
  @platforms ~w(tiktok instagram x youtube)
  @payment_methods ~w(paypal crypto venmo cashapp bank_transfer)
  @payment_models ~w(cpm per_clip)
  @content_verticals ~w(gaming music podcast brand course event news other)

  schema "clipping_campaigns" do
    field :title, :string
    field :description, :string
    field :cover_image_url, :string
    field :budget, :decimal, default: Decimal.new(0)
    field :spent, :decimal, default: Decimal.new(0)
    field :spent_budget, :decimal, default: Decimal.new(0)
    field :cpm, :decimal, default: Decimal.new(0)
    field :cpm_views, :integer, default: 1000
    field :min_views_for_payment, :integer, default: 0
    field :join_type, :string, default: "open"
    field :allowed_platforms, {:array, :string}, default: []
    field :payment_methods, {:array, :string}, default: []
    field :status, :string, default: "draft"
    field :starts_at, :utc_datetime
    field :ends_at, :utc_datetime
    field :global_watermarks, :map, default: %{}
    field :require_watermark, :boolean, default: false
    field :require_intro, :boolean, default: false
    field :require_outro, :boolean, default: false
    field :payment_model, :string, default: "cpm"
    field :per_clip_amount, :decimal
    field :clips_per_profile, :integer, default: 5
    field :assigned_streamer_ids, {:array, :integer}, default: []
    field :max_views, :integer
    field :is_platform_campaign, :boolean, default: false
    field :platform_payment_model, :string
    field :content_vertical, :string
    field :campaign_goal, :string
    field :content_style_tags, {:array, :string}, default: []

    belongs_to :organization, Organization
    belongs_to :creator_profile, OrganizationCreatorProfile
    belongs_to :branding_profile, OrganizationCreatorProfile, foreign_key: :branding_profile_id
    belongs_to :global_intro, OrganizationAsset, foreign_key: :global_intro_id
    belongs_to :global_outro, OrganizationAsset, foreign_key: :global_outro_id
    has_many :participants, CampaignParticipant
    has_many :submissions, CampaignSubmission
    has_many :payments, CampaignPayment
    has_many :campaign_creator_profiles, CampaignCreatorProfile
    has_many :creator_profiles, through: [:campaign_creator_profiles, :creator_profile]
    has_many :resources, CampaignResource

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
      :max_views,
      :join_type,
      :allowed_platforms,
      :payment_methods,
      :status,
      :starts_at,
      :ends_at,
      :global_watermarks,
      :global_intro_id,
      :global_outro_id,
      :require_watermark,
      :require_intro,
      :require_outro,
      :branding_profile_id,
      :payment_model,
      :per_clip_amount,
      :clips_per_profile,
      :assigned_streamer_ids,
      :is_platform_campaign,
      :platform_payment_model,
      :content_vertical,
      :campaign_goal,
      :content_style_tags
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
    |> validate_payment_model()
    |> validate_dates()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:creator_profile_id)
    |> foreign_key_constraint(:branding_profile_id)
    |> foreign_key_constraint(:global_intro_id)
    |> foreign_key_constraint(:global_outro_id)
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
      :max_views,
      :join_type,
      :allowed_platforms,
      :payment_methods,
      :status,
      :starts_at,
      :ends_at,
      :global_watermarks,
      :global_intro_id,
      :global_outro_id,
      :require_watermark,
      :require_intro,
      :require_outro,
      :branding_profile_id,
      :payment_model,
      :per_clip_amount,
      :clips_per_profile,
      :assigned_streamer_ids,
      :is_platform_campaign,
      :platform_payment_model,
      :content_vertical,
      :campaign_goal,
      :content_style_tags
    ])
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, max: 5000)
    |> validate_inclusion(:join_type, @join_types)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:budget, greater_than_or_equal_to: 0)
    |> validate_number(:cpm, greater_than_or_equal_to: 0)
    |> validate_number(:cpm_views, greater_than: 0)
    |> validate_number(:min_views_for_payment, greater_than_or_equal_to: 0)
    |> validate_number(:max_views, greater_than_or_equal_to: 0)
    |> validate_platforms()
    |> validate_payment_methods()
    |> validate_payment_model()
    |> validate_dates()
    |> foreign_key_constraint(:creator_profile_id)
    |> foreign_key_constraint(:branding_profile_id)
    |> foreign_key_constraint(:global_intro_id)
    |> foreign_key_constraint(:global_outro_id)
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
      nil ->
        changeset

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
      nil ->
        changeset

      methods ->
        if Enum.all?(methods, &(&1 in @payment_methods)) do
          changeset
        else
          add_error(changeset, :payment_methods, "contains invalid payment method")
        end
    end
  end

  defp validate_payment_model(changeset) do
    payment_model = get_field(changeset, :payment_model)
    per_clip_amount = get_field(changeset, :per_clip_amount)

    changeset
    |> validate_inclusion(:payment_model, @payment_models)
    |> then(fn cs ->
      if payment_model == "per_clip" and is_nil(per_clip_amount) do
        add_error(cs, :per_clip_amount, "is required when payment model is per_clip")
      else
        cs
      end
    end)
    |> validate_number(:per_clip_amount, greater_than: 0)
    |> validate_number(:clips_per_profile, greater_than: 0)
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
  def payment_models, do: @payment_models
  def content_verticals, do: @content_verticals
end
