defmodule ClippsterServer.MediaResolverTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.MediaResolver

  describe "detect_platform/2" do
    test "detects youtube URLs" do
      assert {:ok, "youtube"} =
               MediaResolver.detect_platform("https://www.youtube.com/watch?v=abc123")
    end

    test "detects kick URLs" do
      assert {:ok, "kick"} = MediaResolver.detect_platform("https://kick.com/somechannel/videos")
    end

    test "detects twitch URLs" do
      assert {:ok, "twitch"} = MediaResolver.detect_platform("https://www.twitch.tv/ninja/videos")
    end

    test "detects rumble URLs" do
      assert {:ok, "rumble"} = MediaResolver.detect_platform("https://rumble.com/c/channel")
    end

    test "detects twitter/x URLs" do
      assert {:ok, "twitter"} =
               MediaResolver.detect_platform("https://x.com/user/status/123")
    end

    test "returns error for unsupported URLs" do
      assert {:error, :unsupported_platform} =
               MediaResolver.detect_platform("https://example.com/video")
    end

    test "honors explicit platform override" do
      assert {:ok, "youtube"} =
               MediaResolver.detect_platform("https://example.com/foo", "youtube")
    end
  end

  describe "sanitize_ytdlp_error/1" do
    test "strips ERROR prefix" do
      assert MediaResolver.sanitize_ytdlp_error("ERROR: Video unavailable") ==
               "Video unavailable"
    end
  end

  describe "Kick.Client.extract_channel_slug/1" do
    alias ClippsterServer.Kick.Client

    test "extracts slug from channel URL" do
      assert {:ok, "asmongold"} = Client.extract_channel_slug("https://kick.com/asmongold")
    end

    test "extracts slug from bare handle" do
      assert {:ok, "asmongold"} = Client.extract_channel_slug("asmongold")
    end
  end
end
