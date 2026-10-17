defmodule ClippsterServer.UserCreatorProfileSettingsTest do
  use ClippsterServer.DataCase, async: true
  import ClippsterServer.AccountsFixtures
  alias ClippsterServer.UserBranding

  test "creator branding and clip settings survive cloud create and edit" do
    user = google_user_fixture()
    defaults = %{"targetAspectRatio" => "9:16", "referenceImageAssetId" => 7, "referenceImageSource" => "upload"}
    watermark = %{"9:16" => %{"x" => 35, "y" => 70, "scale" => 0.2}}
    ratios = Jason.encode!(%{"9:16" => %{"assetId" => "8"}})
    attrs = %{"name" => "Creator", "scope" => "streamer", "auto_dvr_enabled" => true,
      "watermark_settings" => watermark, "intro_ratio_settings" => ratios,
      "clip_build_defaults" => defaults, "layout_overlays" => [%{"assetId" => 9, "x" => 50, "y" => 50}],
      "platform_links" => [%{"platform" => "twitch", "platform_id" => "creator", "display_name" => "Creator", "is_primary" => true}]}
    assert {:ok, profile} = UserBranding.create_user_creator_profile(user.id, attrs)
    assert profile.auto_dvr_enabled
    assert profile.clip_build_defaults == defaults
    assert profile.watermark_settings == watermark
    assert profile.intro_ratio_settings == ratios
    assert [%{"assetId" => 9}] = Enum.map(profile.layout_overlays, &Map.take(&1, ["assetId"]))
    assert {:ok, updated} = UserBranding.update_user_creator_profile(profile, %{"auto_dvr_enabled" => false, "name" => "Edited creator"})
    refute updated.auto_dvr_enabled
    assert updated.clip_build_defaults == defaults
    assert updated.watermark_settings == watermark
    assert is_nil(UserBranding.get_user_creator_profile(google_user_fixture().id, updated.id))
  end
end
