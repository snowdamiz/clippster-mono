defmodule ClippsterServerWeb.AnalyticsControllerTest do
  use ClippsterServerWeb.ConnCase, async: true

  alias ClippsterServer.Analytics.AnalyticsEvent
  alias ClippsterServer.Repo

  describe "POST /api/analytics/public/track" do
    test "tracks allowlisted landing events without authentication", %{conn: conn} do
      conn =
        conn
        |> put_req_header(
          "user-agent",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36"
        )
        |> post("/api/analytics/public/track", %{
          "event_type" => "landing_download_click",
          "metadata" => %{
            "visitor_id" => "visitor-1",
            "session_id" => "session-1",
            "download_platform" => "mac-arm64",
            "source" => "hero_primary",
            "ignored" => "nope"
          }
        })

      assert %{"success" => true} = json_response(conn, 200)

      event = Repo.one!(AnalyticsEvent)
      assert event.event_type == "landing_download_click"
      assert event.user_id == nil
      assert event.metadata["visitor_id"] == "visitor-1"
      assert event.metadata["download_platform"] == "mac-arm64"
      assert event.metadata["source"] == "hero_primary"
      assert event.metadata["browser"] == "Chrome"
      assert event.metadata["device_type"] == "Desktop"
      assert is_binary(event.metadata["ip_hash"])
      refute Map.has_key?(event.metadata, "ignored")
    end

    test "rejects unsupported public events", %{conn: conn} do
      conn =
        post(conn, "/api/analytics/public/track", %{
          "event_type" => "credits_purchased",
          "metadata" => %{"visitor_id" => "visitor-1"}
        })

      assert %{"success" => false} = json_response(conn, 400)
      assert Repo.aggregate(AnalyticsEvent, :count) == 0
    end
  end
end
