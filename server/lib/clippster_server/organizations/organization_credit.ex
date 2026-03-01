defmodule ClippsterServer.Organizations.OrganizationCredit do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:organization_id, :id, autogenerate: false}
  schema "organization_credits" do
    field :hours_remaining, :decimal, default: Decimal.new("0")
    field :hours_used, :decimal, default: Decimal.new("0")

    belongs_to :organization, ClippsterServer.Organizations.Organization, define_field: false

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org_credit, attrs) do
    org_credit
    |> cast(attrs, [:organization_id, :hours_remaining, :hours_used])
    |> validate_required([:organization_id])
    |> validate_number(:hours_remaining, greater_than_or_equal_to: 0)
    |> validate_number(:hours_used, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Adds hours to organization's balance.
  """
  def add_hours_changeset(org_credit, hours) do
    new_remaining = Decimal.add(org_credit.hours_remaining, Decimal.new(to_string(hours)))

    org_credit
    |> change(hours_remaining: new_remaining)
  end

  @doc """
  Deducts hours from organization's balance.
  """
  def deduct_hours_changeset(org_credit, hours) do
    hours_decimal = Decimal.new(to_string(hours))
    new_remaining = Decimal.sub(org_credit.hours_remaining, hours_decimal)
    new_used = Decimal.add(org_credit.hours_used, hours_decimal)

    org_credit
    |> change(hours_remaining: new_remaining, hours_used: new_used)
    |> validate_number(:hours_remaining, greater_than_or_equal_to: 0)
  end
end
