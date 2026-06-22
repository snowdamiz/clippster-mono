defmodule ClippsterServer.AnalyticsTest do
  use ClippsterServer.DataCase, async: true

  alias ClippsterServer.Analytics

  describe "get_landing_dashboard_stats/0" do
    test "aggregates landing visits and download clicks" do
      {:ok, _} =
        Analytics.track_event("landing_page_view", nil, %{
          "visitor_id" => "visitor-1",
          "session_id" => "session-1",
          "path" => "/",
          "referrer_host" => "Direct",
          "device_type" => "Desktop",
          "browser" => "Chrome"
        })

      {:ok, _} =
        Analytics.track_event("landing_page_view", nil, %{
          "visitor_id" => "visitor-1",
          "session_id" => "session-1",
          "path" => "/pricing",
          "referrer_host" => "Direct",
          "device_type" => "Desktop",
          "browser" => "Chrome"
        })

      {:ok, _} =
        Analytics.track_event("landing_download_click", nil, %{
          "visitor_id" => "visitor-1",
          "download_platform" => "mac-arm64",
          "source" => "hero_primary"
        })

      stats = Analytics.get_landing_dashboard_stats()

      assert stats.overview.page_views.total == 2
      assert stats.overview.unique_visitors.total == 1
      assert stats.overview.sessions.total == 1
      assert stats.overview.download_clicks.total == 1
      assert stats.overview.conversion_rate == 100.0

      assert [%{label: "mac-arm64", total: 1}] = stats.downloads_by_platform
      assert [%{label: "hero_primary", total: 1}] = stats.downloads_by_source
      assert Enum.any?(stats.visits_by_page, &(&1.label == "/"))
      assert Enum.any?(stats.visits_by_page, &(&1.label == "/pricing"))
    end
  end
end
