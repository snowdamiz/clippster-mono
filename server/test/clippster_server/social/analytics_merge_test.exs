defmodule ClippsterServer.Social.AnalyticsMergeTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.Social.AnalyticsMerge

  test "has_real_metrics? is false when all metrics are zero" do
    refute AnalyticsMerge.has_real_metrics?(%{view_count: 0, like_count: 0})
  end

  test "has_real_metrics? is true when any metric is positive" do
    assert AnalyticsMerge.has_real_metrics?(%{view_count: 0, like_count: 3})
  end

  test "merge_metrics preserves existing view counts when incoming views are zero" do
    existing = %{view_count: 12_500, like_count: 40, comment_count: 2}

    merged =
      AnalyticsMerge.merge_metrics(existing, %{
        view_count: 0,
        like_count: 45,
        comment_count: 0
      })

    assert merged.view_count == 12_500
    assert merged.like_count == 45
    assert merged.comment_count == 2
  end

  test "merge_metrics accepts new non-zero metrics" do
    existing = %{view_count: 100, like_count: 0}

    merged = AnalyticsMerge.merge_metrics(existing, %{view_count: 250, like_count: 10})

    assert merged.view_count == 250
    assert merged.like_count == 10
  end
end
