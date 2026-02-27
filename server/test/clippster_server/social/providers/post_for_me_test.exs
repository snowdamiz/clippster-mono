defmodule ClippsterServer.Social.Providers.PostForMeTest do
  use ExUnit.Case, async: false

  alias ClippsterServer.Social.Providers.PostForMe

  setup do
    previous_config = Application.get_env(:clippster_server, :post_for_me)
    previous_http_client = Application.get_env(:clippster_server, :post_for_me_http_client)

    on_exit(fn ->
      if previous_config == nil do
        Application.delete_env(:clippster_server, :post_for_me)
      else
        Application.put_env(:clippster_server, :post_for_me, previous_config)
      end

      if previous_http_client == nil do
        Application.delete_env(:clippster_server, :post_for_me_http_client)
      else
        Application.put_env(:clippster_server, :post_for_me_http_client, previous_http_client)
      end
    end)

    :ok
  end

  test "create_social_account_auth_url normalizes platform and maps response" do
    parent = self()

    Application.put_env(:clippster_server, :post_for_me,
      api_key: "pfm_test_key",
      base_url: "https://api.postforme.dev",
      timeout_ms: 10,
      max_retries: 2
    )

    Application.put_env(:clippster_server, :post_for_me_http_client, fn method,
                                                                        url,
                                                                        body,
                                                                        headers,
                                                                        _opts ->
      send(parent, {:http_request, method, url, body, headers})

      {:ok,
       %HTTPoison.Response{
         status_code: 200,
         body: Jason.encode!(%{"url" => "https://postforme.dev/auth/abc", "platform" => "x"})
       }}
    end)

    assert {:ok, auth_response} =
             PostForMe.create_social_account_auth_url(%{
               "platform" => "twitter",
               "external_id" => "org:1:user:2:platform:x:123"
             })

    assert auth_response.platform == "x"
    assert auth_response.url == "https://postforme.dev/auth/abc"

    assert_receive {:http_request, :post, url, body, headers}
    assert String.ends_with?(url, "/v1/social-accounts/auth-url")

    decoded_body = Jason.decode!(body)
    assert decoded_body["platform"] == "x"
    assert decoded_body["permissions"] == ["posts"]
    assert {"Authorization", "Bearer pfm_test_key"} in headers
  end

  test "create_upload_url retries on retryable status and succeeds" do
    {:ok, attempt_counter} = Agent.start_link(fn -> 0 end)

    Application.put_env(:clippster_server, :post_for_me,
      api_key: "pfm_test_key",
      base_url: "https://api.postforme.dev",
      timeout_ms: 10,
      max_retries: 2
    )

    Application.put_env(:clippster_server, :post_for_me_http_client, fn _method,
                                                                        _url,
                                                                        _body,
                                                                        _headers,
                                                                        _opts ->
      attempt =
        Agent.get_and_update(attempt_counter, fn count ->
          {count, count + 1}
        end)

      if attempt == 0 do
        {:ok,
         %HTTPoison.Response{
           status_code: 429,
           headers: [{"retry-after", "0"}],
           body: Jason.encode!(%{"message" => "rate limited"})
         }}
      else
        {:ok,
         %HTTPoison.Response{
           status_code: 200,
           body:
             Jason.encode!(%{
               "upload_url" => "https://upload.postforme.dev/signed",
               "media_url" => "https://cdn.postforme.dev/media/abc.jpg"
             })
         }}
      end
    end)

    assert {:ok, upload_response} = PostForMe.create_upload_url()
    assert upload_response.upload_url == "https://upload.postforme.dev/signed"
    assert upload_response.media_url == "https://cdn.postforme.dev/media/abc.jpg"

    assert Agent.get(attempt_counter, & &1) == 2
  end

  test "returns not_configured error when api key is missing" do
    Application.put_env(:clippster_server, :post_for_me, base_url: "https://api.postforme.dev")

    assert {:error, %PostForMe.ApiError{type: :not_configured}} = PostForMe.create_upload_url()
  end
end
