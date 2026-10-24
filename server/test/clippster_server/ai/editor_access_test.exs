defmodule ClippsterServer.AI.EditorAccessTest do
  use ClippsterServer.DataCase, async: true

  alias ClippsterServer.AI.EditorAccess

  test "allows admins or explicitly enabled Creator and Pro users only" do
    assert EditorAccess.can_access_video_editor?(%{
             is_admin: true,
             ai_editor_enabled: false,
             subscription_tier: "basic"
           })

    assert EditorAccess.can_access_video_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "creator"
           })

    assert EditorAccess.can_access_video_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "pro"
           })

    refute EditorAccess.can_access_video_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "starter"
           })

    refute EditorAccess.can_access_video_editor?(%{
             is_admin: false,
             ai_editor_enabled: false,
             subscription_tier: "pro"
           })
  end
end
