defmodule ClippsterServer.AI.VideoLabelerTest do
  use ClippsterServer.DataCase, async: false

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.AI.{VideoLabeler, VideoRuns, VideoSessions}

  setup do
    previous = Application.get_env(:clippster_server, :openrouter_http_client)
    previous_key = System.get_env("OPENROUTER_API_KEY")
    System.put_env("OPENROUTER_API_KEY", "test-key")
    test_pid = self()

    Application.put_env(:clippster_server, :openrouter_http_client, fn _url, body, _headers, _opts ->
      send(test_pid, {:openrouter_request, Jason.decode!(body)})
      {:ok, %{status_code: 200, body: Jason.encode!(Process.get(:openrouter_response))}}
    end)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:clippster_server, :openrouter_http_client, previous),
        else: Application.delete_env(:clippster_server, :openrouter_http_client)

      if previous_key, do: System.put_env("OPENROUTER_API_KEY", previous_key), else: System.delete_env("OPENROUTER_API_KEY")
    end)

    user = email_user_fixture() |> with_credits!(100)

    {:ok, session} =
      VideoSessions.create_session(user.id, %{
        media_items: [%{"id" => "m1", "kind" => "video"}],
        reference_blueprint: %{"duration" => 10.0, "shots" => []}
      })

    {:ok, run} = VideoRuns.start_agent_run(user.id, session, "generate", "Match it")
    %{run: run}
  end

  defp reply(json) do
    Process.put(:openrouter_response, %{
      "choices" => [%{"message" => %{"role" => "assistant", "content" => Jason.encode!(json)}, "finish_reason" => "stop"}],
      "usage" => %{"prompt_tokens" => 1000, "completion_tokens" => 100, "total_tokens" => 1100, "cost" => 0.001}
    })
  end

  test "labels source segments with chunk-relative ranges and keeps absolute times", %{run: run} do
    reply(%{"segments" => [%{"index" => 7, "description" => "Car at dusk", "quality" => "good"}, %{"index" => 99, "description" => "stray"}]})

    segments = [
      %{"index" => 7, "start" => 24.0, "end" => 28.0, "motion" => 0.4},
      %{"index" => 8, "start" => 28.0, "end" => 31.5, "motion" => 0.1}
    ]

    assert {:ok, labelled} = VideoLabeler.label_source(run, "video", Base.encode64("mp4"), segments, 24.0)

    assert_received {:openrouter_request, payload}
    [_video, %{"text" => ranges}] = payload["messages"] |> List.last() |> Map.get("content")

    assert Jason.decode!(ranges) == %{
             "segments" => [%{"index" => 7, "start" => 0.0, "end" => 4.0}, %{"index" => 8, "start" => 4.0, "end" => 7.5}]
           }

    assert [
             %{"index" => 7, "start" => 24.0, "end" => 28.0, "motion" => 0.4, "description" => "Car at dusk", "quality" => "good"},
             %{"index" => 8, "start" => 28.0, "end" => 31.5, "motion" => 0.1}
           ] = labelled

    refute Map.has_key?(Enum.at(labelled, 1), "description")
  end

  test "rejects a missing media payload", %{run: run} do
    assert {:error, _} = VideoLabeler.label_source(run, "video", "", [%{"index" => 0, "start" => 0, "end" => 1}], 0)
  end
end
