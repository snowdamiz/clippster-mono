defmodule ClippsterServer.Social.PublishingProviderTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.Social.{PublishingProvider, SchedulingAccountValidator}
  alias ClippsterServer.Tokend.Publisher
  alias ClippsterServerWeb.ClipperProfileController

  test "Tokend capability fails before provider dispatch" do
    account = tokend_account()

    assert {:error, :tokend_publish_unavailable} =
             Publisher.publish(account, "https://media.example/video.mp4")

    refute_receive _
  end

  test "Tokend and unknown providers never fall through to Post For Me" do
    parent = self()
    pfm = fn -> send(parent, :post_for_me_called) end
    native = fn -> :native_called end

    assert :native_called = PublishingProvider.dispatch(tokend_account(), pfm, native)
    refute_receive :post_for_me_called

    assert {:error, :unsupported_provider} =
             PublishingProvider.dispatch(
               %{provider: "other", platform: "tokend"},
               pfm,
               native
             )

    refute_receive :post_for_me_called

    assert {:error, :native_provider_required} =
             PublishingProvider.dispatch(
               %{provider: "post_for_me", platform: "tokend"},
               pfm,
               native
             )

    refute_receive :post_for_me_called
  end

  test "personal scheduling validates ownership, active state, platform, and provider" do
    user = %{id: 7}
    params = %{"user_social_account_id" => 11, "platform" => "instagram"}

    assert {:ok, _} =
             SchedulingAccountValidator.validate(params, user, "user",
               user_account_loader: fn 11 ->
                 %{user_id: 7, is_active: true, platform: "instagram", provider: "post_for_me"}
               end
             )

    for {account, error} <- [
          {%{user_id: 8, is_active: true, platform: "instagram", provider: "post_for_me"},
           :unauthorized},
          {%{user_id: 7, is_active: false, platform: "instagram", provider: "post_for_me"},
           :account_inactive},
          {%{user_id: 7, is_active: true, platform: "youtube", provider: "post_for_me"},
           :platform_mismatch},
          {%{user_id: 7, is_active: true, platform: "instagram", provider: "other"},
           :unsupported_provider}
        ] do
      assert {:error, ^error} =
               SchedulingAccountValidator.validate(params, user, "user",
                 user_account_loader: fn 11 -> account end
               )
    end
  end

  test "Tokend scheduling is rejected before persistence is possible" do
    params = %{"user_social_account_id" => 11, "platform" => "tokend"}

    assert {:error, :tokend_publish_unavailable} =
             SchedulingAccountValidator.validate(params, %{id: 7}, "user",
               user_account_loader: fn 11 ->
                 %{
                   user_id: 7,
                   is_active: true,
                   platform: "tokend",
                   provider: "tokend"
                 }
               end
             )
  end

  test "organization scheduling validates organization ownership and access" do
    user = %{id: 7}
    params = %{"organization_id" => "3", "social_account_id" => 12, "platform" => "youtube"}

    base_opts = [
      org_membership: fn "3", 7 -> true end,
      org_access: fn "3", 12, 7 -> true end
    ]

    assert {:ok, _} =
             SchedulingAccountValidator.validate(
               params,
               user,
               "org",
               Keyword.put(base_opts, :org_account_loader, fn 12 ->
                 %{
                   organization_id: 3,
                   is_active: true,
                   platform: "youtube",
                   provider: "post_for_me"
                 }
               end)
             )

    assert {:error, :unauthorized} =
             SchedulingAccountValidator.validate(
               params,
               user,
               "org",
               Keyword.put(base_opts, :org_account_loader, fn 12 ->
                 %{
                   organization_id: 99,
                   is_active: true,
                   platform: "youtube",
                   provider: "post_for_me"
                 }
               end)
             )
  end

  test "generic personal Post For Me connect endpoints reject Tokend" do
    conn =
      Plug.Test.conn(:post, "/api/user/social/connect-url")
      |> Plug.Conn.assign(:current_user, %{id: 7})
      |> ClipperProfileController.connect_url(%{"platform" => "tokend"})

    assert conn.status == 422
    assert Jason.decode!(conn.resp_body)["error"] == "native_provider_required"

    conn =
      Plug.Test.conn(:post, "/api/user/social/complete-connect")
      |> Plug.Conn.assign(:current_user, %{id: 7})
      |> ClipperProfileController.complete_connect(%{"platform" => "tokend"})

    assert conn.status == 422
    assert Jason.decode!(conn.resp_body)["error"] == "native_provider_required"
  end

  defp tokend_account do
    %{
      provider: "tokend",
      platform: "tokend",
      access_token_encrypted: nil,
      refresh_token_encrypted: nil,
      token_expires_at: nil
    }
  end
end
