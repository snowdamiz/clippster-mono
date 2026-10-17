defmodule ClippsterServer.AI.ImageGenerationPolicyTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.{ImageGenerationPolicy, ThumbnailComposer}

  test "true creation uses gpt-image-2.5-sunburst and costs four credits" do
    assert ImageGenerationPolicy.resolve(:create, false) == %{
             model: "openai/gpt-image-2.5-sunburst",
             credit_cost: 4,
             operation: :create
           }
  end

  test "explicit editing uses gpt-image-2.5-sunburst and costs two credits" do
    assert ImageGenerationPolicy.resolve(:edit, false) == %{
             model: "openai/gpt-image-2.5-sunburst",
             credit_cost: 2,
             operation: :edit
           }
  end

  test "a base image always forces the edit model even when creation was requested" do
    assert ImageGenerationPolicy.resolve(:create, true) == %{
             model: "openai/gpt-image-2.5-sunburst",
             credit_cost: 2,
             operation: :edit
           }
  end

  test "transcript-backed thumbnails preserve their existing generation price" do
    assert ImageGenerationPolicy.thumbnail_credit_cost(true, false) == 8
    assert ImageGenerationPolicy.thumbnail_credit_cost(true, true) == 8
  end

  test "transcript-less thumbnails cost four credits to create and two to edit" do
    assert ImageGenerationPolicy.thumbnail_credit_cost(false, false) == 4
    assert ImageGenerationPolicy.thumbnail_credit_cost(false, true) == 2
  end

  test "thumbnail context references remain creation unless an explicit base image is present" do
    context_url = "https://example.com/video-keyframe.png"
    base_url = "data:image/png;base64,uploaded"

    assert ThumbnailComposer.generation_policy([context_url],
             operation: :create,
             base_image_urls: []
           ).model == "openai/gpt-image-2.5-sunburst"

    assert ThumbnailComposer.generation_policy([base_url, context_url],
             operation: :create,
             base_image_urls: [base_url]
           ).model == "openai/gpt-image-2.5-sunburst"
  end
end
