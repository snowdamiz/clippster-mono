defmodule ClippsterServer.Design.ImageEditorProject do
  use Ecto.Schema
  import Ecto.Changeset

  schema "image_editor_projects" do
    field :name, :string
    field :project_data, :map
    field :thumbnail_url, :string
    field :canvas_width, :integer
    field :canvas_height, :integer

    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(project, attrs) do
    project
    |> cast(attrs, [
      :name,
      :project_data,
      :thumbnail_url,
      :canvas_width,
      :canvas_height,
      :user_id
    ])
    |> validate_required([:name, :project_data, :user_id])
    |> foreign_key_constraint(:user_id)
  end
end
