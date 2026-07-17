defmodule ClippsterServer.Social.PostForMeFeedAnalytics do
  @moduledoc """
  Extracts post analytics from Post For Me social account feed items.
  """

  require Logger

  alias ClippsterServer.Social.Providers.PostForMe

  @feed_opts %{limit: 50, expand: ["metrics"]}

  def fetch_post_insights(provider_account_id, platform, post_id)
      when is_binary(provider_account_id) and is_binary(post_id) do
    with {:ok, feed_items} <- fetch_feed(provider_account_id),
         {:ok, item} <- find_post_in_feed(feed_items, post_id) do
      {:ok, extract_analytics(platform, item)}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  def fetch_post_insights(_, _, _), do: {:error, :missing_identifiers}

  @doc """
  Fetches a social account feed with expanded metrics.
  """
  def fetch_feed(provider_account_id) when is_binary(provider_account_id) do
    case PostForMe.get_social_account_feed(provider_account_id, @feed_opts) do
      {:ok, %{data: feed_items}} when is_list(feed_items) ->
        {:ok, feed_items}

      {:ok, %{"data" => feed_items}} when is_list(feed_items) ->
        {:ok, feed_items}

      {:ok, feed_items} when is_list(feed_items) ->
        {:ok, feed_items}

      {:ok, _other} ->
        {:error, :unexpected_response}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Looks up publish metadata from Post For Me social-post-results.
  Returns `{:ok, metadata}` or `{:error, reason}`.
  """
  def resolve_publish_metadata(provider_account_id, social_post_id)
      when is_binary(provider_account_id) and is_binary(social_post_id) do
    case PostForMe.list_social_post_results(%{"social_post_id" => social_post_id}) do
      {:ok, %{data: results}} when is_list(results) ->
        matching =
          Enum.filter(results, fn result ->
            result.post_id == social_post_id and result.social_account_id == provider_account_id
          end)

        case matching do
          [] ->
            {:error, :not_found}

          results ->
            failures = Enum.filter(results, &(&1.success == false))

            if failures != [] do
              error =
                failures
                |> Enum.map(fn r -> r.error || "Publish failed" end)
                |> Enum.uniq()
                |> Enum.join("; ")

              {:error, {:publish_failed, error}}
            else
              result = List.first(results)
              {:ok, metadata_from_result(result)}
            end
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def resolve_publish_metadata(_, _), do: {:error, :missing_identifiers}

  def find_post_in_feed(feed_items, post_id) when is_list(feed_items) do
    post_id_str = to_string(post_id)

    case Enum.find(feed_items, fn item -> feed_item_matches_id?(item, post_id_str) end) do
      nil -> {:error, :not_found}
      item -> {:ok, item}
    end
  end

  @doc """
  Matches a user post struct/map against a Post For Me feed.
  Tries platform_post_id, Post For Me post id resolution, then URL identifier.
  """
  def match_post_in_feed(platform, feed_items, post) when is_list(feed_items) do
    post = normalize_post(post)

    match_by_social_post_id(feed_items, post.post_id) ||
      match_by_platform_post_id(feed_items, post.provider_post_id) ||
      match_by_url(platform, feed_items, post.post_url)
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

  def extract_analytics("facebook", item) do
    m = item["metrics"] || %{}

    %{
      view_count: m["video_views"] || m["media_views"] || 0,
      like_count: m["reactions_total"] || m["reactions_like"] || 0,
      comment_count: m["comments"] || 0,
      share_count: m["shares"] || 0,
      reach_count: m["reach"] || 0
    }
  end

  def extract_analytics(_platform, _item), do: %{}

  defp normalize_post(%_{} = post), do: Map.from_struct(post)
  defp normalize_post(post) when is_map(post), do: post

  defp metadata_from_result(%{platform_data: platform_data} = result) when is_map(platform_data) do
    %{
      provider_post_id:
        to_string(platform_data["platform_post_id"] || platform_data["id"] || "") |> nil_if_empty(),
      post_url: platform_data["platform_url"] || platform_data["url"],
      success: result.success
    }
  end

  defp metadata_from_result(_result), do: %{provider_post_id: nil, post_url: nil, success: true}

  defp match_by_social_post_id(_feed_items, nil), do: nil
  defp match_by_social_post_id(_feed_items, ""), do: nil

  defp match_by_social_post_id(feed_items, social_post_id) do
    id = to_string(social_post_id)

    Enum.find(feed_items, fn item ->
      to_string(item["social_post_id"] || "") == id
    end)
  end

  defp match_by_platform_post_id(_feed_items, nil), do: nil
  defp match_by_platform_post_id(_feed_items, ""), do: nil

  defp match_by_platform_post_id(feed_items, platform_post_id) do
    id = to_string(platform_post_id)

    Enum.find(feed_items, fn item ->
      to_string(item["platform_post_id"] || "") == id ||
        feed_item_matches_id?(item, id)
    end)
  end

  defp match_by_url(_platform, _feed_items, nil), do: nil
  defp match_by_url(_platform, _feed_items, ""), do: nil

  defp match_by_url(platform, feed_items, post_url) do
    case extract_post_identifier(platform, strip_url_query(post_url)) do
      {:ok, post_identifier} ->
        match_feed_item_by_identifier(platform, feed_items, post_identifier)

      {:error, _} ->
        nil
    end
  end

  defp feed_item_matches_id?(item, post_id_str) do
    item_id =
      item["social_post_id"] || item["platform_post_id"] || item["id"] || item["video_id"] ||
        get_in(item, ["platform_data", "id"])

    not is_nil(item_id) && to_string(item_id) == post_id_str
  end

  defp match_feed_item_by_identifier("instagram", feed_items, shortcode) do
    Enum.find(feed_items, fn item ->
      item_shortcode =
        item["shortcode"] || item["code"] ||
          extract_shortcode_from_url(item["permalink"]) ||
          extract_shortcode_from_url(item["platform_url"])

      item_shortcode == shortcode
    end)
  end

  defp match_feed_item_by_identifier(platform, feed_items, post_id)
       when platform in ["x", "twitter"] do
    Enum.find(feed_items, fn item ->
      item_id =
        item["platform_post_id"] || item["id"] || item["id_str"] ||
          extract_id_from_url(item["url"] || item["platform_url"])

      to_string(item_id) == to_string(post_id)
    end)
  end

  defp match_feed_item_by_identifier("tiktok", feed_items, video_id) do
    Enum.find(feed_items, fn item ->
      item_id =
        item["platform_post_id"] || item["id"] || item["video_id"] ||
          extract_id_from_url(item["share_url"] || item["url"] || item["platform_url"])

      to_string(item_id) == to_string(video_id)
    end)
  end

  defp match_feed_item_by_identifier("youtube", feed_items, video_id) do
    Enum.find(feed_items, fn item ->
      item_id =
        item["platform_post_id"] || item["id"] || item["video_id"] ||
          extract_youtube_id_from_url(item["url"] || item["platform_url"])

      to_string(item_id) == to_string(video_id)
    end)
  end

  defp match_feed_item_by_identifier(_platform, _feed_items, _id), do: nil

  defp extract_post_identifier("instagram", url) when is_binary(url) do
    case Regex.run(~r{instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, shortcode] -> {:ok, shortcode}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(platform, url)
       when platform in ["x", "twitter"] and is_binary(url) do
    case Regex.run(~r{(?:twitter\.com|x\.com)/.+/status/(\d+)}, url) do
      [_, tweet_id] -> {:ok, tweet_id}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier("tiktok", url) when is_binary(url) do
    case Regex.run(~r{tiktok\.com/.+/video/(\d+)}, url) do
      [_, video_id] -> {:ok, video_id}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier("youtube", url) when is_binary(url) do
    cond do
      match = Regex.run(~r{youtube\.com/shorts/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      match = Regex.run(~r{youtube\.com/watch\?v=([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      match = Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      true ->
        {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(_platform, _url), do: {:error, :unsupported_platform}

  defp extract_shortcode_from_url(nil), do: nil

  defp extract_shortcode_from_url(url) when is_binary(url) do
    case Regex.run(~r{/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, shortcode] -> shortcode
      _ -> nil
    end
  end

  defp extract_id_from_url(nil), do: nil

  defp extract_id_from_url(url) when is_binary(url) do
    case Regex.run(~r{/(\d+)(?:\?|$)}, url) do
      [_, id] -> id
      _ -> nil
    end
  end

  defp extract_youtube_id_from_url(nil), do: nil

  defp extract_youtube_id_from_url(url) when is_binary(url) do
    cond do
      match = Regex.run(~r{youtube\.com/shorts/([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      match = Regex.run(~r{youtube\.com/watch\?v=([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      match = Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      true -> nil
    end
  end

  defp strip_url_query(url) when is_binary(url) do
    url |> String.split("?", parts: 2) |> List.first()
  end

  defp nil_if_empty(""), do: nil
  defp nil_if_empty(value), do: value
end
