defmodule ClippsterServerWeb.CloudProjectController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.{CloudMedia, CloudProjects, StorageQuotas}

  action_fallback ClippsterServerWeb.FallbackController

  def index(conn, params) do
    user_id = conn.assigns.current_user_id
    since = Map.get(params, "since")

    projects =
      user_id
      |> CloudProjects.list_for_user(since: since)
      |> Enum.map(&CloudProjects.project_summary/1)

    json(conn, %{success: true, projects: projects})
  end

  def create(conn, %{"snapshot" => snapshot} = params) do
    user_id = conn.assigns.current_user_id
    device_id = Map.get(params, "device_id")
    client_updated_at = Map.get(params, "client_updated_at")

    case CloudProjects.create_from_snapshot(user_id, snapshot, device_id, client_updated_at) do
      {:ok, project} ->
        conn
        |> put_status(:created)
        |> json(%{success: true, project: CloudProjects.project_summary(project)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def show(conn, %{"id" => id}) do
    user_id = conn.assigns.current_user_id

    case CloudProjects.full_project_response(user_id, id) do
      {:ok, data} ->
        json(conn, Map.put(data, :success, true))

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: "not_found"})
    end
  end

  def update(conn, %{"id" => id, "snapshot" => snapshot} = params) do
    user_id = conn.assigns.current_user_id
    device_id = Map.get(params, "device_id")
    client_updated_at = Map.get(params, "client_updated_at")
    force = get_req_header(conn, "x-cloud-sync-force") == ["true"]

    case CloudProjects.push_snapshot(user_id, id, snapshot, device_id, client_updated_at, force) do
      {:ok, project} ->
        json(conn, %{success: true, project: CloudProjects.project_summary(project)})

      {:error, :conflict, body} ->
        conn
        |> put_status(:conflict)
        |> json(Map.merge(%{success: false, error: "conflict"}, body))

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def delete(conn, %{"id" => id}) do
    user_id = conn.assigns.current_user_id

    case CloudProjects.soft_delete(user_id, id) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: "not_found"})
    end
  end

  def storage_quota(conn, _params) do
    user_id = conn.assigns.current_user_id

    case StorageQuotas.quota_summary(user_id) do
      %{bytes_used: _} = summary ->
        json(conn, Map.put(summary, :success, true))

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def register_device(conn, params) do
    user_id = conn.assigns.current_user_id
    device_id = Map.get(params, "device_id")
    platform = Map.get(params, "platform", "unknown")
    device_name = Map.get(params, "device_name")

    case CloudProjects.register_device(user_id, device_id, platform, device_name) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  def bulk_sync(conn, params) do
    user_id = conn.assigns.current_user_id
    device_id = Map.get(params, "device_id")
    projects = Map.get(params, "projects", [])
    platform = Map.get(params, "platform", "unknown")
    device_name = Map.get(params, "device_name")

    _ = CloudProjects.register_device(user_id, device_id, platform, device_name)

    case CloudProjects.bulk_sync(user_id, device_id, projects) do
      {:ok, result} ->
        json(conn, Map.put(result, :success, true))
    end
  end

  def presigned_upload(conn, %{"id" => project_id} = params) do
    user_id = conn.assigns.current_user_id

    with {:ok, _} <- CloudProjects.get_project!(user_id, project_id),
         {:ok, result} <- CloudMedia.create_presigned_upload(user_id, project_id, params) do
      json(conn, Map.put(result, :success, true))
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "not_found"})

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          success: false,
          error: "quota_exceeded",
          message: "Cloud storage quota exceeded. Upgrade your plan to upload media."
        })

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def complete_upload(conn, %{"id" => project_id, "asset_id" => asset_id} = params) do
    user_id = conn.assigns.current_user_id

    case CloudMedia.complete_upload(user_id, project_id, asset_id, params) do
      {:ok, asset} ->
        json(conn, %{
          success: true,
          asset: %{
            id: asset.id,
            size_bytes: asset.size_bytes,
            upload_status: asset.upload_status
          }
        })

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "not_found"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def presigned_download(conn, %{"id" => project_id, "asset_id" => asset_id}) do
    user_id = conn.assigns.current_user_id

    case CloudMedia.presigned_download(user_id, project_id, asset_id) do
      {:ok, url} ->
        json(conn, %{success: true, download_url: url})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "not_found"})

      {:error, :not_ready} ->
        conn |> put_status(:conflict) |> json(%{success: false, error: "not_ready"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  def delete_media(conn, %{"id" => project_id, "asset_id" => asset_id}) do
    user_id = conn.assigns.current_user_id

    case CloudMedia.delete_asset(user_id, project_id, asset_id) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "not_found"})
    end
  end

  def subscription_checkout(conn, %{"tier" => tier}) when tier in ["cloud_50", "cloud_200"] do
    user_id = conn.assigns.current_user_id

    case StorageQuotas.set_tier(user_id, tier) do
      {:ok, quota} ->
        json(conn, %{
          success: true,
          tier: quota.tier,
          bytes_limit: quota.bytes_limit,
          message: "Cloud storage tier updated. Stripe checkout integration pending."
        })

      {:error, _} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "checkout_failed"})
    end
  end

  def subscription_checkout(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "invalid_tier"})
  end

  def admin_set_quota(conn, %{"user_id" => user_id} = params) do
    attrs =
      params
      |> Map.take(["tier", "bytes_limit", "bytes_used"])
      |> Enum.map(fn {k, v} -> {String.to_atom(k), v} end)
      |> Map.new()

    user_id = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

    case StorageQuotas.admin_set_quota(user_id, attrs) do
      {:ok, quota} ->
        json(conn, %{
          success: true,
          quota: %{
            tier: quota.tier,
            bytes_used: quota.bytes_used,
            bytes_limit: quota.bytes_limit
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)
    |> inspect()
  end
end
