defmodule ClippsterServer.Social.PostForMeConnectionSessions do
  @moduledoc """
  Context for lifecycle management of Post For Me connection sessions.
  """

  import Ecto.Query, warn: false

  alias ClippsterServer.Repo
  alias ClippsterServer.Social.PostForMeConnectionSession

  @default_ttl_seconds 900

  def create_session(attrs) when is_map(attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    attrs =
      attrs
      |> Map.put_new(:status, "pending")
      |> Map.put_new(:external_id, generate_external_id())
      |> Map.put_new(:expires_at, DateTime.add(now, ttl_seconds(), :second))
      |> Map.put_new(:account_ids, [])

    %PostForMeConnectionSession{}
    |> PostForMeConnectionSession.create_changeset(attrs)
    |> Repo.insert()
  end

  def get_session(id) when is_binary(id), do: Repo.get(PostForMeConnectionSession, id)
  def get_session(_), do: nil

  def get_session_by_external_id(external_id) when is_binary(external_id) do
    Repo.get_by(PostForMeConnectionSession, external_id: external_id)
  end

  def get_session_by_external_id(_), do: nil

  def mark_callback_received(%PostForMeConnectionSession{} = session, attrs \\ %{})
      when is_map(attrs) do
    update_session(session, %{
      status: "callback_received",
      success: Map.get(attrs, :success, Map.get(attrs, "success")),
      account_ids:
        normalize_account_ids(Map.get(attrs, :account_ids, Map.get(attrs, "account_ids"))),
      callback_payload: Map.get(attrs, :callback_payload, Map.get(attrs, "callback_payload")),
      error_message: Map.get(attrs, :error_message, Map.get(attrs, "error_message"))
    })
  end

  def mark_synced(%PostForMeConnectionSession{} = session, attrs \\ %{}) when is_map(attrs) do
    update_session(session, %{
      status: "synced",
      success: true,
      account_ids:
        normalize_account_ids(Map.get(attrs, :account_ids, Map.get(attrs, "account_ids"))),
      callback_payload: Map.get(attrs, :callback_payload, Map.get(attrs, "callback_payload")),
      error_message: nil
    })
  end

  def mark_failed(%PostForMeConnectionSession{} = session, error_message, attrs \\ %{})
      when is_map(attrs) do
    update_session(session, %{
      status: "failed",
      success: false,
      account_ids:
        normalize_account_ids(Map.get(attrs, :account_ids, Map.get(attrs, "account_ids"))),
      callback_payload: Map.get(attrs, :callback_payload, Map.get(attrs, "callback_payload")),
      error_message: normalize_error(error_message)
    })
  end

  def mark_expired(%PostForMeConnectionSession{} = session) do
    update_session(session, %{
      status: "expired",
      success: false,
      error_message: "Connection session expired"
    })
  end

  def expired?(%PostForMeConnectionSession{expires_at: nil}), do: false

  def expired?(%PostForMeConnectionSession{expires_at: expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now()) in [:lt, :eq]
  end

  def expire_stale_sessions do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      from(s in PostForMeConnectionSession,
        where: s.status in ["pending", "callback_received"],
        where: s.expires_at <= ^now
      )
      |> Repo.update_all(
        set: [
          status: "expired",
          success: false,
          error_message: "Connection session expired",
          updated_at: now
        ]
      )

    {:ok, count}
  end

  def callback_url do
    config = Application.get_env(:clippster_server, :post_for_me, [])

    config
    |> Keyword.get(:callback_url)
    |> case do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  def ttl_seconds do
    config = Application.get_env(:clippster_server, :post_for_me, [])

    case Keyword.get(config, :connect_session_ttl_seconds, @default_ttl_seconds) do
      value when is_integer(value) and value > 0 -> value
      _ -> @default_ttl_seconds
    end
  end

  def project_id do
    config = Application.get_env(:clippster_server, :post_for_me, [])

    case Keyword.get(config, :project_id) do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp update_session(session, attrs) do
    attrs =
      attrs
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    session
    |> PostForMeConnectionSession.update_changeset(attrs)
    |> Repo.update()
  end

  defp normalize_account_ids(nil), do: nil

  defp normalize_account_ids(account_ids) when is_list(account_ids) do
    account_ids
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp normalize_account_ids(account_id) when is_binary(account_id), do: [String.trim(account_id)]
  defp normalize_account_ids(_), do: nil

  defp normalize_error(nil), do: "Post For Me connection failed"
  defp normalize_error(error) when is_binary(error), do: error
  defp normalize_error(error), do: inspect(error)

  defp generate_external_id do
    token = :crypto.strong_rand_bytes(12) |> Base.url_encode64(padding: false)
    "pfmcs_" <> token
  end
end
