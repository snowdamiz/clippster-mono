defmodule ClippsterServer.StorageQuotas.UserStorageQuota do
  use Ecto.Schema
  import Ecto.Changeset

  @tiers ~w(cloud_none cloud_50 cloud_200)

  schema "user_storage_quotas" do
    field :tier, :string, default: "cloud_none"
    field :bytes_used, :integer, default: 0
    field :bytes_limit, :integer, default: 0

    belongs_to :user, ClippsterServer.Accounts.User, type: :id

    timestamps(type: :utc_datetime)
  end

  def changeset(quota, attrs) do
    quota
    |> cast(attrs, [:user_id, :tier, :bytes_used, :bytes_limit])
    |> validate_required([:user_id, :tier])
    |> validate_inclusion(:tier, @tiers)
    |> unique_constraint(:user_id)
  end

  def tier_limits do
    %{
      "cloud_none" => 0,
      "cloud_50" => 50 * 1024 * 1024 * 1024,
      "cloud_200" => 200 * 1024 * 1024 * 1024
    }
  end
end
