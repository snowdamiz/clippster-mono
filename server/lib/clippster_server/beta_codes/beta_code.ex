defmodule ClippsterServer.BetaCodes.BetaCode do
  @moduledoc """
  Schema for beta codes used in controlled beta launches.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  schema "beta_codes" do
    field :code, :string
    field :used_at, :utc_datetime
    field :assigned_email, :string
    field :verified_at, :utc_datetime
    field :verified_from_ip, :string

    belongs_to :used_by_user, User, foreign_key: :used_by_user_id

    timestamps()
  end

  @doc """
  Changeset for creating a new beta code.
  """
  def changeset(beta_code, attrs) do
    beta_code
    |> cast(attrs, [:code, :assigned_email])
    |> validate_required([:code])
    |> validate_length(:code, is: 8)
    |> unique_constraint(:code)
  end

  @doc """
  Changeset for marking a beta code as used.
  """
  def use_changeset(beta_code, user_id) do
    beta_code
    |> change()
    |> put_change(:used_by_user_id, user_id)
    |> put_change(:used_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end

  @doc """
  Changeset for recording beta code verification on landing page.
  """
  def verify_changeset(beta_code, ip_address) do
    beta_code
    |> change()
    |> put_change(:verified_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> put_change(:verified_from_ip, ip_address)
  end
end
