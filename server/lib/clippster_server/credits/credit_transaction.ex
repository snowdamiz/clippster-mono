defmodule ClippsterServer.Credits.CreditTransaction do
  use Ecto.Schema
  import Ecto.Changeset

  schema "credit_transactions" do
    field :pack_type, :string
    field :hours_purchased, :decimal
    field :amount_usd, :decimal
    field :amount_sol, :decimal
    field :sol_usd_rate, :decimal
    field :tx_signature, :string
    field :status, :string

    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @pack_types ~w(starter creator pro studio)
  @statuses ~w(pending confirmed failed)

  @doc false
  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :user_id,
      :pack_type,
      :hours_purchased,
      :amount_usd,
      :amount_sol,
      :sol_usd_rate,
      :tx_signature,
      :status
    ])
    |> validate_required([
      :user_id,
      :pack_type,
      :hours_purchased,
      :amount_usd,
      :amount_sol,
      :sol_usd_rate,
      :tx_signature,
      :status
    ])
    |> validate_inclusion(:pack_type, @pack_types)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:hours_purchased, greater_than: 0)
    |> validate_number(:amount_usd, greater_than: 0)
    |> validate_number(:amount_sol, greater_than: 0)
    |> validate_number(:sol_usd_rate, greater_than: 0)
    |> unique_constraint(:tx_signature)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Creates a pending transaction
  """
  def pending_changeset(attrs) do
    %__MODULE__{status: "pending"}
    |> changeset(attrs)
  end

  @doc """
  Updates transaction status to confirmed
  """
  def confirm_changeset(transaction) do
    transaction
    |> change(status: "confirmed")
  end

  @doc """
  Updates transaction status to failed
  """
  def fail_changeset(transaction) do
    transaction
    |> change(status: "failed")
  end
end
