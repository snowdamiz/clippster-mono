defmodule ClippsterServer.Social.RateLimitState do
  @moduledoc """
  Schema for tracking API rate limit state per endpoint and social account.
  """

  use Ecto.Schema
  import Ecto.Changeset

  schema "rate_limit_states" do
    field :endpoint, :string
    field :social_account_id, :integer
    field :limit_value, :integer
    field :remaining, :integer
    field :reset_at, :utc_datetime
    field :last_checked_at, :utc_datetime

    timestamps()
  end

  @doc false
  def changeset(rate_limit_state, attrs) do
    rate_limit_state
    |> cast(attrs, [
      :endpoint,
      :social_account_id,
      :limit_value,
      :remaining,
      :reset_at,
      :last_checked_at
    ])
    |> validate_required([:endpoint, :limit_value, :remaining, :reset_at, :last_checked_at])
  end
end
