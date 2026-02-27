defmodule ClippsterServer.Social.PostForMe.Analytics do
  @moduledoc """
  Post for Me analytics and feed retrieval.

  Provides access to social account feeds with metrics
  and individual post result data.
  """

  require Logger

  alias ClippsterServer.Social.PostForMe.Client

  @doc """
  Gets the feed for a social account, optionally with metrics.

  ## Parameters
    - pfm_account_id: Post for Me social account ID
    - opts: Keyword list with:
      - :expand - "metrics" to include engagement metrics
      - :cursor - Pagination cursor

  ## Returns
    - {:ok, %{"data" => [posts_with_metrics], ...}}
    - {:error, reason}
  """
  def get_account_feed(pfm_account_id, opts \\ []) do
    params = opts
    |> Enum.filter(fn {_k, v} -> not is_nil(v) end)
    |> URI.encode_query()

    path = "/v1/social-account-feeds/#{pfm_account_id}"
    path = if params == "", do: path, else: "#{path}?#{params}"
    Client.get(path)
  end

  @doc """
  Gets the feed for a social account with full metrics included.
  Convenience wrapper around get_account_feed/2.
  """
  def get_account_feed_with_metrics(pfm_account_id, opts \\ []) do
    get_account_feed(pfm_account_id, Keyword.put(opts, :expand, "metrics"))
  end

  @doc """
  Gets all post results (publish outcomes) with optional filtering.

  ## Options
    - :social_post_id - Filter by post
    - :cursor - Pagination cursor
  """
  def list_post_results(opts \\ []) do
    params = opts
    |> Enum.filter(fn {_k, v} -> not is_nil(v) end)
    |> URI.encode_query()

    path = if params == "", do: "/v1/social-post-results", else: "/v1/social-post-results?#{params}"
    Client.get(path)
  end

  @doc """
  Gets a single post result by ID.
  """
  def get_post_result(result_id) do
    Client.get("/v1/social-post-results/#{result_id}")
  end
end
