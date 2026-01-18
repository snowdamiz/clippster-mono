defmodule ClippsterServer.Organizations.Organization do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organizations" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :logo_url, :string
    field :settings, :map, default: %{}

    # Instagram scheduling settings
    field :allow_personal_instagram, :boolean, default: true
    field :scheduling_enabled, :boolean, default: true

    # Restriction defaults for restricted members
    field :restriction_defaults, :map, default: %{
      "allow_ai" => true,
      "allow_asset_uploads" => false,
      "allow_custom_prompts" => false,
      "allow_clipper_profile" => false,
      "allow_personal_social" => true,
      "allow_clip_deletion" => false,
      "force_org_watermark" => true,
      "require_clip_approval" => false,
      "clips_visible_to_admins" => true
    }

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
    |> cast(attrs, [:name, :description, :logo_url, :owner_id, :settings, :allow_personal_instagram, :scheduling_enabled])
    |> validate_required([:name, :owner_id])
    |> validate_length(:name, min: 2, max: 100)
    |> validate_length(:description, max: 500)
    |> generate_slug()
    |> unique_constraint(:slug)
    |> foreign_key_constraint(:owner_id)
  end

  @doc """
  Changeset for updating an organization.
  """
  def update_changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name, :description, :logo_url, :settings, :allow_personal_instagram, :scheduling_enabled, :restriction_defaults])
    |> validate_length(:name, min: 2, max: 100)
    |> validate_length(:description, max: 500)
    |> maybe_regenerate_slug()
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
      nil -> changeset
      name ->
        # Only regenerate slug if name changed and current slug matches old name pattern
        current_slug = get_field(changeset, :slug)
        new_slug = slugify(name)
        
        # Don't change slug if it was customized
        if String.starts_with?(current_slug || "", slugify(get_field(changeset, :name) || "")) do
          put_change(changeset, :slug, new_slug)
        else
          changeset
        end
    end
  end

  defp slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/[\s-]+/, "-")
    |> String.trim("-")
    |> then(fn slug ->
      # Add random suffix for uniqueness
      suffix = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
      "#{slug}-#{suffix}"
    end)
  end
end

