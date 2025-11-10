defmodule ClippsterServer.Support.BugReport do
  use Ecto.Schema
  import Ecto.Changeset

  schema "bug_reports" do
    field :title, :string
    field :description, :string
    field :severity, :string, default: "medium"
    field :expected_behavior, :string
    field :actual_behavior, :string
    field :user_wallet_address, :string
    field :status, :string, default: "open"

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(bug_report, attrs) do
    bug_report
    |> cast(attrs, [:title, :description, :severity, :expected_behavior, :actual_behavior, :user_wallet_address, :status])
    |> validate_required([:title, :description, :user_wallet_address])
    |> validate_inclusion(:severity, ["low", "medium", "high", "critical"])
    |> validate_inclusion(:status, ["open", "in_progress", "resolved", "closed"])
    |> validate_length(:title, min: 3, max: 200)
    |> validate_length(:description, min: 10, max: 5000)
    |> validate_wallet_address()
  end

  defp validate_wallet_address(changeset) do
    validate_change(changeset, :user_wallet_address, fn :user_wallet_address, wallet_address ->
      if String.length(wallet_address) >= 32 do
        []
      else
        [user_wallet_address: "must be a valid wallet address"]
      end
    end)
  end
end