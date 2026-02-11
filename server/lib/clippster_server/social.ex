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
  Updates an existing social account by platform and platform_user_id.
  Used when reconnecting an account that was previously connected.
  Admin only.
  """
  def update_existing_account(organization_id, platform, platform_user_id, attrs, %User{} = user) do
    if Organizations.is_admin?(organization_id, user.id) do
      case get_social_account_by_platform(organization_id, platform, platform_user_id) do
        nil ->
          {:error, :not_found}
        account ->
          update_social_account(account, attrs)
      end
    else
      {:error, :unauthorized}
    end
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
    submitted_by_user_id = Keyword.get(opts, :submitted_by_user_id)
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
    query = if submitted_by_user_id, do: where(query, [p], p.submitted_by_user_id == ^submitted_by_user_id), else: query

    posts = Repo.all(query)

    # Get total count
    count_query = from p in PostSubmission,
      where: p.organization_id == ^organization_id,
      select: count(p.id)

    count_query = if creator_profile_id, do: where(count_query, [p], p.organization_creator_profile_id == ^creator_profile_id), else: count_query
    count_query = if account_id, do: where(count_query, [p], p.organization_social_account_id == ^account_id), else: count_query
    count_query = if platform, do: where(count_query, [p], p.platform == ^platform), else: count_query
    count_query = if status, do: where(count_query, [p], p.status == ^status), else: count_query
    count_query = if submitted_by_user_id, do: where(count_query, [p], p.submitted_by_user_id == ^submitted_by_user_id), else: count_query

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
        total_saves: sum(p.save_count),
        total_reach: sum(p.reach_count),
        total_impressions: sum(p.impressions_count)
      }

    query = if creator_profile_id, do: where(query, [p], p.organization_creator_profile_id == ^creator_profile_id), else: query

    Repo.one(query)
  end

  # ============================================================================
  # Scheduling Functions
  # ============================================================================

  @doc """
  Schedules a post for future publishing.
  """
  def schedule_post(attrs, %User{} = user) do
    %PostSubmission{}
    |> PostSubmission.schedule_changeset(Map.put(attrs, :submitted_by_user_id, user.id))
    |> Repo.insert()
  end

  @doc """
  Creates a post for immediate publishing (no scheduling).
  """
  def create_immediate_post(attrs, %User{} = user) do
    %PostSubmission{}
    |> PostSubmission.create_changeset(Map.put(attrs, :submitted_by_user_id, user.id))
    |> Repo.insert()
  end

  @doc """
  Updates a scheduled post (before it's locked).
  """
  def update_scheduled_post(%PostSubmission{} = post, attrs, %User{} = user) do
    # Verify the user can edit this post
    if can_user_edit_post?(post, user) do
      post
      |> PostSubmission.update_scheduled_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Cancels a scheduled post.
  """
  def cancel_scheduled_post(%PostSubmission{} = post, %User{} = user) do
    if can_user_edit_post?(post, user) do
      post
      |> PostSubmission.cancel_changeset()
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Gets scheduled posts that are ready to publish.
  """
  def get_scheduled_posts_ready_to_publish(now, limit \\ 20) do
    PostSubmission
    |> where([p], p.status == "scheduled")
    |> where([p], p.scheduled_at <= ^now)
    |> where([p], is_nil(p.locked_at))
    |> order_by([p], asc: p.scheduled_at)
    |> limit(^limit)
    |> preload([:organization_social_account, :user_social_account])
    |> Repo.all()
  end

  @doc """
  Locks a post for publishing (prevents concurrent processing).
  Uses optimistic locking by checking locked_at is still nil.
  """
  def lock_post_for_publishing(%PostSubmission{} = post) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    result =
      from(p in PostSubmission,
        where: p.id == ^post.id,
        where: is_nil(p.locked_at),
        where: p.status in ["scheduled", "pending"]
      )
      |> Repo.update_all(
        set: [
          locked_at: now,
          started_at: now,
          status: "publishing",
          updated_at: now
        ]
      )

    case result do
      {1, _} ->
        # Successfully locked, fetch the updated post
        {:ok, get_post_submission(post.id)}

      {0, _} ->
        {:error, :already_locked}
    end
  end

  @doc """
  Unlocks a post for retry after transient failure.
  """
  def unlock_post_for_retry(%PostSubmission{} = post) do
    post
    |> PostSubmission.unlock_changeset()
    |> Repo.update()
  end

  @doc """
  Increments the attempt counter for a post.
  """
  def increment_post_attempt(%PostSubmission{} = post) do
    post
    |> PostSubmission.increment_attempt_changeset()
    |> Repo.update()
  end

  @doc """
  Gets all scheduled posts for a user.
  """
  def get_user_scheduled_posts(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    status = Keyword.get(opts, :status)

    query =
      from p in PostSubmission,
        where: p.submitted_by_user_id == ^user_id,
        order_by: [desc: p.scheduled_at],
        limit: ^limit,
        preload: [:user_social_account, :organization_social_account, :organization, :organization_creator_profile, :submitted_by_user, :campaign]

    query = if status, do: where(query, [p], p.status == ^status), else: query

    Repo.all(query)
  end

  @doc """
  Gets all scheduled posts for an organization (admin view).
  """
  def get_org_scheduled_posts(organization_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)
    status = Keyword.get(opts, :status)

    query =
      from p in PostSubmission,
        where: p.organization_id == ^organization_id,
        where: p.owner_type == "org",
        order_by: [desc: p.scheduled_at, desc: p.inserted_at],
        limit: ^limit,
        offset: ^offset,
        preload: [:organization_social_account, :organization_creator_profile, :submitted_by_user, :campaign, :organization]

    query = if status, do: where(query, [p], p.status == ^status), else: query

    posts = Repo.all(query)

    # Get total count
    count_query =
      from p in PostSubmission,
        where: p.organization_id == ^organization_id,
        where: p.owner_type == "org",
        select: count(p.id)

    count_query = if status, do: where(count_query, [p], p.status == ^status), else: count_query

    total = Repo.one(count_query)

    {:ok, %{posts: posts, total: total}}
  end

  @doc """
  Retries a failed scheduled post.
  Resets the post to scheduled status and clears the lock.
  """
  def retry_failed_post(%PostSubmission{} = post, %User{} = _user) do
    cond do
      post.status != "failed" ->
        {:error, :not_failed}

      post.attempts >= post.max_attempts + 3 ->
        # Allow 3 extra manual retries beyond max_attempts
        {:error, :max_retries_exceeded}

      true ->
        post
        |> PostSubmission.retry_changeset()
        |> Repo.update()
    end
  end

  # ============================================================================
  # External Post Submissions (Link Submissions)
  # ============================================================================

  alias ClippsterServer.Social.ExternalPostSubmission

  @doc """
  Creates an external post submission (link submission).
  """
  def create_external_post_submission(organization_id, attrs, %User{} = user) do
    if Organizations.is_member?(organization_id, user.id) do
      %ExternalPostSubmission{}
      |> ExternalPostSubmission.create_changeset(
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
  Lists external post submissions for an organization.
  """
  def list_external_post_submissions(organization_id, opts \\ []) do
    status = Keyword.get(opts, :status)
    creator_profile_id = Keyword.get(opts, :creator_profile_id)
    campaign_id = Keyword.get(opts, :campaign_id)
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    query =
      from e in ExternalPostSubmission,
        where: e.organization_id == ^organization_id,
        order_by: [desc: e.inserted_at],
        limit: ^limit,
        offset: ^offset,
        preload: [:submitted_by_user, :reviewed_by_user, :organization_creator_profile, :campaign]

    query = if status, do: where(query, [e], e.status == ^status), else: query
    query = if creator_profile_id, do: where(query, [e], e.organization_creator_profile_id == ^creator_profile_id), else: query
    query = if campaign_id, do: where(query, [e], e.campaign_id == ^campaign_id), else: query

    posts = Repo.all(query)

    # Get total count
    count_query =
      from e in ExternalPostSubmission,
        where: e.organization_id == ^organization_id,
        select: count(e.id)

    count_query = if status, do: where(count_query, [e], e.status == ^status), else: count_query
    count_query = if creator_profile_id, do: where(count_query, [e], e.organization_creator_profile_id == ^creator_profile_id), else: count_query
    count_query = if campaign_id, do: where(count_query, [e], e.campaign_id == ^campaign_id), else: count_query

    total = Repo.one(count_query)

    {:ok, %{posts: posts, total: total}}
  end

  @doc """
  Gets an external post submission by ID.
  """
  def get_external_post_submission(organization_id, id) do
    ExternalPostSubmission
    |> where([e], e.organization_id == ^organization_id and e.id == ^id)
    |> preload([:submitted_by_user, :reviewed_by_user, :organization_creator_profile, :campaign])
    |> Repo.one()
  end

  @doc """
  Approves an external post submission.
  Admin only.
  """
  def approve_external_post_submission(%ExternalPostSubmission{} = submission, %User{} = admin) do
    if Organizations.is_admin?(submission.organization_id, admin.id) do
      submission
      |> ExternalPostSubmission.approve_changeset(admin.id)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Rejects an external post submission.
  Admin only.
  """
  def reject_external_post_submission(%ExternalPostSubmission{} = submission, %User{} = admin, notes \\ nil) do
    if Organizations.is_admin?(submission.organization_id, admin.id) do
      submission
      |> ExternalPostSubmission.reject_changeset(admin.id, notes)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Updates analytics for an external post submission.
  """
  def update_external_post_analytics(%ExternalPostSubmission{} = submission, attrs, %User{} = user) do
    # Allow the submitter or admins to update
    if submission.submitted_by_user_id == user.id or Organizations.is_admin?(submission.organization_id, user.id) do
      submission
      |> ExternalPostSubmission.update_analytics_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  System-level analytics update for external posts (no user validation).
  Used for background sync operations.
  """
  def sync_external_post_analytics(%ExternalPostSubmission{} = submission, attrs) do
    submission
    |> ExternalPostSubmission.update_analytics_changeset(attrs)
    |> Repo.update()
  end

  # ============================================================================
  # Helper Functions
  # ============================================================================

  defp can_user_edit_post?(%PostSubmission{} = post, %User{} = user) do
    cond do
      # User submitted the post
      post.submitted_by_user_id == user.id ->
        PostSubmission.can_edit?(post)

      # User is an admin of the org
      post.organization_id && Organizations.is_admin?(post.organization_id, user.id) ->
        PostSubmission.can_edit?(post)

      true ->
        false
    end
  end
end
