defmodule ClippsterServer.Auth.ChallengeStore do
  use GenServer
  import Ecto.Query

  alias ClippsterServer.Auth.AuthChallenge
  alias ClippsterServer.Repo

  @challenge_ttl_seconds 300

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def init(_) do
    schedule_cleanup()
    {:ok, %{}}
  end

  def create_challenge(client_id) do
    nonce = :crypto.strong_rand_bytes(32) |> Base.encode64()
    now = DateTime.utc_now()
    timestamp = DateTime.to_unix(now, :millisecond)

    expires_at =
      DateTime.add(now, @challenge_ttl_seconds, :second) |> DateTime.truncate(:microsecond)

    attrs = %{
      nonce: nonce,
      client_id: client_id,
      domain: Application.get_env(:clippster_server, :domain, "localhost"),
      expires_at: expires_at,
      timestamp: timestamp
    }

    case Repo.insert(AuthChallenge.changeset(%AuthChallenge{}, attrs)) do
      {:ok, challenge} ->
        to_map(challenge)

      {:error, _changeset} ->
        create_challenge(client_id)
    end
  end

  def get_challenge(nonce) do
    now = DateTime.utc_now()

    case Repo.get(AuthChallenge, nonce) do
      nil ->
        {:error, :not_found}

      challenge ->
        if DateTime.compare(challenge.expires_at, now) == :gt do
          {:ok, to_map(challenge)}
        else
          Repo.delete(challenge)
          {:error, :expired}
        end
    end
  end

  def consume_challenge(nonce) do
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      query = from c in AuthChallenge, where: c.nonce == ^nonce, lock: "FOR UPDATE"

      case Repo.one(query) do
        nil ->
          Repo.rollback(:not_found)

        challenge ->
          if DateTime.compare(challenge.expires_at, now) == :gt do
            Repo.delete!(challenge)
            to_map(challenge)
          else
            Repo.delete!(challenge)
            Repo.rollback(:expired)
          end
      end
    end)
  end

  defp to_map(challenge) do
    %{
      nonce: challenge.nonce,
      timestamp: challenge.timestamp,
      client_id: challenge.client_id,
      domain: challenge.domain,
      expires_at: DateTime.to_unix(challenge.expires_at, :millisecond)
    }
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, :timer.minutes(1))
  end

  def handle_info(:cleanup, state) do
    now = DateTime.utc_now()
    Repo.delete_all(from c in AuthChallenge, where: c.expires_at < ^now)
    schedule_cleanup()
    {:noreply, state}
  end
end
