defmodule ClippsterServer.OrganizationSubscriptions.OrganizationSubscriptionAddon do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organization_subscription_addons" do
    field :addon_tier, :string
    field :status, :string, default: "active"
    field :stripe_subscription_id, :string
    field :start_date, :utc_datetime
    field :end_date, :utc_datetime
    field :seats, :integer, default: 0
    field :monthly_credits, :integer, default: 0

    belongs_to :organization, ClippsterServer.Organizations.Organization

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new addon.
  """
  def create_changeset(addon, attrs) do
    addon
    |> cast(attrs, [
      :organization_id,
      :addon_tier,
      :status,
      :stripe_subscription_id,
      :start_date,
      :end_date,
      :seats,
      :monthly_credits
    ])
    |> validate_required([
      :organization_id,
      :addon_tier,
      :start_date,
      :end_date
    ])
    |> validate_inclusion(:status, ["active", "cancelled", "expired"])
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Changeset for updating addon status.
  """
  def update_status_changeset(addon, attrs) do
    addon
    |> cast(attrs, [:status, :end_date])
    |> validate_inclusion(:status, ["active", "cancelled", "expired"])
  end
end
