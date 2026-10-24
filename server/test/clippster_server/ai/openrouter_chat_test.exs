defmodule ClippsterServer.AI.OpenRouterChatTest do
  use ExUnit.Case, async: false

  alias ClippsterServer.AI.OpenRouterChat

  @tls_error {:error, %HTTPoison.Error{reason: {:tls_alert, {:bad_record_mac, ~c"Bad Record MAC"}}}}
  @ok_body Jason.encode!(%{"choices" => [%{"message" => %{"content" => "hi"}, "finish_reason" => "stop"}], "usage" => %{}})

  setup do
    previous = Application.get_env(:clippster_server, :openrouter_http_client)
    previous_key = System.get_env("OPENROUTER_API_KEY")
    System.put_env("OPENROUTER_API_KEY", "test-key")
    test_pid = self()

    Application.put_env(:clippster_server, :openrouter_http_client, fn _url, _body, _headers, opts ->
      send(test_pid, {:openrouter_hackney, opts[:hackney]})
      [response | rest] = Process.get(:openrouter_responses)
      Process.put(:openrouter_responses, rest)
      response
    end)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:clippster_server, :openrouter_http_client, previous),
        else: Application.delete_env(:clippster_server, :openrouter_http_client)

      if previous_key, do: System.put_env("OPENROUTER_API_KEY", previous_key), else: System.delete_env("OPENROUTER_API_KEY")
    end)
  end

  test "retries a dropped connection on a new connection" do
    Process.put(:openrouter_responses, [@tls_error, @tls_error, {:ok, %{status_code: 200, body: @ok_body}}])

    assert {:ok, %{message: %{"content" => "hi"}}} = OpenRouterChat.complete(%{}, backoff_ms: 0)
    assert_received {:openrouter_hackney, []}
    assert_received {:openrouter_hackney, [pool: false]}
    assert_received {:openrouter_hackney, [pool: false]}
  end

  test "gives a readable error once every attempt drops" do
    Process.put(:openrouter_responses, List.duplicate(@tls_error, 5))

    assert {:error, "The connection to the AI service dropped. Please try again."} = OpenRouterChat.complete(%{}, backoff_ms: 0)
  end
end
