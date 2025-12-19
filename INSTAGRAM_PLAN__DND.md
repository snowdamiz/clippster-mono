# Instagram Social Integration for Organizations

## Architecture Overview

```mermaid
erDiagram
    organizations ||--o{ organization_social_accounts : has
    organization_social_accounts ||--o{ social_account_assignments : assigned_to
    users ||--o{ social_account_assignments : can_use
    organization_creator_profiles ||--o{ post_submissions : tracks
    organization_social_accounts ||--o{ post_submissions : posted_via
    users ||--o{ post_submissions : submitted_by

    organization_social_accounts {
        int id PK
        int organization_id FK
        string platform
        string platform_user_id
        string username
        string display_name
        string profile_image_url
        text access_token_encrypted
        text refresh_token_encrypted
        datetime token_expires_at
        datetime connected_at
    }

    social_account_assignments {
        int id PK
        int organization_social_account_id FK
        int user_id FK
        datetime assigned_at
    }

    post_submissions {
        int id PK
        int organization_id FK
        int organization_social_account_id FK
        int organization_creator_profile_id FK
        int submitted_by_user_id FK
        string platform
        string post_id
        string post_url
        string media_type
        int view_count
        int like_count
        int comment_count
        int share_count
        datetime posted_at
        datetime last_synced_at
        boolean manual_override
    }
```

## Phase 1: Database Schema

Create new migrations in [`server/priv/repo/migrations/`](server/priv/repo/migrations/):

**Migration 1: `create_organization_social_accounts.exs`**

- `organization_social_accounts` table with encrypted OAuth tokens
- `platform` field supports future expansion ("instagram", later "tiktok", "twitter", etc.)

**Migration 2: `create_social_account_assignments.exs`**

- Many-to-many relationship between social accounts and org members

**Migration 3: `create_post_submissions.exs`**

- Track published posts with analytics fields
- Links to social account, creator profile, and submitting user

## Phase 2: Server - Instagram OAuth

### New Files

- [`server/lib/clippster_server/social/`](server/lib/clippster_server/social/) - New context module
  - `social_account.ex` - Schema
  - `social_account_assignment.ex` - Schema
  - `post_submission.ex` - Schema  
  - `instagram_api.ex` - Instagram Graph API client
  - `token_encryption.ex` - Encrypt/decrypt OAuth tokens

### OAuth Flow

1. Admin initiates connect from dashboard
2. Server redirects to Instagram OAuth (Meta Business API)
3. Callback exchanges code for access/refresh tokens
4. Tokens encrypted and stored with account metadata

**Key Routes to add in [`router.ex`](server/lib/clippster_server_web/router.ex):**

```elixir
# Instagram OAuth
get "/auth/instagram", SocialAuthController, :instagram_request
get "/auth/instagram/callback", SocialAuthController, :instagram_callback

# Organization social accounts (protected)
resources "/organizations/:org_id/social-accounts", SocialAccountController
post "/organizations/:org_id/social-accounts/:id/refresh", SocialAccountController, :refresh_token

# Account assignments
get "/organizations/:org_id/social-accounts/:id/assignments", SocialAccountController, :list_assignments
post "/organizations/:org_id/social-accounts/:id/assignments", SocialAccountController, :assign
delete "/organizations/:org_id/social-accounts/:id/assignments/:user_id", SocialAccountController, :unassign

# Post submissions
get "/organizations/:org_id/posts", PostSubmissionController, :index
post "/organizations/:org_id/posts/publish", PostSubmissionController, :publish
put "/organizations/:org_id/posts/:id", PostSubmissionController, :update
post "/organizations/:org_id/posts/:id/sync", PostSubmissionController, :sync_analytics
```

## Phase 3: Instagram API Integration

### Publishing Flow

1. Member selects connected IG account + creator profile
2. Upload media to Instagram via Content Publishing API
3. Create container, then publish
4. Store post_id and URL in `post_submissions`

### Analytics Sync

- GenServer worker runs hourly to sync analytics
- Uses Instagram Insights API for metrics
- Stores view_count, like_count, comment_count, share_count
- `manual_override` flag prevents auto-sync from overwriting manual entries

**New worker in [`server/lib/clippster_server/social/analytics_sync_worker.ex`](server/lib/clippster_server/social/analytics_sync_worker.ex)**

## Phase 4: Client - UI Components

### New Components in [`client/src/components/`](client/src/components/)

- `SocialAccountsManager.vue` - Connect/manage IG accounts
- `SocialAccountAssignments.vue` - Assign accounts to members  
- `PostSubmissionsList.vue` - View all posts with analytics
- `PublishDialog.vue` - Publish clip to Instagram

### Updates to Existing

- [`OrganizationDashboard.vue`](client/src/components/OrganizationDashboard.vue) - Add "Social Accounts" and "Posts" tabs
- New API service: `client/src/services/socialAccountsApi.ts`

### Dashboard Posts View

- Table showing all posts with columns: Thumbnail, Creator Profile, Account, Platform, Views, Likes, Comments, Posted At
- Filter by creator profile, account, date range
- Click to expand with full analytics and post details
- Manual edit option for analytics with override flag

## Phase 5: Platform Abstraction (Extensibility)

Design patterns for future platforms:

```elixir
# Platform behavior
defmodule ClippsterServer.Social.Platform do
  @callback authorize_url(opts) :: String.t()
  @callback exchange_code(code) :: {:ok, tokens} | {:error, reason}
  @callback refresh_tokens(refresh_token) :: {:ok, tokens} | {:error, reason}
  @callback publish_media(account, media_url, caption) :: {:ok, post} | {:error, reason}
  @callback get_insights(post_id) :: {:ok, metrics} | {:error, reason}
end

# Implementations
defmodule ClippsterServer.Social.Platforms.Instagram do
  @behaviour ClippsterServer.Social.Platform
  # ...
end
```

## Environment Variables Required

```bash
# Instagram/Meta
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=

# Token encryption key
SOCIAL_TOKEN_ENCRYPTION_KEY=
```

## Key Implementation Notes

1. **Token Security**: OAuth tokens must be encrypted at rest using AES-256-GCM
2. **Token Refresh**: Background job to refresh tokens before expiry (Instagram tokens last 60 days)
3. **Rate Limits**: Instagram API has strict rate limits - implement exponential backoff
4. **Permissions**: Only org admins can connect accounts; members can only use assigned accounts
5. **Analytics Sync**: Batch sync to minimize API calls, respect rate limits

## Files to Create

| File | Purpose |

|------|---------|

| `server/lib/clippster_server/social.ex` | Social context module |

| `server/lib/clippster_server/social/social_account.ex` | Schema |

| `server/lib/clippster_server/social/social_account_assignment.ex` | Schema |

| `server/lib/clippster_server/social/post_submission.ex` | Schema |

| `server/lib/clippster_server/social/instagram_api.ex` | IG API client |

| `server/lib/clippster_server/social/token_encryption.ex` | Token crypto |

| `server/lib/clippster_server/social/analytics_sync_worker.ex` | Sync worker |

| `server/lib/clippster_server/social/platform.ex` | Platform behavior |

| `server/lib/clippster_server_web/controllers/social_auth_controller.ex` | OAuth controller |

| `server/lib/clippster_server_web/controllers/social_account_controller.ex` | Accounts CRUD |

| `server/lib/clippster_server_web/controllers/post_submission_controller.ex` | Posts controller |

| `client/src/services/socialAccountsApi.ts` | API service |

| `client/src/components/organization/SocialAccountsManager.vue` | Account management UI |

| `client/src/components/organization/SocialAccountAssignments.vue` | Assignment UI |

| `client/src/components/organization/PostSubmissionsList.vue` | Posts dashboard |

| `client/src/components/organization/PublishDialog.vue` | Publish modal |