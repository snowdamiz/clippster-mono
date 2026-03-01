defmodule ClippsterServer.AdminMessaging.EmailCampaign do
  use Ecto.Schema
  import Ecto.Changeset

  schema "admin_email_campaigns" do
    field :subject, :string
    field :body, :string
    field :audience, :string
    field :target_email, :string
    field :sent_at, :utc_datetime
    field :recipient_count, :integer, default: 0
    field :status, :string, default: "draft"

    belongs_to :sender, ClippsterServer.Accounts.User, foreign_key: :sent_by

    timestamps(type: :utc_datetime)
  end

  @valid_audiences ~w(waitlist all_users individual)
  @valid_statuses ~w(draft sent failed)

  def changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [
      :subject,
      :body,
      :audience,
      :target_email,
      :sent_by,
      :sent_at,
      :recipient_count,
      :status
    ])
    |> validate_required([:subject, :body, :audience])
    |> validate_inclusion(:audience, @valid_audiences)
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_individual_email()
  end

  defp validate_individual_email(changeset) do
    case get_field(changeset, :audience) do
      "individual" ->
        validate_required(changeset, [:target_email])

      _ ->
        changeset
    end
  end
end
