defmodule ClippsterServer.Social.PostForMeFeedAnalytics do
  @moduledoc """
  Extracts post analytics from Post For Me social account feed items.
  """

  alias ClippsterServer.Social.Providers.PostForMe

  @feed_opts %{limit: 50, expand: ["metrics"]}

  def fetch_post_insights(provider_account_id, platform, post_id)
      when is_binary(provider_account_id) and is_binary(post_id) do
    with {:ok, %{data: feed_items}} when is_list(feed_items) <-
           PostForMe.get_social_account_feed(provider_account_id, @feed_opts),
         {:ok, item} <- find_post_in_feed(feed_items, post_id) do
      {:ok, extract_analytics(platform, item)}
    else
      {:ok, _} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def fetch_post_insights(_, _, _), do: {:error, :missing_identifiers}

  def find_post_in_feed(feed_items, post_id) when is_list(feed_items) do
    post_id_str = to_string(post_id)

    case Enum.find(feed_items, fn item ->
           item_id = item["id"] || item["platform_post_id"] || get_in(item, ["platform_data", "id"])
           to_string(item_id) == post_id_str
         end) do
      nil -> {:error, :not_found}
      item -> {:ok, item}
    end
  end

  def extract_analytics(platform, item) when platform in ["x", "twitter"] do
    m = item["metrics"] || %{}
    pm = m["public_metrics"] || %{}

    %{
      view_count: pm["impression_count"] || 0,
      like_count: pm["like_count"] || 0,
      comment_count: pm["reply_count"] || 0,
      share_count: pm["retweet_count"] || 0,
      impressions_count: pm["impression_count"] || 0
    }
  end

  def extract_analytics("instagram", item) do
    m = item["metrics"] || %{}
    i = m["insights"] || m

    %{
      view_count: i["plays"] || i["video_views"] || i["views"] || i["impressions"] || 0,
      like_count: i["likes"] || 0,
      comment_count: i["comments"] || 0,
      share_count: i["shares"] || 0,
      save_count: i["saves"] || i["saved"] || 0,
      reach_count: i["reach"] || 0,
      impressions_count: i["impressions"] || 0
    }
  end

  def extract_analytics("tiktok", item) do
    m = item["metrics"] || %{}

    %{
      view_count: m["view_count"] || m["video_views"] || 0,
      like_count: m["like_count"] || m["likes"] || 0,
      comment_count: m["comment_count"] || m["comments"] || 0,
      share_count: m["share_count"] || m["shares"] || 0,
      save_count: m["favorites"] || m["save_count"] || 0,
      reach_count: m["reach"] || 0,
      impressions_count: m["impressions"] || m["video_views"] || 0
    }
  end

  def extract_analytics("youtube", item) do
    m = item["metrics"] || %{}

    %{
      view_count: m["views"] || 0,
      like_count: m["likes"] || 0,
      comment_count: m["comments"] || 0,
      impressions_count: m["views"] || 0
    }
  end

  def extract_analytics(_platform, _item), do: %{}
end
