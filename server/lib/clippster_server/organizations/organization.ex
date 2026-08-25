defmodule ClippsterServer.Organizations.Organization do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organizations" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :bio, :string
    field :logo_url, :string
    field :website_url, :string
    field :public_contact_email, :string
    field :public_discord, :string
    field :public_telegram, :string
    field :content_type_tags, {:array, :string}, default: []
    field :settings, :map, default: %{}

    # Instagram scheduling settings
    field :allow_personal_instagram, :boolean, default: true
    field :scheduling_enabled, :boolean, default: true

    # Feature flags
    field :campaigns_enabled, :boolean, default: false

    # Restriction defaults for restricted members
    field :restriction_defaults, :map,
      default: %{
        "allow_ai" => true,
        "allow_asset_uploads" => false,
        "allow_custom_prompts" => false,
        "allow_clipper_profile" => false,
        "allow_personal_social" => true,
        "allow_clip_deletion" => false,
        "allow_hiring_browse" => true,
        "force_org_watermark" => true,
        "require_clip_approval" => false,
        "clips_visible_to_admins" => true
      }

    # Subscription fields
    # none, active, cancelled, expired
    field :subscription_status, :string, default: "none"
    # enterprise_base, enterprise_ai
    field :subscription_tier, :string
    field :subscription_start_date, :utc_datetime
    field :subscription_end_date, :utc_datetime
    # stripe, crypto
    field :subscription_renewal_method, :string
    field :stripe_subscription_id, :string
    field :stripe_customer_id, :string
    # nil = unlimited (legacy), otherwise seat limit
    field :max_seats, :integer
    # Credits granted per renewal
    field :monthly_credits, :integer, default: 0
    # Tier org is downgrading to at period end
    field :pending_subscription_tier, :string

    # Admin-managed subscription fields
    # Custom price set by admin (in cents), nil = use tier default
    field :admin_price_cents, :integer
    # Day of month for billing cycle
    field :admin_billing_cycle_day, :integer
    # Admin user ID who created this org account
    field :created_by_admin_id, :integer
    # false = user needs to finish setup on first login
    field :setup_completed, :boolean, default: true

    belongs_to :owner, ClippsterServer.Accounts.User
    has_many :members, ClippsterServer.Organizations.OrganizationMember
    has_many :invitations, ClippsterServer.Organizations.OrganizationInvitation
    has_one :credits, ClippsterServer.Organizations.OrganizationCredit

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new organization.
  """
  def create_changeset(organization, attrs) do
    organization
    |> cast(attrs, [
      :name,
      :description,
      :bio,
      :logo_url,
      :website_url,
      :public_contact_email,
      :public_discord,
      :public_telegram,
      :content_type_tags,
      :owner_id,
      :settings,
      :allow_personal_instagram,
      :scheduling_enabled
    ])
    |> validate_required([:name, :owner_id])
    |> validate_length(:name, min: 2, max: 100)
    |> validate_length(:description, max: 500)
    |> validate_length(:bio, max: 2000)
    |> validate_length(:public_discord, max: 500)
    |> validate_length(:public_telegram, max: 500)
    |> trim_optional_contact_fields()
    |> generate_slug()
    |> unique_constraint(:slug, message: "An organization with this name already exists")
    |> unique_constraint(:name, message: "An organization with this name already exists")
    |> foreign_key_constraint(:owner_id)
  end

  @doc """
  Changeset for updating an organization.
  """
  def update_changeset(organization, attrs) do
    organization
    |> cast(attrs, [
      :name,
      :description,
      :bio,
      :logo_url,
      :website_url,
      :public_contact_email,
      :public_discord,
      :public_telegram,
      :content_type_tags,
      :settings,
      :allow_personal_instagram,
      :scheduling_enabled,
      :restriction_defaults
    ])
    |> validate_length(:name, min: 2, max: 100)
    |> validate_length(:description, max: 500)
    |> validate_length(:bio, max: 2000)
    |> validate_length(:public_discord, max: 500)
    |> validate_length(:public_telegram, max: 500)
    |> trim_optional_contact_fields()
    |> maybe_regenerate_slug()
    |> unique_constraint(:slug, message: "An organization with this name already exists")
    |> unique_constraint(:name, message: "An organization with this name already exists")
  end

  @doc """
  Changeset for updating organization subscription.
  """
  def subscription_changeset(organization, attrs) do
    organization
    |> cast(attrs, [
      :subscription_status,
      :subscription_tier,
      :subscription_start_date,
      :subscription_end_date,
      :subscription_renewal_method,
      :stripe_subscription_id,
      :stripe_customer_id,
      :max_seats,
      :monthly_credits,
      :pending_subscription_tier,
      :admin_price_cents,
      :admin_billing_cycle_day,
      :created_by_admin_id,
      :setup_completed
    ])
    |> validate_inclusion(:subscription_status, ["none", "active", "cancelled", "expired"])
    |> validate_inclusion(:subscription_tier, [
      "solo",
      "enterprise_base",
      "enterprise_ai",
      "enterprise_unlimited",
      "custom",
      nil
    ])
  end

  @doc """
  Changeset for updating restriction defaults.
  """
  def update_restriction_defaults_changeset(organization, attrs) do
    organization
    |> cast(attrs, [:restriction_defaults])
    |> validate_required([:restriction_defaults])
  end

  defp generate_slug(changeset) do
    case get_change(changeset, :name) do
      nil -> changeset
      name -> put_change(changeset, :slug, slugify(name))
    end
  end

  defp maybe_regenerate_slug(changeset) do
    case get_change(changeset, :name) do
      nil ->
        changeset

      name ->
        # Always regenerate slug when name changes (slug = slugified name)
        put_change(changeset, :slug, slugify(name))
    end
  end

  defp slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/[\s-]+/, "-")
    |> String.trim("-")
  end

  defp trim_optional_contact_fields(changeset) do
    [:website_url, :public_contact_email, :public_discord, :public_telegram]
    |> Enum.reduce(changeset, fn field, acc ->
      case get_change(acc, field) do
        nil ->
          acc

        v when is_binary(v) ->
          t = String.trim(v)
          put_change(acc, field, if(t == "", do: nil, else: t))

        _ ->
          acc
      end
    end)
  end
end
