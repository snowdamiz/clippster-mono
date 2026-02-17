defmodule ClippsterServer.ModLogs.ModActionLog do
  use Ecto.Schema
  import Ecto.Changeset

  schema "mod_action_logs" do
    field :action_type, :string
    field :target_type, :string
    field :target_id, :integer
    field :details, :map, default: %{}
    
    belongs_to :moderator, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc false
  def changeset(mod_action_log, attrs) do
    mod_action_log
    |> cast(attrs, [:moderator_id, :action_type, :target_type, :target_id, :details])
    |> validate_required([:moderator_id, :action_type, :target_type, :target_id])
  end
end
