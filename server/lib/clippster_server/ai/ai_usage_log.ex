defmodule ClippsterServer.AI.AiUsageLog do
  use Ecto.Schema
  import Ecto.Changeset

  schema "ai_usage_logs" do
    field :project_id, :string
    field :provider, :string
    field :model, :string
    field :input_tokens, :integer
    field :output_tokens, :integer
    field :total_tokens, :integer
    field :duration_seconds, :decimal
    field :operation_type, :string
    field :cost_credits, :decimal
    field :cached_tokens, :integer
    field :cache_write_tokens, :integer
    field :cost_usd, :decimal

    belongs_to :user, ClippsterServer.Accounts.User
    belongs_to :ai_video_run, ClippsterServer.AI.VideoRun

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(ai_usage_log, attrs) do
    ai_usage_log
    |> cast(attrs, [
      :user_id,
      :project_id,
      :provider,
      :model,
      :input_tokens,
      :output_tokens,
      :total_tokens,
      :duration_seconds,
      :operation_type,
      :cost_credits,
      :cached_tokens,
      :cache_write_tokens,
      :cost_usd,
      :ai_video_run_id
    ])
    |> validate_required([:user_id, :provider, :operation_type])
    |> foreign_key_constraint(:user_id)
  end
end
