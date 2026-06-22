defmodule ClippsterServer.Campaigns.CampaignResourceTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.Campaigns.CampaignResource

  describe "detect_source_platform/1" do
    test "detects supported platforms" do
      assert CampaignResource.detect_source_platform("https://www.youtube.com/watch?v=abc") ==
               "youtube"

      assert CampaignResource.detect_source_platform("https://kick.com/streamer") == "kick"
      assert CampaignResource.detect_source_platform("https://www.twitch.tv/streamer") == "twitch"
      assert CampaignResource.detect_source_platform("https://rumble.com/v/abc") == "rumble"
      assert CampaignResource.detect_source_platform("https://x.com/user/status/1") == "x"
    end
  end

  describe "build_download_target/1" do
    test "builds audio download route" do
      resource = %CampaignResource{
        resource_type: "audio",
        url: "https://www.youtube.com/watch?v=abc123"
      }

      assert CampaignResource.build_download_target(resource) ==
               "/download-audio?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc123"
    end

    test "builds video download route" do
      resource = %CampaignResource{
        resource_type: "video",
        url: "https://kick.com/streamer/videos/123",
        source_platform: "kick"
      }

      assert CampaignResource.build_download_target(resource) ==
               "/vods?platform=kick&search=https%3A%2F%2Fkick.com%2Fstreamer%2Fvideos%2F123"
    end
  end
end

defmodule ClippsterServer.Campaigns.CampaignSubmissionAnalyticsTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.Campaigns.CampaignSubmission
  alias ClippsterServer.Campaigns.CampaignSubmissionAnalytics
  alias ClippsterServer.Campaigns.CampaignSubmissionMetricSnapshot

  test "computes warnings from snapshot history" do
    submission = %CampaignSubmission{
      id: 1,
      clip_url: "https://tiktok.com/@user/video/1",
      campaign_id: 10,
      metrics_last_synced_at: DateTime.utc_now() |> DateTime.add(-60, :hour)
    }

    latest = %CampaignSubmissionMetricSnapshot{
      feed_match_status: "not_found",
      view_count: 50_000,
      like_count: 1,
      comment_count: 0,
      share_count: 0,
      save_count: 0
    }

    previous = %CampaignSubmissionMetricSnapshot{
      feed_match_status: "matched",
      view_count: 5_000,
      like_count: 100,
      comment_count: 10,
      share_count: 5,
      save_count: 2
    }

    warnings =
      CampaignSubmissionAnalytics.compute_warnings(submission, [latest, previous],
        duplicate_url?: true,
        manual_override?: false
      )

    assert "post_not_in_feed" in warnings
    assert "duplicate_url" in warnings
    assert "stale_metrics" in warnings
    assert "view_spike" in warnings
    assert "low_engagement" in warnings
  end

  test "builds trend summary from snapshots" do
    newest = %CampaignSubmissionMetricSnapshot{
      inserted_at: ~U[2026-06-10 12:00:00Z],
      view_count: 2000,
      like_count: 120,
      comment_count: 10,
      share_count: 5,
      save_count: 2
    }

    oldest = %CampaignSubmissionMetricSnapshot{
      inserted_at: ~U[2026-06-09 12:00:00Z],
      view_count: 1000,
      like_count: 50,
      comment_count: 4,
      share_count: 1,
      save_count: 0
    }

    trends = CampaignSubmissionAnalytics.build_trends([newest, oldest])

    assert trends.snapshots_count == 2
    assert trends.view_delta == 1000
    assert trends.like_delta == 70
    assert trends.engagement_rate == 0.0685
  end
end
