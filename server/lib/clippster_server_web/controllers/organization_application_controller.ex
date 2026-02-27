defmodule ClippsterServerWeb.OrganizationApplicationController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  # Handle OPTIONS requests for CORS preflight
  def options(conn, _params) do
    conn
    |> put_resp_header(
      "access-control-allow-origin",
      get_req_header(conn, "origin") |> List.first() || "*"
    )
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    |> put_resp_header(
      "access-control-allow-headers",
      "Authorization, Content-Type, Accept, Origin, X-Requested-With"
    )
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(200, "")
  end

  # Get the current user's organization application
  def my_application(conn, _params) do
    user = conn.assigns[:current_user]

    case Organizations.get_user_organization_application(user.id) do
      nil ->
        json(conn, %{
          success: true,
          application: nil
        })

      application ->
        json(conn, %{
          success: true,
          application: %{
            id: application.id,
            name: application.name,
            description: application.description,
            website: application.website,
            team_size: application.team_size,
            use_case: application.use_case,
            contact_email: application.contact_email,
            logo_url: presign_url(application.logo_url),
            status: application.status,
            admin_notes: application.admin_notes,
            reviewed_by:
              if(application.reviewed_by,
                do: %{
                  id: application.reviewed_by.id,
                  email: application.reviewed_by.email,
                  name: application.reviewed_by.name
                },
                else: nil
              ),
            reviewed_at: application.reviewed_at,
            inserted_at: application.inserted_at,
            updated_at: application.updated_at
          }
        })
    end
  end

  # Create a new organization application (authenticated users)
  def create(conn, params) do
    user = conn.assigns[:current_user]

    application_params = %{
      name: params["name"],
      description: params["description"],
      website: params["website"],
      team_size: params["team_size"],
      use_case: params["use_case"],
      contact_email: params["contact_email"]
    }

    case Organizations.create_organization_application(user, application_params) do
      {:ok, application} ->
        conn
        |> put_status(201)
        |> json(%{
          success: true,
          message: "Organization application submitted successfully",
          application: %{
            id: application.id,
            name: application.name,
            status: application.status,
            inserted_at: application.inserted_at
          }
        })

      {:error, :application_pending} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "You already have a pending application"
        })

      {:error, :application_already_approved} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Your application has already been approved"
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
          error: "Failed to submit application",
          details: errors
        })
    end
  end

  # List all organization applications (admin only)
  def index(conn, params) do
    opts = [
      status: params["status"]
    ]

    applications = Organizations.list_organization_applications(opts)

    formatted_applications =
      applications
      |> Enum.map(fn app ->
        %{
          id: app.id,
          name: app.name,
          description: app.description,
          website: app.website,
          team_size: app.team_size,
          use_case: app.use_case,
          contact_email: app.contact_email,
          logo_url: presign_url(app.logo_url),
          status: app.status,
          admin_notes: app.admin_notes,
          user:
            if(app.user,
              do: %{
                id: app.user.id,
                email: app.user.email,
                name: app.user.name,
                wallet_address: app.user.wallet_address
              },
              else: nil
            ),
          reviewed_by:
            if(app.reviewed_by,
              do: %{
                id: app.reviewed_by.id,
                email: app.reviewed_by.email,
                name: app.reviewed_by.name
              },
              else: nil
            ),
          reviewed_at: app.reviewed_at,
          inserted_at: app.inserted_at,
          updated_at: app.updated_at
        }
      end)

    json(conn, %{
      success: true,
      applications: formatted_applications,
      count: length(formatted_applications)
    })
  end

  # Approve an organization application (admin only)
  def approve(conn, %{"id" => id} = params) do
    admin = conn.assigns[:current_user]
    admin_notes = params["admin_notes"]

    case Organizations.approve_organization_application(id, admin_notes, admin) do
      {:ok, %{application: application, organization: organization}} ->
        json(conn, %{
          success: true,
          message: "Application approved and organization created",
          application: %{
            id: application.id,
            status: application.status,
            reviewed_at: application.reviewed_at
          },
          organization: %{
            id: organization.id,
            name: organization.name,
            slug: organization.slug
          }
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found"})

      {:error, :already_processed} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Application has already been processed"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Failed to approve application",
          details: inspect(reason)
        })
    end
  end

  # Reject an organization application (admin only)
  def reject(conn, %{"id" => id} = params) do
    admin = conn.assigns[:current_user]
    admin_notes = params["admin_notes"]

    case Organizations.reject_organization_application(id, admin_notes, admin) do
      {:ok, application} ->
        json(conn, %{
          success: true,
          message: "Application rejected",
          application: %{
            id: application.id,
            status: application.status,
            admin_notes: application.admin_notes,
            reviewed_at: application.reviewed_at
          }
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found"})

      {:error, :already_processed} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Application has already been processed"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{
          success: false,
          error: "Failed to reject application",
          details: inspect(reason)
        })
    end
  end

  # Update user's own organization application
  def update(conn, %{"id" => id} = params) do
    user = conn.assigns[:current_user]

    application_params = %{
      name: params["name"],
      description: params["description"],
      website: params["website"],
      team_size: params["team_size"],
      use_case: params["use_case"],
      contact_email: params["contact_email"]
    }

    case Organizations.update_organization_application(id, application_params, user) do
      {:ok, application} ->
        json(conn, %{
          success: true,
          message: "Application updated successfully",
          application: %{
            id: application.id,
            name: application.name,
            status: application.status,
            updated_at: application.updated_at
          }
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You can only update your own applications"})

      {:error, :cannot_update_processed_application} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Cannot update an application that has already been processed"
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
          error: "Failed to update application",
          details: errors
        })
    end
  end

  # Delete user's own organization application
  def delete_own(conn, %{"id" => id}) do
    user = conn.assigns[:current_user]

    case Organizations.delete_organization_application(id, user) do
      {:ok, _} ->
        json(conn, %{
          success: true,
          message: "Application deleted successfully"
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You can only delete your own applications"})

      {:error, _} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to delete application"})
    end
  end

  # Delete an organization application (admin only)
  def delete(conn, %{"id" => id}) do
    case Organizations.delete_organization_application(id) do
      {:ok, _} ->
        json(conn, %{
          success: true,
          message: "Application deleted successfully"
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found"})

      {:error, _} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to delete application"})
    end
  end

  # Upload logo for organization application
  def upload_logo(conn, %{"id" => id} = params) do
    user = conn.assigns[:current_user]

    with application when not is_nil(application) <-
           Organizations.get_organization_application(id),
         true <- application.user_id == user.id,
         true <- application.status == "pending",
         %Plug.Upload{path: temp_path, filename: filename} <- params["file"] do
      # Read file contents
      {:ok, file_binary} = File.read(temp_path)

      # Generate storage key
      key = "org-applications/#{id}/logo-#{System.unique_integer([:positive])}-#{filename}"

      # Determine content type
      content_type = MIME.from_path(filename)

      # Upload to R2
      case Storage.upload_file(file_binary, key, content_type: content_type) do
        {:ok, url} ->
          # Update application with logo URL
          case Organizations.update_organization_application(id, %{logo_url: url}, user) do
            {:ok, _updated_app} ->
              json(conn, %{
                success: true,
                url: Storage.presigned_url!(url),
                logo_url: url
              })

            {:error, _} ->
              conn
              |> put_status(500)
              |> json(%{success: false, error: "Failed to save logo URL"})
          end

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to upload logo: #{inspect(reason)}"})
      end
    else
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Application not found or no file provided"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Unauthorized or application cannot be modified"})

      _ ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid request"})
    end
  end

  # Helper to presign URLs
  defp presign_url(nil), do: nil
  defp presign_url(url), do: Storage.presigned_url!(url)
end
