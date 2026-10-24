defmodule ClippsterServer.AI.VideoRun do
  @moduledoc """
  One AI video operation: generating an edit, revising it, analysing an example, or the free
  planning chat before a build (`plan`, which also pays for labelling the user's clips).

  An agent run owns its conversation so the cached prompt prefix stays byte-identical between
  turns and the client cannot rewrite history. `cost_usd` accumulates the provider cost of every
  model call made for the run, which the admin economics report compares with `credits_charged`.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @kinds ~w(generate revise reference plan)
  @statuses ~w(running completed failed)

  schema "ai_video_runs" do
    field :kind, :string
    field :status, :string, default: "running"
    field :request, :string
    field :credits_charged, :integer, default: 0
    field :refunded, :boolean, default: false
    field :turns, :integer, default: 0
    field :label_calls, :integer, default: 0
    field :messages, {:array, :map}, default: []
    field :finish, :map
    field :cost_usd, :decimal, default: Decimal.new(0)
    field :error, :string

    belongs_to :session, ClippsterServer.AI.VideoSession
    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def kinds, do: @kinds

  def changeset(run, attrs) do
    run
    |> cast(attrs, [
      :kind,
      :status,
      :request,
      :credits_charged,
      :refunded,
      :turns,
      :label_calls,
      :messages,
      :finish,
      :cost_usd,
      :error,
      :session_id,
      :user_id
    ])
    |> validate_required([:kind, :status, :user_id])
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:request, max: 2_000)
    |> foreign_key_constraint(:session_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:session_id, name: :ai_video_runs_one_running_agent_run)
    |> unique_constraint(:session_id, name: :ai_video_runs_one_open_plan_run)
  end
end
