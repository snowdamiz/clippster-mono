defmodule ClippsterServerWeb.OAuthCallbackTargetTest do
  use ExUnit.Case, async: true

  alias ClippsterServerWeb.OAuthCallbackTarget

  describe "normalize_mobile_oauth_callback_base/1" do
    test "accepts Android emulator host alias in dev" do
      assert {:ok, "http://10.0.2.2:4000"} =
               OAuthCallbackTarget.normalize_mobile_oauth_callback_base("http://10.0.2.2:4000")
    end

    test "accepts localhost in dev" do
      assert {:ok, "http://localhost:4000"} =
               OAuthCallbackTarget.normalize_mobile_oauth_callback_base("http://localhost:4000")
    end

    test "accepts private LAN IPs in dev" do
      assert {:ok, "http://192.168.1.10:4000"} =
               OAuthCallbackTarget.normalize_mobile_oauth_callback_base("http://192.168.1.10:4000")
    end

    test "rejects non-http schemes" do
      assert {:error, :invalid_scheme} =
               OAuthCallbackTarget.normalize_mobile_oauth_callback_base("clippster://auth/google/callback")
    end
  end

  describe "append_query/2" do
    test "appends params to clippster deep link" do
      result =
        OAuthCallbackTarget.append_query("clippster://auth/google/callback", %{
          "token" => "abc",
          "is_new_user" => "false"
        })

      assert String.starts_with?(result, "clippster://auth/google/callback?")
      assert String.contains?(result, "token=abc")
      assert String.contains?(result, "is_new_user=false")
    end
  end

  describe "normalize_mobile_redirect_uri/1" do
    test "accepts clippster google callback" do
      assert {:ok, "clippster://auth/google/callback"} =
               OAuthCallbackTarget.normalize_mobile_redirect_uri("clippster://auth/google/callback")
    end
  end
end
