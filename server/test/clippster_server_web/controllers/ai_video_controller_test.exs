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
    session = conn |> post(~p"/api/ai/video/sessions", %{media_items: @media, name: "Launch"}) |> json_response(200)
    assert session["status"] == "draft"
    assert session["name"] == "Launch"
    assert session["media_items"] == @media

    bad = conn |> patch(~p"/api/ai/video/sessions/#{session["id"]}", %{composition_files: %{"../index.html" => "x"}})
    assert json_response(bad, 422)["error"] =~ "compositions/"

    square = conn |> patch(~p"/api/ai/video/sessions/#{session["id"]}", %{aspect_ratio: "1:1"}) |> json_response(200)
    assert square["aspect_ratio"] == "1:1"
    assert conn |> patch(~p"/api/ai/video/sessions/#{session["id"]}", %{aspect_ratio: "3:2"}) |> json_response(422)
  end

  test "replacing or removing the example forgets what was learned from it", %{conn: conn} do
    %{"id" => id} =
      conn |> post(~p"/api/ai/video/sessions", %{reference: %{"path" => "a.mp4", "duration" => 12.5}}) |> json_response(200)

    {:ok, _} =
      ClippsterServer.AI.VideoSessions.get_session!(id)
      |> ClippsterServer.AI.VideoSessions.update_session(%{reference_blueprint: %{"shots" => []}, reference_labels: %{"0" => []}})

    same = conn |> patch(~p"/api/ai/video/sessions/#{id}", %{reference: %{"path" => "a.mp4", "duration" => 12.5}, name: "Kept"})
    assert json_response(same, 200)["reference_blueprint"] == %{"shots" => []}

    removed = conn |> patch(~p"/api/ai/video/sessions/#{id}", %{reference: nil}) |> json_response(200)
    assert removed["reference"] == nil
    assert removed["reference_blueprint"] == nil
    assert ClippsterServer.AI.VideoSessions.get_session!(id).reference_labels == %{}
  end

  test "generate from a description alone; an example still has to be analyzed", %{conn: conn} do
    %{"id" => id} = conn |> post(~p"/api/ai/video/sessions", %{}) |> json_response(200)

    blank = conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "  "})
    assert json_response(blank, 422)["error"] =~ "Describe"

    conn |> patch(~p"/api/ai/video/sessions/#{id}", %{reference: %{"path" => "a.mp4"}}) |> json_response(200)
    unanalyzed = conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "A launch video"})
    assert json_response(unanalyzed, 422)["error"] =~ "analyzed"

    conn |> patch(~p"/api/ai/video/sessions/#{id}", %{reference: nil}) |> json_response(200)

    %{"run" => run} =
      conn |> post(~p"/api/ai/video/sessions/#{id}/runs", %{kind: "generate", request: "A launch video"}) |> json_response(200)

    assert run["kind"] == "generate"
  end

  test "a finished run saves the edit and revisions refund when nothing changed", %{conn: conn, user: user} do
    %{"id" => id} = conn |> post(~p"/api/ai/video/sessions", %{media_items: @media}) |> json_response(200)

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
    assert [%{"role" => "user", "content" => "Go"}, %{"role" => "assistant", "content" => "Stopped. You weren't charged."}] = session["messages"]

    conn |> post(~p"/api/ai/video/runs/#{run["id"]}/fail", %{reason: "Cancelled"}) |> json_response(200)
    assert length((conn |> get(~p"/api/ai/video/sessions/#{id}") |> json_response(200))["messages"]) == 2
  end
end
