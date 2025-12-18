defmodule ClippsterServer.Organizations.MemberCreditAllocation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  schema "member_credit_allocations" do
    field :hours_allocated, :decimal, default: Decimal.new("0")
    field :hours_used, :decimal, default: Decimal.new("0")

    belongs_to :organization, ClippsterServer.Organizations.Organization, primary_key: true
    belongs_to :user, ClippsterServer.Accounts.User, primary_key: true

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(allocation, attrs) do
    allocation
    |> cast(attrs, [:organization_id, :user_id, :hours_allocated, :hours_used])
    |> validate_required([:organization_id, :user_id])
    |> validate_number(:hours_allocated, greater_than_or_equal_to: 0)
    |> validate_number(:hours_used, greater_than_or_equal_to: 0)
    |> unique_constraint([:organization_id, :user_id])
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Allocates hours to a member from the organization pool.
  """
  def allocate_hours_changeset(allocation, hours) do
    new_allocated = Decimal.add(allocation.hours_allocated, Decimal.new(to_string(hours)))
    
    allocation
    |> change(hours_allocated: new_allocated)
  end

  @doc """
  Deducts hours from member's allocation.
  """
  def deduct_hours_changeset(allocation, hours) do
    hours_decimal = Decimal.new(to_string(hours))
    
    # Calculate remaining hours in allocation
    remaining = Decimal.sub(allocation.hours_allocated, allocation.hours_used)
    
    if Decimal.compare(remaining, hours_decimal) == :lt do
      # Not enough in allocation
      {:error, :insufficient_allocation}
    else
      new_used = Decimal.add(allocation.hours_used, hours_decimal)
      
      {:ok, allocation |> change(hours_used: new_used)}
    end
  end

  @doc """
  Returns the remaining hours in a member's allocation.
  """
  def remaining_hours(%__MODULE__{hours_allocated: allocated, hours_used: used}) do
    Decimal.sub(allocated, used)
  end
end

