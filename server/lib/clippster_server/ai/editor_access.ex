defmodule ClippsterServer.AI.EditorAccess do
  @moduledoc """
  Who may use the AI editors: everyone when the feature flag is on, otherwise admins and
  Creator/Pro users with AI editor access enabled.
  """

  alias ClippsterServer.AppSettings

  def can_access_video_editor?(nil), do: false
  def can_access_video_editor?(user), do: AppSettings.is_ai_video_enabled?() || individual_access?(user)

  def can_access_image_editor?(nil), do: false
  def can_access_image_editor?(user), do: AppSettings.is_image_editor_enabled?() || individual_access?(user)

  defp individual_access?(user) do
    user.is_admin || (user.ai_editor_enabled && user.subscription_tier in ["creator", "pro"])
  end
end
