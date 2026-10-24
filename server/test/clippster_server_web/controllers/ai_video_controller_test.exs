defmodule ClippsterServerWeb.AIVideoControllerTest do
  use ClippsterServerWeb.ConnCase, async: true

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.{Credits, Repo}

  defp auth_conn(conn, user) do
    {:ok, token} =
      TokenGenerator.generate_token(%{
        "sub" => "#{user.provider}:#{user.provider_id}",
        "user_id" => user.id,
        "provider" => user.provider,
        "provider_id" => user.provider_id,
        "email" => user.email,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(1, :day) |> DateTime.to_unix()
      })

    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp balance(user) do
    {:ok, %{hours_remaining: remaining}} = Credits.get_user_balance(user.id)
    Decimal.to_float(remaining)
  end

  @media [%{"id" => "m1", "name" => "drive.mp4", "kind" => "video", "duration" => 30.0, "contentHash" => "h1"}]
  @document %{"format" => %{"width" => 1920, "height" => 1080, "fps" => 30}, "shots" => [], "overlays" => []}
  @files %{"compositions/title.html" => "<html></html>"}

  setup %{conn: conn} do
    user =
      email_user_fixture()
      |> Ecto.Changeset.change(is_admin: true)
      |> Repo.update!()
      |> with_credits!(50)

    %{conn: auth_conn(conn, user), user: user}
  end

  test "rejects users without AI video access" do
    user = email_user_fixture()
    conn = build_conn() |> auth_conn(user) |> get(~p"/api/ai/video/sessions")
    assert json_response(conn, 403)["error"] =~ "AI Video"
  end

  test "creates a project and validates its fields", %{conn: conn} do
    session = conn |> post(~p"/api/ai/video/sessions", %{media_items: @media, request: "Match it"}) |> json_response(200)
    assert session["status"] == "draft"
    assert session["media_items"] == @media

    bad = conn |> patch(~p"/api/ai/video/sessions/#{session["id"]}", %{composition_files: %{"../index.html" => "x"}})
    assert json_response(bad, 422)["error"] =~ "compositions/"
  end

  test "generate needs an example; a finished run saves the edit", %{conn: conn, user: user} do
    %{"id" => id} = conn |> post(~p"/api/ai/video/sessions", %{media_items: @media}) |> json_response(200)

    no_example = conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "Go"})
    assert json_response(no_example, 422)["error"] =~ "example"

    {:ok, _} =
      ClippsterServer.AI.VideoSessions.get_session!(id)
      |> ClippsterServer.AI.VideoSessions.update_session(%{reference_blueprint: %{"shots" => []}})

    %{"run" => run} =
      conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "Go"}) |> json_response(200)

    assert balance(user) == 40.0

    busy = conn |> patch(~p"/api/ai/video/sessions/#{id}", %{document: @document})
    assert json_response(busy, 409)

    %{"session" => session, "run" => done} =
      conn
      |> post(~p"/api/ai/video/runs/#{run["id"]}/complete", %{document: @document, composition_files: @files})
      |> json_response(200)

    assert done["status"] == "completed"
    assert session["status"] == "ready"
    assert session["document"] == @document
    assert [%{"role" => "user", "content" => "Go"}, %{"role" => "assistant"}] = session["messages"]

    %{"run" => revise} =
      conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "revise", request: "No change"}) |> json_response(200)

    assert balance(user) == 35.0

    %{"run" => revised} =
      conn
      |> post(~p"/api/ai/video/runs/#{revise["id"]}/complete", %{document: @document, composition_files: @files})
      |> json_response(200)

    assert revised["refunded"]
    assert balance(user) == 40.0
  end

  test "failing a run refunds it and resets the project", %{conn: conn, user: user} do
    %{"id" => id} = conn |> post(~p"/api/ai/video/sessions", %{media_items: @media}) |> json_response(200)

    {:ok, _} =
      ClippsterServer.AI.VideoSessions.get_session!(id)
      |> ClippsterServer.AI.VideoSessions.update_session(%{reference_blueprint: %{"shots" => []}})

    %{"run" => run} =
      conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "Go"}) |> json_response(200)

    failed = conn |> post(~p"/api/ai/video/runs/#{run["id"]}/fail", %{reason: "Cancelled"}) |> json_response(200)
    assert failed["run"]["refunded"]
    assert balance(user) == 50.0

    session = conn |> get(~p"/api/ai/video/sessions/#{id}") |> json_response(200)
    assert session["status"] == "draft"
    assert session["running_run"] == nil
  end
end
