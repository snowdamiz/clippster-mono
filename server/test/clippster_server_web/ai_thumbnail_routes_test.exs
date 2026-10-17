defmodule ClippsterServerWeb.AIThumbnailRoutesTest do
  use ExUnit.Case, async: true

  alias ClippsterServerWeb.{AIThumbnailController, Router}

  test "exposes thumbnail session CRUD chat generate and refine routes" do
    routes = Router.__routes__()

    assert route?(routes, :get, "/api/ai/thumbnail/sessions", AIThumbnailController, :list_sessions)
    assert route?(routes, :post, "/api/ai/thumbnail/sessions", AIThumbnailController, :create_session)
    assert route?(routes, :get, "/api/ai/thumbnail/sessions/:id", AIThumbnailController, :get_session)

    assert route?(
             routes,
             :post,
             "/api/ai/thumbnail/sessions/:id/message",
             AIThumbnailController,
             :send_message
           )

    assert route?(
             routes,
             :post,
             "/api/ai/thumbnail/sessions/:id/generate",
             AIThumbnailController,
             :trigger_generation
           )

    assert route?(
             routes,
             :post,
             "/api/ai/thumbnail/sessions/:id/refine",
             AIThumbnailController,
             :send_refinement
           )

    assert route?(
             routes,
             :post,
             "/api/ai/thumbnail/sessions/:id/accept",
             AIThumbnailController,
             :accept
           )
  end

  defp route?(routes, verb, path, plug, action) do
    Enum.any?(routes, fn route ->
      route.verb == verb and route.path == path and route.plug == plug and
        route.plug_opts == action
    end)
  end
end
