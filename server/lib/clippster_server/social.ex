defmodule ClippsterServer.Social do
  @moduledoc """
  The Social context - manages social media accounts, assignments, and post submissions.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Social.{
    SocialAccount,
    SocialAccountAssignment,
    PostSubmission
  }

  # ============================================================================
  # Social Account CRUD
  # ============================================================================

  @doc """
  Lists all social accounts for an organization.
  """
  def list_organization_social_accounts(organization_id, opts \\ []) do
    include_inactive = Keyword.get(opts, :include_inactive, false)

    query = from a in SocialAccount,
      where: a.organization_id == ^organization_id,
      order_by: [desc: a.connected_at],
      preload: [assignments: :user]

    query = if include_inactive do
      query
    else
      where(query, [a], a.is_active == true)
    end

    Repo.all(query)
  end

  @doc """
  Gets a single social account by ID.
  """
  def get_social_account(id) do
    SocialAccount
    |> preload([assignments: :user])
    |> Repo.get(id)
  end

  @doc """
  Gets a social account by ID, scoped to an organization.
  """
  def get_social_account(organization_id, account_id) do
    SocialAccount
    |> where([a], a.organization_id == ^organization_id and a.id == ^account_id)
    |> preload([assignments: :user])
    |> Repo.one()
  end

  @doc """
  Gets a social account by platform and platform_user_id within an organization.
  """
  def get_social_account_by_platform(organization_id, platform, platform_user_id) do
    SocialAccount
    |> where([a], a.organization_id == ^organization_id and a.platform == ^platform and a.platform_user_id == ^platform_user_id)
    |> Repo.one()
  end

  @doc """
  Creates a new social account connection.
  Admin only.
  """
  def create_social_account(organization_id, attrs, %User{} = user) do
    if Organizations.is_admin?(organization_id, user.id) do
      %SocialAccount{}
      |> SocialAccount.create_changeset(Map.put(attrs, :organization_id, organization_id))
      |> Repo.insert()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Updates a social account (e.g., refresh tokens, profile info).
  """
  def update_social_account(%SocialAccount{} = account, attrs) do
    account
    |> SocialAccount.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Refreshes the OAuth tokens for a social account.
  """
  def refresh_social_account_tokens(%SocialAccount{} = account, attrs) do
    account
    |> SocialAccount.refresh_tokens_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deactivates a social account (soft delete).
  Admin only.
  """
  def deactivate_social_account(%SocialAccount{} = account, %User{} = user) do
    if Organizations.is_admin?(account.organization_id, user.id) do
      account
      |> SocialAccount.deactivate_changeset()
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a social account (hard delete).
  Admin only.
  """
  def delete_social_account(%SocialAccount{} = account, %User{} = user) do
    if Organizations.is_admin?(account.organization_id, user.id) do
      Repo.delete(account)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Gets all social accounts that need token refresh.
  """
  def get_accounts_needing_refresh do
    refresh_threshold = DateTime.utc_now() |> DateTime.add(1, :day)

    SocialAccount
    |> where([a], a.is_active == true)
    |> where([a], not is_nil(a.token_expires_at))
    |> where([a], a.token_expires_at < ^refresh_threshold)
    |> Repo.all()
  end

  # ============================================================================
  # Social Account Assignments
  # ============================================================================

  @doc """
  Assigns a social account to one or more users.
  Admin only. Users must be members of the organization.
  """
  def assign_social_account(organization_id, account_id, user_ids, %User{} = admin) when is_list(user_ids) do
    with true <- Organizations.is_admin?(organization_id, admin.id),
         account when not is_nil(account) <- get_social_account(organization_id, account_id) do
      
      # Filter to only users who are members
      valid_user_ids = user_ids
      |> Enum.filter(fn uid -> Organizations.is_member?(organization_id, uid) end)

      results = Enum.map(valid_user_ids, fn user_id ->
        %SocialAccountAssignment{}
        |> SocialAccountAssignment.changeset(%{
          organization_social_account_id: account.id,
          user_id: user_id,
          assigned_by_user_id: admin.id
        })
        |> Repo.insert(on_conflict: :nothing)
      end)

      successful = Enum.count(results, fn
        {:ok, _} -> true
        _ -> false
      end)

      {:ok, %{assigned: successful, total: length(user_ids)}}
    else
      false -> {:error, :unauthorized}
      nil -> {:error, :account_not_found}
    end
  end

  @doc """
  Unassigns a social account from a user.
  Admin only.
  """
  def unassign_social_account(organization_id, account_id, user_id, %User{} = admin) do
    with true <- Organizations.is_admin?(organization_id, admin.id),
         account when not is_nil(account) <- get_social_account(organization_id, account_id) do
      
      assignment = Repo.get_by(SocialAccountAssignment,
        organization_social_account_id: account.id,
        user_id: user_id
      )

      case assignment do
        nil -> {:error, :not_assigned}
        a -> Repo.delete(a)
      end
    else
      false -> {:error, :unauthorized}
      nil -> {:error, :account_not_found}
    end
  end

  @doc """
  Lists all assignments for a social account.
  """
  def list_account_assignments(organization_id, account_id) do
    SocialAccountAssignment
    |> join(:inner, [a], s in SocialAccount,
      on: a.organization_social_account_id == s.id)
    |> where([a, s], s.organization_id == ^organization_id and s.id == ^account_id)
    |> preload([:user, :assigned_by_user])
    |> Repo.all()
  end

  @doc """
  Gets all social accounts assigned to a user within an organization.
  """
  def get_user_assigned_accounts(organization_id, user_id) do
    SocialAccount
    |> join(:inner, [s], a in SocialAccountAssignment,
      on: a.organization_social_account_id == s.id)
    |> where([s, a], s.organization_id == ^organization_id and a.user_id == ^user_id)
    |> where([s], s.is_active == true)
    |> Repo.all()
  end

  @doc """
  Checks if a user has access to a social account (assigned or admin).
  """
  def has_account_access?(organization_id, account_id, user_id) do
    # Admins always have access
    if Organizations.is_admin?(organization_id, user_id) do
      true
    else
      # Check if assigned
      SocialAccountAssignment
      |> join(:inner, [a], s in SocialAccount,
        on: a.organization_social_account_id == s.id)
      |> where([a, s], s.organization_id == ^organization_id and s.id == ^account_id and a.user_id == ^user_id)
      |> Repo.exists?()
    end
  end

  # ============================================================================
  # Post Submissions
  # ============================================================================

  @doc """
  Lists all post submissions for an organization.
  Supports filtering and pagination.
  """
  def list_post_submissions(organization_id, opts \\ []) do
    creator_profile_id = Keyword.get(opts, :creator_profile_id)
    account_id = Keyword.get(opts, :account_id)
    platform = Keyword.get(opts, :platform)
    status = Keyword.get(opts, :status)
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    query = from p in PostSubmission,
      where: p.organization_id == ^organization_id,
      order_by: [desc: p.posted_at, desc: p.inserted_at],
      limit: ^limit,
      offset: ^offset,
      preload: [:organization_social_account, :organization_creator_profile, :submitted_by_user]

    query = if creator_profile_id, do: where(query, [p], p.organization_creator_profile_id == ^creator_profile_id), else: query
    query = if account_id, do: where(query, [p], p.organization_social_account_id == ^account_id), else: query
    query = if platform, do: where(query, [p], p.platform == ^platform), else: query
    query = if status, do: where(query, [p], p.status == ^status), else: query

    posts = Repo.all(query)

    # Get total count
    count_query = from p in PostSubmission,
      where: p.organization_id == ^organization_id,
      select: count(p.id)

    count_query = if creator_profile_id, do: where(count_query, [p], p.organization_creator_profile_id == ^creator_profile_id), else: count_query
    count_query = if account_id, do: where(count_query, [p], p.organization_social_account_id == ^account_id), else: count_query
    count_query = if platform, do: where(count_query, [p], p.platform == ^platform), else: count_query
    count_query = if status, do: where(count_query, [p], p.status == ^status), else: count_query

    total = Repo.one(count_query)

    {:ok, %{posts: posts, total: total}}
  end

  @doc """
  Gets a single post submission by ID.
  """
  def get_post_submission(id) do
    PostSubmission
    |> preload([:organization_social_account, :organization_creator_profile, :submitted_by_user])
    |> Repo.get(id)
  end

  @doc """
  Gets a post submission by ID, scoped to an organization.
  """
  def get_post_submission(organization_id, post_id) do
    PostSubmission
    |> where([p], p.organization_id == ^organization_id and p.id == ^post_id)
    |> preload([:organization_social_account, :organization_creator_profile, :submitted_by_user])
    |> Repo.one()
  end

  @doc """
  Creates a new post submission (before publishing).
  """
  def create_post_submission(organization_id, attrs, %User{} = user) do
    # Verify user is a member
    if Organizations.is_member?(organization_id, user.id) do
      %PostSubmission{}
      |> PostSubmission.create_changeset(
        attrs
        |> Map.put(:organization_id, organization_id)
        |> Map.put(:submitted_by_user_id, user.id)
      )
      |> Repo.insert()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Marks a post as published with the platform post details.
  """
  def mark_post_published(%PostSubmission{} = submission, attrs) do
    submission
    |> PostSubmission.publish_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Marks a post as failed with an error message.
  """
  def mark_post_failed(%PostSubmission{} = submission, error_message) do
    submission
    |> PostSubmission.failed_changeset(error_message)
    |> Repo.update()
  end

  @doc """
  Updates post analytics from API sync (respects manual_override).
  """
  def sync_post_analytics(%PostSubmission{} = submission, analytics) do
    submission
    |> PostSubmission.sync_analytics_changeset(analytics)
    |> Repo.update()
  end

  @doc """
  Manually updates post analytics (sets manual_override).
  Admin only.
  """
  def update_post_analytics_manual(%PostSubmission{} = submission, analytics, %User{} = user) do
    if Organizations.is_admin?(submission.organization_id, user.id) do
      submission
      |> PostSubmission.manual_analytics_changeset(Map.put(analytics, :manual_override, true))
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Resets the manual override flag on a post.
  Admin only.
  """
  def reset_analytics_override(%PostSubmission{} = submission, %User{} = user) do
    if Organizations.is_admin?(submission.organization_id, user.id) do
      submission
      |> PostSubmission.reset_override_changeset()
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Gets all posts that need analytics sync (not manually overridden, published).
  """
  def get_posts_needing_sync(opts \\ []) do
    limit = Keyword.get(opts, :limit, 100)
    min_age_hours = Keyword.get(opts, :min_age_hours, 1)
    
    sync_threshold = DateTime.utc_now() |> DateTime.add(-min_age_hours, :hour)

    PostSubmission
    |> where([p], p.status == "published")
    |> where([p], p.manual_override == false)
    |> where([p], is_nil(p.last_synced_at) or p.last_synced_at < ^sync_threshold)
    |> where([p], not is_nil(p.post_id))
    |> order_by([p], asc: p.last_synced_at)
    |> limit(^limit)
    |> preload(:organization_social_account)
    |> Repo.all()
  end

  @doc """
  Gets analytics summary for an organization.
  """
  def get_analytics_summary(organization_id, opts \\ []) do
    creator_profile_id = Keyword.get(opts, :creator_profile_id)
    days = Keyword.get(opts, :days, 30)

    since = DateTime.utc_now() |> DateTime.add(-days, :day)

    query = from p in PostSubmission,
      where: p.organization_id == ^organization_id,
      where: p.status == "published",
      where: p.posted_at >= ^since,
      select: %{
        total_posts: count(p.id),
        total_views: sum(p.view_count),
        total_likes: sum(p.like_count),
        total_comments: sum(p.comment_count),
        total_shares: sum(p.share_count),
        total_saves: sum(p.save_count),
        total_reach: sum(p.reach_count),
        total_impressions: sum(p.impressions_count)
      }

    query = if creator_profile_id, do: where(query, [p], p.organization_creator_profile_id == ^creator_profile_id), else: query

    Repo.one(query)
  end
end
