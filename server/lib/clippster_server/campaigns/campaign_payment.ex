defmodule ClippsterServer.Campaigns.CampaignPayment do
  @moduledoc """
  Schema for payments made to clippers for their submissions.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Campaigns.{Campaign, CampaignSubmission, ClipperPaymentMethod}

  @statuses ~w(pending verified completed failed)

  schema "campaign_payments" do
    field :amount, :decimal
    field :views_at_payment, :integer
    field :status, :string, default: "pending"
    field :external_transaction_id, :string
    field :paid_at, :utc_datetime
    field :verification_screenshot_url, :string
    field :verification_notes, :string
    field :payment_date, :date
    field :clipper_notified_at, :utc_datetime

    belongs_to :campaign, Campaign
    belongs_to :submission, CampaignSubmission
    belongs_to :user, User
    belongs_to :payment_method, ClipperPaymentMethod
    belongs_to :paid_by_user, User, foreign_key: :paid_by_user_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new payment.
  """
  def create_changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :campaign_id,
      :submission_id,
      :user_id,
      :amount,
      :views_at_payment,
      :payment_method_id
    ])
    |> validate_required([:campaign_id, :submission_id, :user_id, :amount])
    |> validate_number(:amount, greater_than: 0)
    |> validate_number(:views_at_payment, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:submission_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:payment_method_id)
  end

  @doc """
  Changeset for marking payment as processing.
  """
  def processing_changeset(payment, attrs \\ %{}) do
    payment
    |> cast(attrs, [:external_transaction_id])
    |> put_change(:status, "processing")
  end

  @doc """
  Changeset for marking payment as completed.
  """
  def complete_changeset(payment, attrs) do
    payment
    |> cast(attrs, [:external_transaction_id, :paid_by_user_id])
    |> put_change(:status, "completed")
    |> put_change(:paid_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> foreign_key_constraint(:paid_by_user_id)
  end

  @doc """
  Changeset for marking payment as failed.
  """
  def fail_changeset(payment) do
    payment
    |> change(status: "failed")
  end

  @doc """
  Changeset for payment verification (manual payment proof submission).
  """
  def verification_changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :verification_screenshot_url,
      :verification_notes,
      :payment_date,
      :paid_by_user_id
    ])
    |> put_change(:status, "verified")
    |> put_change(:paid_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> put_change(:clipper_notified_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> validate_required([:verification_notes])
    |> foreign_key_constraint(:paid_by_user_id)
  end

  def statuses, do: @statuses
end
