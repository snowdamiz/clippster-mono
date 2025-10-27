defmodule ClippsterServer.Credits.UserCredit do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:user_id, :id, autogenerate: false}
  schema "user_credits" do
    field :hours_remaining, :decimal, default: Decimal.new("0")
    field :hours_used, :decimal, default: Decimal.new("0")

    belongs_to :user, ClippsterServer.Accounts.User, define_field: false

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(user_credit, attrs) do
    user_credit
    |> cast(attrs, [:user_id, :hours_remaining, :hours_used])
    |> validate_required([:user_id])
    |> validate_number(:hours_remaining, greater_than_or_equal_to: 0)
    |> validate_number(:hours_used, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Adds hours to user's balance
  """
  def add_hours_changeset(user_credit, hours) do
    new_remaining = Decimal.add(user_credit.hours_remaining, Decimal.new(to_string(hours)))
    
    user_credit
    |> change(hours_remaining: new_remaining)
  end

  @doc """
  Deducts hours from user's balance
  """
  def deduct_hours_changeset(user_credit, hours) do
    hours_decimal = Decimal.new(to_string(hours))
    new_remaining = Decimal.sub(user_credit.hours_remaining, hours_decimal)
    new_used = Decimal.add(user_credit.hours_used, hours_decimal)
    
    user_credit
    |> change(hours_remaining: new_remaining, hours_used: new_used)
    |> validate_number(:hours_remaining, greater_than_or_equal_to: 0)
  end
end
