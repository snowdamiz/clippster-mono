defmodule ClippsterServer.AppSettings.Setting do
  @moduledoc """
  Schema for application-wide settings stored in the database.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:key, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "app_settings" do
    field :value, :string

    timestamps()
  end

  @doc false
  def changeset(setting, attrs) do
    setting
    |> cast(attrs, [:key, :value])
    |> validate_required([:key, :value])
  end
end
