# Check latest external post submissions
alias ClippsterServer.Repo
alias ClippsterServer.Social.ExternalPostSubmission
import Ecto.Query

posts = Repo.all(from e in ExternalPostSubmission, order_by: [desc: e.inserted_at], limit: 3)

for post <- posts do
  IO.puts("=== Post ID: #{post.id} ===")
  IO.puts("  Platform: #{post.platform}")
  IO.puts("  Post URL: #{post.post_url}")
  IO.puts("  Creator Profile ID: #{inspect(post.organization_creator_profile_id)}")
  IO.puts("  View Count: #{inspect(post.view_count)}")
  IO.puts("  Author Username: #{inspect(post.author_username)}")
  IO.puts("  Author Name: #{inspect(post.author_name)}")
  IO.puts("  Author Profile Image: #{inspect(post.author_profile_image)}")
  IO.puts("  Inserted At: #{post.inserted_at}")
  IO.puts("")
end
