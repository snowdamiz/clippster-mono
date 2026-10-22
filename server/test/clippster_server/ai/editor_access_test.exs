defmodule ClippsterServerWeb.AIChatAccessTest do
  use ExUnit.Case, async: true

  alias ClippsterServerWeb.AIChatController

  test "allows admins or explicitly enabled Creator and Pro users only" do
    assert AIChatController.can_access_ai_editor?(%{
             is_admin: true,
             ai_editor_enabled: false,
             subscription_tier: "basic"
           })

    assert AIChatController.can_access_ai_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "creator"
           })

    assert AIChatController.can_access_ai_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "pro"
           })

    refute AIChatController.can_access_ai_editor?(%{
             is_admin: false,
             ai_editor_enabled: true,
             subscription_tier: "starter"
           })

    refute AIChatController.can_access_ai_editor?(%{
             is_admin: false,
             ai_editor_enabled: false,
             subscription_tier: "pro"
           })
  end
end
