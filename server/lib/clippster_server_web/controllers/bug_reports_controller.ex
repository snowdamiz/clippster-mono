defmodule ClippsterServerWeb.BugReportsController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Support

  # Handle OPTIONS requests for CORS preflight
  def options(conn, _params) do
    conn
    |> put_resp_header("access-control-allow-origin", get_req_header(conn, "origin") |> List.first() || "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(200, "")
  end

  # Create a new bug report
  def create(conn, %{"title" => title, "description" => description} = params) do
    # Get wallet address from JWT token or from params
    wallet_address = get_wallet_address_from_token(conn) || params["user_wallet_address"]

    if !wallet_address do
      conn
      |> put_status(401)
      |> json(%{success: false, error: "Authentication required"})
    else
      bug_report_params = %{
        title: String.trim(title),
        description: String.trim(description),
        severity: Map.get(params, "severity", "medium"),
        expected_behavior: params["expected_behavior"] |> maybe_trim(),
        actual_behavior: params["actual_behavior"] |> maybe_trim(),
        user_wallet_address: wallet_address
      }

      case Support.create_bug_report(bug_report_params) do
        {:ok, bug_report} ->
          conn
          |> put_status(201)
          |> json(%{
            success: true,
            message: "Bug report created successfully",
            bug_report: %{
              id: bug_report.id,
              title: bug_report.title,
              severity: bug_report.severity,
              status: bug_report.status,
              inserted_at: bug_report.inserted_at
            }
          })

        {:error, changeset} ->
          errors =
            changeset
            |> Ecto.Changeset.traverse_errors(fn {msg, opts} ->
              Enum.reduce(opts, msg, fn {key, value}, acc ->
                String.replace(acc, "%{#{key}}", to_string(value))
              end)
            end)

          conn
          |> put_status(400)
          |> json(%{
            success: false,
            error: "Failed to create bug report",
            details: errors
          })
      end
    end
  end

  # List all bug reports (admin only)
  def index(conn, params) do
    # Extract query parameters
    opts = [
      status: params["status"],
      severity: params["severity"]
    ]

    bug_reports = Support.list_bug_reports(opts)

    # Format bug reports for JSON response
    formatted_reports =
      bug_reports
      |> Enum.map(fn bug_report ->
        %{
          id: bug_report.id,
          title: bug_report.title,
          description: bug_report.description,
          severity: bug_report.severity,
          expected_behavior: bug_report.expected_behavior,
          actual_behavior: bug_report.actual_behavior,
          user_wallet_address: bug_report.user_wallet_address,
          status: bug_report.status,
          inserted_at: bug_report.inserted_at,
          updated_at: bug_report.updated_at
        }
      end)

    json(conn, %{
      success: true,
      bug_reports: formatted_reports,
      count: length(formatted_reports)
    })
  end

  # Update a bug report status (admin only)
  def update(conn, %{"id" => id} = params) do
    case Support.get_bug_report!(id) do
      bug_report ->
        update_params = %{
          status: Map.get(params, "status", bug_report.status)
        }

        case Support.update_bug_report(bug_report, update_params) do
          {:ok, updated_bug_report} ->
            json(conn, %{
              success: true,
              message: "Bug report updated successfully",
              bug_report: %{
                id: updated_bug_report.id,
                title: updated_bug_report.title,
                status: updated_bug_report.status,
                updated_at: updated_bug_report.updated_at
              }
            })

          {:error, changeset} ->
            errors =
              changeset
              |> Ecto.Changeset.traverse_errors(fn {msg, opts} ->
                Enum.reduce(opts, msg, fn {key, value}, acc ->
                  String.replace(acc, "%{#{key}}", to_string(value))
                end)
              end)

            conn
            |> put_status(400)
            |> json(%{
              success: false,
              error: "Failed to update bug report",
              details: errors
            })
        end
    end
  end

  # Delete a bug report (admin only)
  def delete(conn, %{"id" => id}) do
    case Support.get_bug_report!(id) do
      bug_report ->
        case Support.delete_bug_report(bug_report) do
          {:ok, _} ->
            json(conn, %{
              success: true,
              message: "Bug report deleted successfully"
            })

          {:error, _} ->
            conn
            |> put_status(500)
            |> json(%{
              success: false,
              error: "Failed to delete bug report"
            })
        end
    end
  end

  # Private helper functions

  defp get_wallet_address_from_token(conn) do
    # Get Authorization header
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        # Decode JWT token (simplified version - you may want to use a proper JWT library)
        case ClippsterServer.Auth.TokenGenerator.verify_token(token) do
          {:ok, claims} ->
            claims["wallet_address"]
          {:error, _} ->
            nil
        end

      _ ->
        nil
    end
  end

  defp maybe_trim(nil), do: nil
  defp maybe_trim(string) when is_binary(string), do: String.trim(string)
  defp maybe_trim(_), do: nil
end