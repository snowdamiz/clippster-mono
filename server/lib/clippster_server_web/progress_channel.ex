defmodule ClippsterServerWeb.ProgressChannel do
  use ClippsterServerWeb, :channel

  @impl true
  def join("progress:" <> project_id, _payload, socket) do
    IO.puts("[ProgressChannel] 🎉 Client joining progress channel for project: #{project_id}")
    socket = assign(socket, :project_id, project_id)
    {:ok, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: true}}, socket}
  end

  # Broadcast progress updates to all subscribers of a project
  def broadcast_progress(project_id, stage, progress, message \\ nil) do
    payload = %{
      stage: stage,
      progress: progress,
      message: message,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    IO.puts("[ProgressChannel] Broadcasting progress for project #{project_id}: #{stage} - #{progress}% - #{message || "No message"}")

    case ClippsterServerWeb.Endpoint.broadcast("progress:#{project_id}", "progress_update", payload) do
      :ok ->
        IO.puts("[ProgressChannel] ✅ Successfully broadcasted progress update")
        :ok
      {:error, reason} ->
        IO.puts("[ProgressChannel] ❌ Failed to broadcast progress: #{inspect(reason)}")
        {:error, reason}
    end
  end
end