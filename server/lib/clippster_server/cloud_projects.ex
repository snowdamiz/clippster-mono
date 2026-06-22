defmodule ClippsterServer.CloudProjects do
  @moduledoc """
  Cloud project snapshots with last-write-wins conflict detection.
  """

  import Ecto.Query
  alias ClippsterServer.{CloudMedia, CloudProjects.CloudProject, CloudProjects.CloudProjectSnapshot, CloudProjects.CloudSyncDevice, Repo}

  def list_for_user(user_id, opts \\ []) do
    since = Keyword.get(opts, :since)

    query =
      CloudProject
      |> where([p], p.user_id == ^user_id)
      |> order_by([p], desc: p.server_updated_at)

    query =
      if since do
        case parse_sync_token(since) do
          {:ok, dt} -> where(query, [p], p.server_updated_at > ^dt)
          :error -> query
        end
      else
        where(query, [p], is_nil(p.deleted_at))
      end

    Repo.all(query)
  end

  def get_project(user_id, project_id) do
    Repo.get_by(CloudProject, id: project_id, user_id: user_id)
  end

  def get_project!(user_id, project_id) do
    case get_project(user_id, project_id) do
      nil -> {:error, :not_found}
      project -> {:ok, project}
    end
  end

  def get_latest_snapshot(project_id) do
    CloudProjectSnapshot
    |> where([s], s.cloud_project_id == ^project_id)
    |> order_by([s], desc: s.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  def create_from_snapshot(user_id, snapshot, device_id, client_updated_at) do
    project_id = get_in(snapshot, ["project", "id"]) || get_in(snapshot, [:project, :id])
    name = get_in(snapshot, ["project", "name"]) || get_in(snapshot, [:project, :name]) || "Untitled"

    with {:ok, _} <- validate_snapshot(snapshot),
         {:ok, project} <- insert_project(user_id, project_id, name, device_id, client_updated_at),
         {:ok, _} <- insert_snapshot_row(project.id, snapshot) do
      {:ok, project}
    end
  end

  def push_snapshot(user_id, project_id, snapshot, device_id, client_updated_at, force \\ false) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    with {:ok, _} <- validate_snapshot(snapshot),
         {:ok, project} <- get_or_create_project(user_id, project_id, snapshot, device_id, client_updated_at) do
      cond do
        force ->
          do_push(project, snapshot, device_id, client_updated_at, now)

        stale_push?(project, client_updated_at) ->
          server_snapshot = get_latest_snapshot(project.id)

          {:error, :conflict,
           %{
             server_updated_at: datetime_to_ms(project.server_updated_at),
             last_writer_device_id: project.last_writer_device_id,
             snapshot: server_snapshot && server_snapshot.snapshot_json
           }}

        true ->
          do_push(project, snapshot, device_id, client_updated_at, now)
      end
    end
  end

  def soft_delete(user_id, project_id) do
    case get_project(user_id, project_id) do
      nil ->
        {:error, :not_found}

      project ->
        project
        |> CloudProject.soft_delete_changeset()
        |> Repo.update()
    end
  end

  def register_device(user_id, device_id, platform, device_name \\ nil) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    case Repo.get_by(CloudSyncDevice, user_id: user_id, device_id: device_id) do
      nil ->
        %CloudSyncDevice{}
        |> CloudSyncDevice.changeset(%{
          user_id: user_id,
          device_id: device_id,
          platform: platform,
          device_name: device_name,
          last_seen_at: now
        })
        |> Repo.insert()

      device ->
        device
        |> Ecto.Changeset.change(last_seen_at: now, device_name: device_name || device.device_name)
        |> Repo.update()
    end
  end

  def bulk_sync(user_id, device_id, local_projects) when is_list(local_projects) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    _ = register_device(user_id, device_id, "unknown", nil)

    cloud_projects =
      CloudProject
      |> where([p], p.user_id == ^user_id)
      |> Repo.all()

    cloud_map =
      cloud_projects
      |> Enum.map(fn p -> {p.id, p} end)
      |> Map.new()

    local_map =
      local_projects
      |> Enum.map(fn p ->
        id = p["id"] || p[:id]
        ts = p["client_updated_at"] || p[:client_updated_at] || 0
        {id, ts}
      end)
      |> Map.new()

    pull_ids =
      Enum.reduce(cloud_map, [], fn {id, cloud}, acc ->
        local_ts = Map.get(local_map, id)

        cond do
          not is_nil(cloud.deleted_at) ->
            acc

          is_nil(local_ts) ->
            [id | acc]

          cloud.client_updated_at && local_ts < cloud.client_updated_at ->
            [id | acc]

          cloud.server_updated_at &&
              local_ts < datetime_to_ms(cloud.server_updated_at) ->
            [id | acc]

          true ->
            acc
        end
      end)

    push_ids =
      Enum.reduce(local_map, [], fn {id, local_ts}, acc ->
        case Map.get(cloud_map, id) do
          nil ->
            [id | acc]

          %CloudProject{deleted_at: nil} = cloud ->
            cloud_ts = cloud.client_updated_at || datetime_to_ms(cloud.server_updated_at) || 0

            if local_ts > cloud_ts do
              [id | acc]
            else
              acc
            end

          _ ->
            acc
        end
      end)

    deleted_ids =
      cloud_projects
      |> Enum.filter(& &1.deleted_at)
      |> Enum.map(& &1.id)

    sync_token = encode_sync_token(now)

    {:ok,
     %{
       sync_token: sync_token,
       pull_ids: pull_ids,
       push_ids: push_ids,
       deleted_ids: deleted_ids
     }}
  end

  def project_summary(%CloudProject{} = project) do
  %{
      id: project.id,
      name: project.name,
      schema_version: project.schema_version,
      server_updated_at: datetime_to_ms(project.server_updated_at),
      client_updated_at: project.client_updated_at,
      deleted_at: project.deleted_at && DateTime.to_iso8601(project.deleted_at),
      last_writer_device_id: project.last_writer_device_id
    }
  end

  def full_project_response(user_id, project_id) do
    with {:ok, project} <- get_project!(user_id, project_id),
         snapshot <- get_latest_snapshot(project_id),
         manifest <- CloudMedia.media_manifest(project_id) do
      {:ok,
       %{
         project: project_summary(project),
         snapshot: snapshot && snapshot.snapshot_json,
         media_manifest: manifest
       }}
    end
  end

  defp do_push(project, snapshot, device_id, client_updated_at, now) do
    name = get_in(snapshot, ["project", "name"]) || get_in(snapshot, [:project, :name]) || project.name

    Repo.transaction(fn ->
      project
      |> CloudProject.update_meta_changeset(%{
        name: name,
        last_writer_device_id: device_id,
        client_updated_at: client_updated_at,
        server_updated_at: now
      })
      |> Repo.update!()

      insert_snapshot_row!(project.id, snapshot)
      project
    end)
  end

  defp stale_push?(project, client_updated_at) do
    server_ms = datetime_to_ms(project.server_updated_at)

    is_integer(client_updated_at) and is_integer(server_ms) and client_updated_at < server_ms
  end

  defp get_or_create_project(user_id, project_id, snapshot, device_id, client_updated_at) do
    case get_project(user_id, project_id) do
      nil ->
        name = get_in(snapshot, ["project", "name"]) || get_in(snapshot, [:project, :name]) || "Untitled"
        insert_project(user_id, project_id, name, device_id, client_updated_at)

      project ->
        {:ok, project}
    end
  end

  defp insert_project(user_id, project_id, name, device_id, client_updated_at) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    attrs = %{
      id: project_id,
      user_id: user_id,
      name: name,
      schema_version: 1,
      last_writer_device_id: device_id,
      client_updated_at: client_updated_at,
      server_updated_at: now
    }

    %CloudProject{}
    |> CloudProject.create_changeset(attrs)
    |> Repo.insert()
  end

  defp insert_snapshot_row(project_id, snapshot) do
    case insert_snapshot_row!(project_id, snapshot) do
      row -> {:ok, row}
    end
  rescue
    e -> {:error, e}
  end

  defp insert_snapshot_row!(project_id, snapshot) do
    json = normalize_snapshot(snapshot)

    %CloudProjectSnapshot{}
    |> CloudProjectSnapshot.changeset(%{
      cloud_project_id: project_id,
      snapshot_json: json,
      snapshot_version: 1
    })
    |> Repo.insert!()
  end

  defp validate_snapshot(snapshot) do
    json = normalize_snapshot(snapshot)

    cond do
      get_in(json, ["schema_version"]) != 1 and get_in(json, [:schema_version]) != 1 ->
        {:error, :invalid_schema_version}

      is_nil(get_in(json, ["project", "id"])) and is_nil(get_in(json, [:project, :id])) ->
        {:error, :missing_project_id}

      true ->
        {:ok, json}
    end
  end

  defp normalize_snapshot(snapshot) when is_map(snapshot) do
    snapshot
    |> Enum.map(fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), normalize_snapshot(v)}
      {k, v} -> {k, normalize_snapshot(v)}
    end)
    |> Map.new()
  end

  defp normalize_snapshot(other), do: other

  defp datetime_to_ms(nil), do: nil

  defp datetime_to_ms(%DateTime{} = dt) do
    DateTime.to_unix(dt, :millisecond)
  end

  defp encode_sync_token(%DateTime{} = dt) do
    dt |> DateTime.to_unix(:millisecond) |> Integer.to_string()
  end

  defp parse_sync_token(token) when is_binary(token) do
    case Integer.parse(token) do
      {ms, ""} -> {:ok, DateTime.from_unix!(ms, :millisecond)}
      _ -> :error
    end
  end

  defp parse_sync_token(_), do: :error
end
