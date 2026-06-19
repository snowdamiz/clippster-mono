defmodule ClippsterServer.AdminMessaging.EmailCampaignRecipient do
  use Ecto.Schema
  import Ecto.Changeset

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
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/,
      message: "must be a valid email address"
    )
    |> validate_inclusion(:status, @valid_statuses)
    |> unique_constraint([:campaign_id, :email])
  end

  defp normalize_email(changeset) do
    update_change(changeset, :email, fn email ->
      email
      |> to_string()
      |> String.trim()
      |> String.downcase()
    end)
  end
end
