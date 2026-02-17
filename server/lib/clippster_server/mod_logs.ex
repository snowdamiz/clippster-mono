defmodule ClippsterServer.ModLogs do
  @moduledoc """
  The ModLogs context for tracking moderator actions.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.ModLogs.ModActionLog

  @doc """
  Logs a moderator action.
  """
  def log_action(moderator_id, action_type, target_type, target_id, details \\ %{}) do
    %ModActionLog{}
    |> ModActionLog.changeset(%{
      moderator_id: moderator_id,
      action_type: action_type,
      target_type: target_type,
      target_id: target_id,
      details: details
    })
    |> Repo.insert()
  end

  @doc """
  Lists all moderator action logs with pagination.
  """
  def list_all_logs(opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    per_page = Keyword.get(opts, :per_page, 50)
    offset = (page - 1) * per_page

    ModActionLog
    |> order_by([l], desc: l.inserted_at)
    |> limit(^per_page)
    |> offset(^offset)
    |> preload(:moderator)
    |> Repo.all()
  end

  @doc """
  Lists logs for a specific moderator.
  """
  def list_logs_for_moderator(moderator_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    per_page = Keyword.get(opts, :per_page, 50)
    offset = (page - 1) * per_page

    ModActionLog
    |> where([l], l.moderator_id == ^moderator_id)
    |> order_by([l], desc: l.inserted_at)
    |> limit(^per_page)
    |> offset(^offset)
    |> preload(:moderator)
    |> Repo.all()
  end

  @doc """
  Lists logs for a specific target.
  """
  def list_logs_for_target(target_type, target_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    per_page = Keyword.get(opts, :per_page, 50)
    offset = (page - 1) * per_page

    ModActionLog
    |> where([l], l.target_type == ^target_type and l.target_id == ^target_id)
    |> order_by([l], desc: l.inserted_at)
    |> limit(^per_page)
    |> offset(^offset)
    |> preload(:moderator)
    |> Repo.all()
  end

  @doc """
  Gets the total count of logs.
  """
  def count_all_logs do
    Repo.aggregate(ModActionLog, :count)
  end

  @doc """
  Gets the count of logs for a specific moderator.
  """
  def count_logs_for_moderator(moderator_id) do
    ModActionLog
    |> where([l], l.moderator_id == ^moderator_id)
    |> Repo.aggregate(:count)
  end
end
