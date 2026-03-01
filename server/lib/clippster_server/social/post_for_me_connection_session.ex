defmodule ClippsterServer.Social.PostForMeConnectionSession do
  @moduledoc """
  Stores Post For Me connection sessions so browser callbacks can be completed
  asynchronously by Tauri/Web clients via polling.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.Organization
  alias ClippsterServer.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :id

  @scopes ~w(org user)
  @statuses ~w(pending callback_received synced failed expired)
  @return_modes ~w(dashboard tauri web)

  schema "post_for_me_connection_sessions" do
    field :scope, :string
    field :platform, :string
    field :external_id, :string
    field :status, :string, default: "pending"
    field :success, :boolean
    field :account_ids, {:array, :string}, default: []
    field :callback_payload, :map
    field :error_message, :string
    field :return_mode, :string, default: "tauri"
    field :return_url, :string
    field :expires_at, :utc_datetime

    belongs_to :organization, Organization
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def create_changeset(session, attrs) do
    session
    |> cast(attrs, [
      :scope,
      :organization_id,
      :user_id,
      :platform,
      :external_id,
      :status,
      :success,
      :account_ids,
      :callback_payload,
      :error_message,
      :return_mode,
      :return_url,
      :expires_at
    ])
    |> validate_required([
      :scope,
      :user_id,
      :platform,
      :external_id,
      :status,
      :return_mode,
      :expires_at
    ])
    |> validate_inclusion(:scope, @scopes)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:return_mode, @return_modes)
    |> validate_scope_fields()
    |> validate_length(:external_id, max: 255)
    |> unique_constraint(:external_id,
      name: :post_for_me_connection_sessions_external_id_index,
      message: "external_id already exists"
    )
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:user_id)
  end

  def update_changeset(session, attrs) do
    session
    |> cast(attrs, [
      :status,
      :success,
      :account_ids,
      :callback_payload,
      :error_message,
      :expires_at
    ])
    |> validate_inclusion(:status, @statuses)
  end

  def scopes, do: @scopes
  def statuses, do: @statuses
  def return_modes, do: @return_modes

  defp validate_scope_fields(changeset) do
    scope = get_field(changeset, :scope)
    organization_id = get_field(changeset, :organization_id)

    case {scope, organization_id} do
      {"org", nil} ->
        add_error(changeset, :organization_id, "is required when scope is org")

      {"user", org_id} when not is_nil(org_id) ->
        add_error(changeset, :organization_id, "must be empty when scope is user")

      _ ->
        changeset
    end
  end
end
