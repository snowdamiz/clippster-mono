defmodule ClippsterServerWeb.ProcessingJobController do
  @moduledoc """
  Controller for managing processing jobs and handling cancellation/refunds.
  All operations are server-authoritative and cannot be manipulated by the client.
  """

  use ClippsterServerWeb, :controller
  alias ClippsterServer.Credits

  @doc """
  Cancel a processing job and refund credits.

  POST /api/jobs/:job_id/cancel

  Security:
  - Requires valid JWT token
  - Job must belong to the authenticated user
  - Job must be in 'processing' status
  - Cannot double-refund
  """
  def cancel(conn, %{"job_id" => job_id}) do
    case get_user_id_from_token(conn) do
      {:ok, user_id, _is_admin} ->
        IO.puts("[ProcessingJobController] Cancel request for job #{job_id} by user #{user_id}")

        case Credits.cancel_processing_job(job_id, user_id, "User cancelled via API") do
          {:ok, %{job: job, refunded: refund_amount}} ->
            IO.puts(
              "[ProcessingJobController] Successfully cancelled job #{job_id}, refunded #{Decimal.to_string(refund_amount)} credits"
            )

            # Get updated balance
            {:ok, balance} = Credits.get_user_balance(user_id)

            json(conn, %{
              success: true,
              message: "Job cancelled and credits refunded",
              job_id: job.id,
              credits_refunded: Decimal.to_float(refund_amount),
              new_balance: %{
                hours_remaining: Decimal.to_float(balance.hours_remaining),
                hours_used: Decimal.to_float(balance.hours_used)
              }
            })

          {:error, :job_not_found} ->
            IO.puts("[ProcessingJobController] Job #{job_id} not found")

            conn
            |> put_status(404)
            |> json(%{
              success: false,
              error: "Job not found",
              details: "The specified job does not exist"
            })

          {:error, :unauthorized} ->
            IO.puts("[ProcessingJobController] Unauthorized cancel attempt for job #{job_id}")

            conn
            |> put_status(403)
            |> json(%{
              success: false,
              error: "Unauthorized",
              details: "You do not have permission to cancel this job"
            })

          {:error, :job_not_cancellable} ->
            IO.puts(
              "[ProcessingJobController] Job #{job_id} is not cancellable (not in processing status)"
            )

            conn
            |> put_status(400)
            |> json(%{
              success: false,
              error: "Job not cancellable",
              details: "Only jobs in 'processing' status can be cancelled"
            })

          {:error, :already_refunded} ->
            IO.puts("[ProcessingJobController] Job #{job_id} was already refunded")

            conn
            |> put_status(400)
            |> json(%{
              success: false,
              error: "Already refunded",
              details: "Credits have already been refunded for this job"
            })

          {:error, reason} ->
            IO.puts(
              "[ProcessingJobController] Failed to cancel job #{job_id}: #{inspect(reason)}"
            )

            conn
            |> put_status(500)
            |> json(%{
              success: false,
              error: "Cancellation failed",
              details: inspect(reason)
            })
        end

      {:error, reason} ->
        IO.puts("[ProcessingJobController] Authentication failed: #{inspect(reason)}")

        conn
        |> put_status(401)
        |> json(%{
          success: false,
          error: "Authentication required",
          details: "Please authenticate to cancel jobs"
        })
    end
  end

  @doc """
  Cancel a job by project ID (convenience endpoint).
  Finds the active processing job for the given project and cancels it.

  POST /api/jobs/cancel-by-project
  Body: { "project_id": "..." }
  """
  def cancel_by_project(conn, %{"project_id" => project_id}) do
    case get_user_id_from_token(conn) do
      {:ok, user_id, _is_admin} ->
        IO.puts(
          "[ProcessingJobController] Cancel by project request for #{project_id} by user #{user_id}"
        )

        case Credits.cancel_job_by_project(project_id, user_id, "User cancelled via API") do
          {:ok, %{job: job, refunded: refund_amount}} ->
            IO.puts(
              "[ProcessingJobController] Successfully cancelled job for project #{project_id}, refunded #{Decimal.to_string(refund_amount)} credits"
            )

            {:ok, balance} = Credits.get_user_balance(user_id)

            json(conn, %{
              success: true,
              message: "Job cancelled and credits refunded",
              job_id: job.id,
              project_id: project_id,
              credits_refunded: Decimal.to_float(refund_amount),
              new_balance: %{
                hours_remaining: Decimal.to_float(balance.hours_remaining),
                hours_used: Decimal.to_float(balance.hours_used)
              }
            })

          {:error, :no_active_job} ->
            IO.puts("[ProcessingJobController] No active job found for project #{project_id}")

            conn
            |> put_status(404)
            |> json(%{
              success: false,
              error: "No active job",
              details: "No active processing job found for this project"
            })

          {:error, reason} ->
            IO.puts(
              "[ProcessingJobController] Failed to cancel job for project #{project_id}: #{inspect(reason)}"
            )

            conn
            |> put_status(500)
            |> json(%{
              success: false,
              error: "Cancellation failed",
              details: inspect(reason)
            })
        end

      {:error, reason} ->
        IO.puts("[ProcessingJobController] Authentication failed: #{inspect(reason)}")

        conn
        |> put_status(401)
        |> json(%{
          success: false,
          error: "Authentication required",
          details: "Please authenticate to cancel jobs"
        })
    end
  end

  @doc """
  Get the status of a processing job.

  GET /api/jobs/:job_id
  """
  def show(conn, %{"job_id" => job_id}) do
    case get_user_id_from_token(conn) do
      {:ok, user_id, _is_admin} ->
        case Credits.get_processing_job(job_id, user_id) do
          {:ok, job} ->
            json(conn, %{
              success: true,
              job: %{
                id: job.id,
                status: job.status,
                credits_deducted: Decimal.to_float(job.credits_deducted),
                credits_refunded: Decimal.to_float(job.credits_refunded || Decimal.new("0")),
                duration_hours: Decimal.to_float(job.video_duration_hours),
                project_id: job.project_id,
                job_type: job.job_type,
                cancelled_at: job.cancelled_at,
                created_at: job.inserted_at
              }
            })

          {:error, :not_found} ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "Job not found"})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Unauthorized"})
        end

      {:error, _reason} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Authentication required"})
    end
  end

  # Helper to get user_id from JWT token (same pattern as ClipsController)
  defp get_user_id_from_token(conn) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, claims} <- ClippsterServer.Auth.TokenGenerator.verify_token(token) do
      user_id = Map.get(claims, "user_id") || Map.get(claims, "sub")
      is_admin = Map.get(claims, "is_admin", false)
      {:ok, user_id, is_admin}
    else
      _ -> {:error, :invalid_token}
    end
  end
end
