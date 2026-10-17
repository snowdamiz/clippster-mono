defmodule ClippsterServerWeb.AIImageRoutesTest do
  use ExUnit.Case, async: true

  alias ClippsterServerWeb.{AIImageController, Router}

  test "exposes prompt preparation before general image generation" do
    routes = Router.__routes__()

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/prepare-prompt",
             AIImageController,
             :prepare_prompt
           )

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/generate",
             AIImageController,
             :trigger_generation
           )

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/prepare-revision",
             AIImageController,
             :prepare_revision
           )

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/revise",
             AIImageController,
             :trigger_revision
           )

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/select-candidate",
             AIImageController,
             :select_candidate
           )
  end

  test "exposes image session CRUD and chat routes" do
    routes = Router.__routes__()

    assert route?(routes, :get, "/api/ai/image/sessions", AIImageController, :list_sessions)
    assert route?(routes, :post, "/api/ai/image/sessions", AIImageController, :create_session)
    assert route?(routes, :get, "/api/ai/image/sessions/:id", AIImageController, :get_session)

    assert route?(
             routes,
             :delete,
             "/api/ai/image/sessions/:id",
             AIImageController,
             :delete_session
           )

    assert route?(
             routes,
             :post,
             "/api/ai/image/sessions/:id/message",
             AIImageController,
             :send_message
           )
  end

  defp route?(routes, verb, path, plug, action) do
    Enum.any?(routes, fn route ->
      route.verb == verb and route.path == path and route.plug == plug and
        route.plug_opts == action
    end)
  end
end
