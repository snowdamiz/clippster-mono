defmodule ClippsterServer.Kick.ClientTest do
  use ExUnit.Case, async: false
  alias ClippsterServer.Kick.{ArchivePage, Client}

  setup do
    key = System.get_env("RAPID_API_KEY")
    System.put_env("RAPID_API_KEY", "fixture-key")

    on_exit(fn ->
      if key, do: System.put_env("RAPID_API_KEY", key), else: System.delete_env("RAPID_API_KEY")
    end)

    :ok
  end

  defp video(index, live \\ false) do
    %{
      "id" => "01a126e1-06e0-7669-81e8-#{String.pad_leading(to_string(index), 12, "0")}",
      "channel" => %{"slug" => "asmongold"},
      "duration" => if(live, do: 0, else: 26073),
      "is_live" => live,
      "recording_url" => if(live, do: "", else: "https://stream.kick.com/archive.m3u8"),
      "title" => "VOD #{index} with \"quotes\"\nand a new line",
      "start_time" => "2026-10-10T17:34:04Z",
      "thumbnail" => %{"src" => "https://web.kick.com/thumbnail.jpeg"}
    }
  end

  defp archive_html(videos) do
    data = %{"state" => %{"queries" => [%{"state" => %{"data" => %{"data" => videos}}}]}}
    flight = "69:" <> Jason.encode!(data) <> "\n"
    {first, second} = String.split_at(flight, div(String.length(flight), 2))

    Enum.map_join([first, second], fn chunk ->
      "<script>self.__next_f.push([1," <> Jason.encode!(chunk) <> "])</script>"
    end)
  end

  test "decodes the complete catalogue across Flight chunks, preserving current IDs and escaped titles" do
    videos = [video(0, true) | Enum.map(1..28, &video/1)]
    assert {:ok, ^videos} = ArchivePage.videos(archive_html(videos), "asmongold")

    assert {:error, :archive_catalogue_missing} =
             ArchivePage.videos(archive_html(videos), "another-streamer")
  end

  test "provider failure falls back to all completed archives, never to a single live stream" do
    videos = [video(0, true) | Enum.map(1..28, &video/1)]

    Req.Test.stub(__MODULE__, fn conn ->
      case conn.host do
        "kick-com-api.p.rapidapi.com" ->
          Plug.Conn.send_resp(conn, 503, "provider unavailable")

        "kick.com" ->
          assert conn.request_path == "/asmongold/videos"
          Plug.Conn.send_resp(conn, 200, archive_html(videos))
      end
    end)

    opts = [limit: 20, request_options: [plug: {Req.Test, __MODULE__}, retry: false]]

    assert {:ok, %{clips: first, total: 28, has_more: true}} =
             Client.list_videos("asmongold", opts)

    assert length(first) == 20

    assert Enum.all?(
             first,
             &(&1.duration == 26073 and not &1.isLive and is_binary(&1.thumbnailUrl))
           )

    assert hd(first).pageUrl == "https://kick.com/asmongold/videos/#{video(1)["id"]}"

    assert {:ok, %{clips: second, total: 28, has_more: false}} =
             Client.list_videos("asmongold", Keyword.put(opts, :offset, 20))

    assert length(second) == 8
    assert MapSet.disjoint?(MapSet.new(first, & &1.clipId), MapSet.new(second, & &1.clipId))
  end

  test "primary provider also filters live records before pagination" do
    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{"data" => [video(0, true) | Enum.map(1..28, &video/1)]})
    end)

    assert {:ok, %{clips: clips, total: 28, has_more: true}} =
             Client.list_videos("asmongold",
               limit: 20,
               request_options: [plug: {Req.Test, __MODULE__}]
             )

    assert length(clips) == 20
    refute Enum.any?(clips, & &1.isLive)
  end

  test "a blocked archive page fails visibly instead of returning fake completed VODs" do
    Req.Test.stub(__MODULE__, fn conn -> Plug.Conn.send_resp(conn, 403, "blocked") end)

    assert {:error, {:kick_api_failed, _}} =
             Client.list_videos("asmongold",
               request_options: [plug: {Req.Test, __MODULE__}, retry: false]
             )
  end
end
