defmodule ClippsterServer.Campaigns.ClipperPaymentMethod do
  @moduledoc """
  Schema for clipper payment methods for receiving campaign payments.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  @method_types ~w(paypal crypto venmo cashapp bank_transfer)

  schema "clipper_payment_methods" do
    field :method_type, :string
    field :details, :binary
    field :is_default, :boolean, default: false

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new payment method.
  """
  def create_changeset(method, attrs) do
    method
    |> cast(attrs, [:user_id, :method_type, :details, :is_default])
    |> validate_required([:user_id, :method_type])
    |> validate_inclusion(:method_type, @method_types)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for updating a payment method.
  """
  def update_changeset(method, attrs) do
    method
    |> cast(attrs, [:details, :is_default])
  end

  @doc """
  Changeset for setting as default.
  """
  def set_default_changeset(method, is_default) do
    method
    |> change(is_default: is_default)
  end

  def method_types, do: @method_types
end
