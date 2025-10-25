defmodule ClippsterServer.Auth.ChallengeStore do
  use GenServer

  @challenge_ttl :timer.minutes(5)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def init(_) do
    :ets.new(:auth_challenges, [:set, :public, :named_table])
    schedule_cleanup()
    {:ok, %{}}
  end

  def create_challenge(client_id) do
    nonce = :crypto.strong_rand_bytes(32) |> Base.encode64()
    timestamp = DateTime.utc_now() |> DateTime.to_unix(:millisecond)

    challenge = %{
      nonce: nonce,
      timestamp: timestamp,
      client_id: client_id,
      domain: Application.get_env(:clippster_server, :domain, "localhost"),
      expires_at: timestamp + @challenge_ttl
    }

    :ets.insert(:auth_challenges, {nonce, challenge})
    challenge
  end

  def get_challenge(nonce) do
    case :ets.lookup(:auth_challenges, nonce) do
      [{^nonce, challenge}] ->
        if DateTime.utc_now() |> DateTime.to_unix(:millisecond) < challenge.expires_at do
          {:ok, challenge}
        else
          :ets.delete(:auth_challenges, nonce)
          {:error, :expired}
        end

      [] ->
        {:error, :not_found}
    end
  end

  def consume_challenge(nonce) do
    case get_challenge(nonce) do
      {:ok, challenge} ->
        :ets.delete(:auth_challenges, nonce)
        {:ok, challenge}

      error ->
        error
    end
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, :timer.minutes(1))
  end

  def handle_info(:cleanup, state) do
    now = DateTime.utc_now() |> DateTime.to_unix(:millisecond)

    :ets.select_delete(:auth_challenges, [
      {
        {:_, %{expires_at: :"$1"}},
        [:<, :"$1", now],
        [true]
      }
    ])

    schedule_cleanup()
    {:noreply, state}
  end
end
