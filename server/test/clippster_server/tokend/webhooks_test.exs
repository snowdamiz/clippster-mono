defmodule ClippsterServer.Tokend.WebhooksTest do
  use ClippsterServer.DataCase, async: false

  alias ClippsterServer.Tokend.{Client, Webhooks}

  @env_names ~w(
    TOKEND_API_BASE_URL
    TOKEND_WEB_BASE_URL
    TOKEND_OAUTH_CLIENT_ID
    TOKEND_OAUTH_CLIENT_SECRET
    TOKEND_OAUTH_REDIRECT_URI
    TOKEND_PARTNER_API_ENABLED
    TOKEND_WEBHOOK_SIGNING_SECRET
  )

  setup do
    previous_config = Application.get_env(:clippster_server, :tokend)
    previous_env = Map.new(@env_names, &{&1, System.get_env(&1)})

    Enum.each(@env_names, &System.delete_env/1)

    on_exit(fn ->
      if previous_config do
        Application.put_env(:clippster_server, :tokend, previous_config)
      else
        Application.delete_env(:clippster_server, :tokend)
      end

      Enum.each(previous_env, fn
        {name, nil} -> System.delete_env(name)
        {name, value} -> System.put_env(name, value)
      end)
    end)

    Application.put_env(:clippster_server, :tokend,
      webhook_signing_secret: "whsec_test_secret"
    )

    :ok
  end

  test "rejects missing signature headers" do
    conn =
      Plug.Test.conn(:post, "/api/tokend/webhook", "{}")
      |> Plug.Conn.assign(:raw_body, "{}")

    assert {:error, :missing_signature_headers} = Webhooks.verify_and_parse(conn)
  end

  test "rejects invalid signatures and accepts valid stream.ended events once" do
    payload = %{
      "id" => "evt_1",
      "type" => "stream.ended",
      "created_at" => "2026-08-26T00:00:00Z",
      "data" => %{"stream_id" => "stream_1", "creator_slug" => "seed-nova"}
    }

    raw = Jason.encode!(payload)
    timestamp = Integer.to_string(System.system_time(:second))

    signature =
      :crypto.mac(:hmac, :sha256, "whsec_test_secret", "#{timestamp}.#{raw}")
      |> Base.encode16(case: :lower)

    bad_conn =
      Plug.Test.conn(:post, "/api/tokend/webhook", raw)
      |> Plug.Conn.put_req_header("x-tokend-timestamp", timestamp)
      |> Plug.Conn.put_req_header("x-tokend-signature", "deadbeef")
      |> Plug.Conn.put_req_header("x-tokend-delivery-id", "del_1")
      |> Plug.Conn.assign(:raw_body, raw)

    assert {:error, :invalid_signature} = Webhooks.verify_and_parse(bad_conn)

    good_conn =
      Plug.Test.conn(:post, "/api/tokend/webhook", raw)
      |> Plug.Conn.put_req_header("x-tokend-timestamp", timestamp)
      |> Plug.Conn.put_req_header("x-tokend-signature", signature)
      |> Plug.Conn.put_req_header("x-tokend-delivery-id", "del_1")
      |> Plug.Conn.assign(:raw_body, raw)

    assert {:ok, event} = Webhooks.verify_and_parse(good_conn)
    assert event.event_type == "stream.ended"
    assert {:ok, :processed} = Webhooks.ingest(event)
    assert {:ok, :duplicate} = Webhooks.ingest(event)
  end

  test "capabilities report webhook readiness from signing secret" do
    assert Client.capabilities().webhooks
    assert Client.capabilities().publish == false
  end
end
