defmodule ClippsterServer.ClipperProfiles.ResponseTimeWorker do
  @moduledoc """
  Background worker for calculating clipper response times.
  Runs daily to calculate rolling average from last 20 conversations.
  """
  use GenServer
  require Logger

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.Messaging

  @check_interval :timer.hours(24)

  def start_link(_opts) do
    case GenServer.start_link(__MODULE__, %{}, name: {:global, __MODULE__}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, _pid}} -> :ignore
      error -> error
    end
  end

  @impl true
  def init(state) do
    # Run initial calculation after 1 minute
    Process.send_after(self(), :calculate_response_times, :timer.minutes(1))
    {:ok, state}
  end

  @impl true
  def handle_info(:calculate_response_times, state) do
    Logger.info("[ResponseTimeWorker] Calculating response times for all clippers...")
    calculate_all_response_times()
    schedule_next_run()
    {:noreply, state}
  end

  defp schedule_next_run do
    Process.send_after(self(), :calculate_response_times, @check_interval)
  end

  @doc """
  Calculate response times for all clipper profiles.
  """
  def calculate_all_response_times do
    profiles = ClipperProfiles.list_all_profiles()

    Enum.each(profiles, fn profile ->
      calculate_response_time_for_profile(profile)
    end)

    Logger.info(
      "[ResponseTimeWorker] Finished calculating response times for #{length(profiles)} profiles"
    )
  end

  @doc """
  Calculate response time for a specific profile.
  Uses the last 20 conversations to calculate rolling average.
  """
  def calculate_response_time_for_profile(profile) do
    # Get last 20 conversations where this user received a message and responded
    response_times = get_response_times(profile.user_id, 20)

    if length(response_times) > 0 do
      # Calculate average in hours
      avg_minutes = Enum.sum(response_times) / length(response_times)
      avg_hours = round(avg_minutes / 60)

      # Update profile
      ClipperProfiles.update_response_time(profile, avg_hours)
    end
  end

  defp get_response_times(user_id, limit) do
    # This queries the messaging system to find response times
    # For each conversation, find time between receiving a message and sending a response
    try do
      Messaging.get_user_response_times(user_id, limit)
    rescue
      _ -> []
    end
  end
end
