defmodule ClippsterServer.AdminMessaging.EmailCampaignRecipient do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.AdminMessaging.EmailAddress

  schema "admin_email_campaign_recipients" do
    field :email, :string
    field :status, :string, default: "pending"
    field :sent_at, :utc_datetime
    field :error, :string

    belongs_to :campaign, ClippsterServer.AdminMessaging.EmailCampaign

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(pending sent failed)

  def changeset(recipient, attrs) do
    recipient
    |> cast(attrs, [:campaign_id, :email, :status, :sent_at, :error])
    |> normalize_email()
    |> validate_required([:campaign_id, :email, :status])
    |> EmailAddress.validate_email()
    |> validate_inclusion(:status, @valid_statuses)
    |> unique_constraint([:campaign_id, :email])
  end

  defp normalize_email(changeset) do
    update_change(changeset, :email, &EmailAddress.normalize/1)
  end
end
