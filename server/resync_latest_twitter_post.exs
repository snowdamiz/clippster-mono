# Re-sync latest Twitter post with analytics
alias ClippsterServer.Repo
alias ClippsterServer.Social.ExternalPostSubmission
alias ClippsterServer.Social.Platforms.Twitter
import Ecto.Query

# Get the latest Twitter post that has nil author_username
post =
  Repo.one(
    from e in ExternalPostSubmission,
      where: e.platform == "twitter" and is_nil(e.author_username),
      order_by: [desc: e.inserted_at],
      limit: 1
  )

if post do
  IO.puts("Found post ID #{post.id}: #{post.post_url}")

  case Twitter.extract_tweet_id(post.post_url) do
    {:ok, tweet_id} ->
      IO.puts("Extracted tweet ID: #{tweet_id}")

      case Twitter.get_tweet_analytics(tweet_id) do
        {:ok, analytics} ->
          IO.puts("Fetched analytics:")
          IO.puts("  View Count: #{analytics.view_count}")
          IO.puts("  Like Count: #{analytics.like_count}")
          IO.puts("  Comment Count: #{analytics.comment_count}")
          IO.puts("  Author Username: #{analytics.author_username}")
          IO.puts("  Author Name: #{analytics.author_name}")
          IO.puts("  Author Profile Image: #{analytics.author_profile_image}")

          # Update the post
          changeset =
            ExternalPostSubmission.update_analytics_changeset(post, %{
              view_count: analytics.view_count,
              like_count: analytics.like_count,
              comment_count: analytics.comment_count,
              author_username: analytics.author_username,
              author_name: analytics.author_name,
              author_profile_image: analytics.author_profile_image
            })

          case Repo.update(changeset) do
            {:ok, updated} ->
              IO.puts("\nPost updated successfully!")
              IO.puts("  New view count: #{updated.view_count}")
              IO.puts("  New author: @#{updated.author_username}")

            {:error, changeset} ->
              IO.puts("Failed to update: #{inspect(changeset.errors)}")
          end

        {:error, reason} ->
          IO.puts("Failed to fetch analytics: #{inspect(reason)}")
      end

    {:error, reason} ->
      IO.puts("Failed to extract tweet ID: #{inspect(reason)}")
  end
else
  IO.puts("No Twitter posts found with missing author metadata")
end
