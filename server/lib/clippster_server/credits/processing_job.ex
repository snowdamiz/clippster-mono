defmodule ClippsterServer.Credits.ProcessingJob do
  @moduledoc """
  Schema for tracking processing jobs and their credit charges.
  Used for secure credit refunds when jobs are cancelled.
  """

  use Ecto.Schema
  import Ecto.Changeset

  # Use default integer primary key to match users table
  schema "processing_jobs" do
    # References users table which uses integer IDs
    field :user_id, :id
    field :video_duration_hours, :decimal
    field :credits_deducted, :decimal
    field :credits_refunded, :decimal, default: Decimal.new("0")
    # processing, completed, failed, cancelled
    field :status, :string
    field :video_url, :string
    field :result_data, :map
    field :project_id, :string
    field :job_type, :string, default: "clip_detection"
    field :organization_id, :id
    field :cancelled_at, :utc_datetime
    field :refund_reason, :string

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new processing job.
  """
  def create_changeset(attrs) do
    %__MODULE__{}
    |> cast(attrs, [
      :user_id,
      :video_duration_hours,
      :credits_deducted,
      :status,
      :video_url,
      :project_id,
      :job_type,
      :organization_id
    ])
    |> validate_required([:user_id, :video_duration_hours, :credits_deducted, :status])
    |> validate_inclusion(:status, ["processing", "completed", "failed", "cancelled"])
    |> validate_number(:credits_deducted, greater_than_or_equal_to: 0)
  end

  @doc """
  Changeset for marking a job as completed.
  """
  def complete_changeset(job, result_data \\ nil) do
    job
    |> cast(%{status: "completed", result_data: result_data}, [:status, :result_data])
    |> validate_inclusion(:status, ["completed"])
  end

  @doc """
  Changeset for marking a job as failed.
  """
  def fail_changeset(job, error_info \\ nil) do
    job
    |> cast(%{status: "failed", result_data: error_info}, [:status, :result_data])
    |> validate_inclusion(:status, ["failed"])
  end

  @doc """
  Changeset for cancelling a job and recording refund.
  Only jobs in 'processing' status can be cancelled.
  """
  def cancel_changeset(job, refund_amount, reason \\ "User cancelled") do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    job
    |> cast(
      %{
        status: "cancelled",
        credits_refunded: refund_amount,
        cancelled_at: now,
        refund_reason: reason
      },
      [:status, :credits_refunded, :cancelled_at, :refund_reason]
    )
    |> validate_required([:credits_refunded, :cancelled_at])
    |> validate_inclusion(:status, ["cancelled"])
    |> validate_number(:credits_refunded, greater_than_or_equal_to: 0)
  end

  @doc """
  Returns true if the job can be cancelled (only processing jobs can be cancelled).
  """
  def can_cancel?(%__MODULE__{status: "processing"}), do: true
  def can_cancel?(_), do: false

  @doc """
  Returns true if a refund was issued for this job.
  """
  def was_refunded?(%__MODULE__{credits_refunded: refunded}) do
    refunded && Decimal.compare(refunded, Decimal.new("0")) == :gt
  end
end
