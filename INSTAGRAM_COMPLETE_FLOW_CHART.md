# Complete Instagram Clip Flow - Clippster

This document covers the complete flow from content capture to Instagram posting within **Organizations**.

---

## 🎯 How It Works (Simple Overview)

```mermaid
flowchart LR
    A[📺 Record Stream] --> B[🔍 AI Finds Clips]
    B --> C[✂️ Edit Clip]
    C --> D[🎨 Add Branding]
    D --> E[📱 Post to Instagram]
    E --> F[📊 Track Analytics]
```

---

## 🏢 Organization Structure

```mermaid
flowchart TB
    ORG[🏢 Organization]
    
    ORG --> ADMINS[👑 Admins<br/>Full control]
    ORG --> MEMBERS[👤 Members<br/>Can clip & post]
    
    ORG --> PROFILES[🎨 Creator Profiles<br/>Branding assets]
    ORG --> ACCOUNTS[📱 Instagram Accounts<br/>Connected by admins]
    
    ADMINS --> |assign accounts to| MEMBERS
    MEMBERS --> |use assigned accounts to post| ACCOUNTS
    MEMBERS --> |use assigned profiles for branding| PROFILES
```

**Key point:** Team members do NOT need their own Instagram account. They post using the organization's connected Instagram accounts that are assigned to them.

---

## 📋 Complete Flow (Step by Step)

```mermaid
flowchart TB
    subgraph setup [" 1️⃣  ORGANIZATION SETUP "]
        direction TB
        A1[Admin creates organization] --> A2[Admin invites team members]
    end

    subgraph branding [" 2️⃣  BRAND SETUP "]
        direction TB
        B1[Create Creator Profile] --> B2[Upload intro & outro videos]
        B2 --> B3[Upload watermark/logo]
        B3 --> B4[Link streaming platforms]
    end

    subgraph instagram [" 3️⃣  CONNECT INSTAGRAM "]
        direction TB
        C1[Admin connects org's Instagram] --> C2[Instagram account saved to org]
        C2 --> C3[Admin assigns account to members]
    end

    subgraph content [" 4️⃣  CAPTURE CONTENT "]
        direction TB
        D1[Add streamer to watch list] --> D2[Record livestream]
        D2 --> D3[Video saved locally]
    end

    subgraph clips [" 5️⃣  CREATE CLIPS "]
        direction TB
        E1[AI detects best moments] --> E2[Edit clip in app]
        E2 --> E3[Add subtitles & effects]
        E3 --> E4[Apply Creator Profile branding]
        E4 --> E5[Export final video]
    end

    subgraph publish [" 6️⃣  PUBLISH TO INSTAGRAM "]
        direction TB
        F1[Click Publish in app] --> F2[Select assigned Instagram account]
        F2 --> F3[Write caption]
        F3 --> F4[App posts directly to Instagram]
    end

    subgraph track [" 7️⃣  TRACK PERFORMANCE "]
        direction TB
        G1[Post appears in dashboard] --> G2[Views, likes, comments tracked]
        G2 --> G3[Analytics sync automatically]
    end

    setup --> branding --> instagram --> content --> clips --> publish --> track
```

---

## 👑 What Admins Do

```mermaid
flowchart TB
    subgraph admin_tasks [" ADMIN RESPONSIBILITIES "]
        A1[Create & manage organization]
        A2[Invite team members]
        A3[Create Creator Profiles<br/>intro, outro, watermark]
        A4[Connect Instagram accounts]
        A5[Assign Instagram accounts to members]
        A6[View all posts & analytics]
    end
```

---

## 👤 What Members Do

```mermaid
flowchart TB
    subgraph member_tasks [" MEMBER WORKFLOW "]
        M1[Watch/record livestreams]
        M2[Review AI clip suggestions]
        M3[Edit clips in the app]
        M4[Apply assigned Creator Profile branding]
        M5[Post to assigned Instagram account]
        M6[Track their own posts]
    end
```

**Important:** Members use the organization's Instagram accounts (assigned by admin), NOT their personal accounts.

---

## 📱 Instagram Account Flow

```mermaid
flowchart TB
    subgraph connect [" ADMIN CONNECTS ACCOUNT "]
        A1[Admin clicks Connect Instagram] --> A2[Redirected to Instagram login]
        A2 --> A3[Admin authorizes Clippster]
        A3 --> A4[Account connected to org]
    end

    subgraph assign [" ADMIN ASSIGNS TO MEMBERS "]
        B1[Admin opens account settings] --> B2[Selects team members]
        B2 --> B3[Members can now use this account]
    end

    subgraph use [" MEMBER POSTS "]
        C1[Member selects assigned account] --> C2[Writes caption]
        C2 --> C3[App publishes to Instagram via API]
        C3 --> C4[Post tracked in dashboard]
    end

    connect --> assign --> use
```

---

## 🎬 Clip Creation Flow

```mermaid
flowchart TB
    subgraph capture [" CAPTURE "]
        A1[Add streamer to watch] --> A2[Stream goes live]
        A2 --> A3[Auto-record video segments]
    end

    subgraph detect [" DETECT "]
        B1[Transcribe audio] --> B2[AI analyzes content]
        B2 --> B3[Suggests clip moments]
    end

    subgraph edit [" EDIT "]
        C1[Select clip] --> C2[Adjust timing]
        C2 --> C3[Add subtitles]
        C3 --> C4[Add effects/music]
    end

    subgraph brand [" BRAND "]
        D1[Select Creator Profile] --> D2[Apply intro video]
        D2 --> D3[Apply outro video]
        D3 --> D4[Apply watermark]
    end

    subgraph export [" EXPORT "]
        E1[Choose aspect ratio<br/>9:16, 16:9, 1:1] --> E2[Choose quality]
        E2 --> E3[Build final video]
    end

    capture --> detect --> edit --> brand --> export
```

---

## 📊 Analytics Tracking

```mermaid
flowchart LR
    A[Post published] --> B[Tracked in database]
    B --> C[Hourly sync with Instagram API]
    C --> D[Views, likes, comments updated]
    D --> E[Dashboard shows all metrics]
```

---

## 🔑 Who Can Do What

| Action | 👑 Admin | 👤 Member |
|--------|----------|-----------|
| Create organization | ✅ | ❌ |
| Invite members | ✅ | ❌ |
| Connect Instagram accounts | ✅ | ❌ |
| Assign accounts to members | ✅ | ❌ |
| Create Creator Profiles | ✅ | ❌ |
| Record streams | ✅ | ✅ |
| Create clips | ✅ | ✅ |
| Post to assigned Instagram | ✅ | ✅ |
| View all org analytics | ✅ | ❌ |
| View own posts | ✅ | ✅ |

---

## 🗂️ Key Concepts

| Concept | Description |
|---------|-------------|
| **Organization** | Your team/company that owns Creator Profiles and Instagram accounts |
| **Admin** | Can manage everything: accounts, profiles, members |
| **Member** | Can create clips and post to assigned Instagram accounts |
| **Creator Profile** | Brand package: intro, outro, watermark, platform links |
| **Social Account** | Connected Instagram account owned by the organization |
| **Assignment** | Permission for a member to use an org's Instagram account |
| **Post Submission** | A clip posted to Instagram, tracked with analytics |

---

---

# 🔧 Technical Details (For Engineers)

---

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ organization_members : "joins"
    users ||--o{ social_account_assignments : "assigned_to"
    users ||--o{ post_submissions : "submits"
    
    organizations ||--o{ organization_members : "has"
    organizations ||--o{ organization_creator_profiles : "owns"
    organizations ||--o{ organization_social_accounts : "connects"
    organizations ||--o{ post_submissions : "tracks"
    
    organization_creator_profiles ||--o{ organization_profile_assignments : "assigned_to"
    organization_creator_profiles }o--|| organization_assets : "intro"
    organization_creator_profiles }o--|| organization_assets : "outro"
    organization_creator_profiles }o--|| organization_assets : "watermark"
    
    organization_social_accounts ||--o{ social_account_assignments : "assigned_to"
    organization_social_accounts ||--o{ post_submissions : "posted_via"

    users {
        int id PK
        string email
        string name
    }

    organizations {
        int id PK
        string name
        string slug
        int owner_id FK
    }

    organization_members {
        int id PK
        int organization_id FK
        int user_id FK
        string role "admin|member"
    }

    organization_creator_profiles {
        int id PK
        int organization_id FK
        string name
        int intro_id FK
        int outro_id FK
        int watermark_id FK
    }

    organization_social_accounts {
        int id PK
        int organization_id FK
        string platform "instagram"
        string platform_user_id
        string username
        binary access_token_encrypted
        datetime token_expires_at
        boolean is_active
    }

    social_account_assignments {
        int id PK
        int organization_social_account_id FK
        int user_id FK
        int assigned_by_user_id FK
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
        string status "pending|publishing|published|failed"
        int view_count
        int like_count
        int comment_count
        datetime posted_at
    }
```

---

## Instagram OAuth Flow

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Org Admin
    participant App as Tauri Desktop App
    participant Server as Elixir Server
    participant IG as Instagram OAuth
    participant API as Instagram Graph API

    Admin->>App: Click "Connect Instagram"
    App->>Server: GET /auth/instagram/start<br/>?organization_id=X&callback_port=Y
    
    Note over Server: Verify admin permission
    
    Server->>Server: Generate OAuth state
    Server->>Admin: Redirect to Instagram
    
    Admin->>IG: Log in & authorize
    IG->>Server: Callback with auth code
    
    Server->>IG: Exchange code for token
    IG-->>Server: Short-lived token
    
    Server->>API: Exchange for long-lived token (60 days)
    API-->>Server: Long-lived token
    
    Server->>API: GET /me (username, id)
    API-->>Server: Profile info
    
    Server->>Server: Encrypt token (AES-256-GCM)<br/>Create organization_social_account
    
    Server->>App: Redirect with success
    App->>Admin: "@username connected!"
```

---

## Post Publishing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Member as Org Member
    participant App as Desktop App
    participant Server as Elixir Server
    participant CDN as R2 Storage
    participant IG as Instagram API

    Member->>App: Click Publish
    App->>Server: GET /organizations/:id/social-accounts
    Server-->>App: List of assigned accounts
    
    Member->>App: Select account, write caption
    
    App->>CDN: Upload video file
    CDN-->>App: Media URL
    
    App->>Server: POST /organizations/:id/posts/publish
    
    Note over Server: Check has_account_access?<br/>(admin OR assigned)
    
    Server->>Server: Create post_submission (pending)
    
    Server->>IG: POST /media (create container)
    IG-->>Server: container_id
    
    Server->>IG: Poll status until FINISHED
    
    Server->>IG: POST /media_publish
    IG-->>Server: post_id
    
    Server->>Server: Update post_submission (published)
    
    Server-->>App: Success + post URL
    App-->>Member: "Posted successfully!"
```

---

## Access Control Logic

```mermaid
flowchart TB
    A[User wants to post to account X] --> B{Is user an admin?}
    B -->|Yes| C[✅ Access granted]
    B -->|No| D{Is user assigned to account X?}
    D -->|Yes| C
    D -->|No| E[❌ Access denied]
```

**Code reference:** `Social.has_account_access?/3`

```elixir
def has_account_access?(organization_id, account_id, user_id) do
  # Admins always have access
  if Organizations.is_admin?(organization_id, user_id) do
    true
  else
    # Check if assigned
    SocialAccountAssignment
    |> join(:inner, [a], s in SocialAccount, on: ...)
    |> where([a, s], s.id == ^account_id and a.user_id == ^user_id)
    |> Repo.exists?()
  end
end
```

---

## System Architecture

```mermaid
flowchart TB
    subgraph client [Desktop App - Tauri]
        UI[Vue.js Frontend]
        Rust[Rust Backend]
        SQLite[(Local SQLite)]
        FFmpeg[FFmpeg]
    end

    subgraph server [Backend - Elixir/Phoenix]
        API[REST API]
        PG[(PostgreSQL)]
        Workers[Background Workers]
    end

    subgraph external [External]
        IG[Instagram API]
        R2[Cloudflare R2]
        Streams[Kick/Twitch/YouTube/PumpFun]
    end

    UI <--> Rust
    Rust <--> SQLite
    Rust <--> FFmpeg
    
    UI <-->|HTTP| API
    API <--> PG
    Workers <--> PG
    
    Rust -->|Record| Streams
    API <-->|OAuth & Publish| IG
    API <-->|Upload| R2
    Workers -->|Sync analytics| IG
```

---

## Key API Routes

### Organization Social Accounts
```
GET    /api/organizations/:org_id/social-accounts              List connected accounts
POST   /api/organizations/:org_id/social-accounts              Connect new account (admin)
DELETE /api/organizations/:org_id/social-accounts/:id          Disconnect account (admin)
POST   /api/organizations/:org_id/social-accounts/:id/assign   Assign to members (admin)
DELETE /api/organizations/:org_id/social-accounts/:id/assign/:user_id  Unassign (admin)
```

### Publishing
```
POST   /api/organizations/:org_id/posts/publish                Publish clip to Instagram
GET    /api/organizations/:org_id/posts                        List all posts
GET    /api/organizations/:org_id/posts/:id                    Get single post
PUT    /api/organizations/:org_id/posts/:id                    Update analytics (admin)
GET    /api/organizations/:org_id/posts/analytics              Get analytics summary
```

### Instagram OAuth
```
GET    /api/auth/instagram/start                               Start OAuth flow
GET    /api/auth/instagram/callback                            OAuth callback
```

---

## Key Files

| Component | Path |
|-----------|------|
| **Server** | |
| Social context | `server/lib/clippster_server/social.ex` |
| Social account schema | `server/lib/clippster_server/social/social_account.ex` |
| Account assignment schema | `server/lib/clippster_server/social/social_account_assignment.ex` |
| Post submission schema | `server/lib/clippster_server/social/post_submission.ex` |
| Instagram API client | `server/lib/clippster_server/social/platforms/instagram.ex` |
| Instagram OAuth controller | `server/lib/clippster_server_web/controllers/instagram_auth_controller.ex` |
| Post controller | `server/lib/clippster_server_web/controllers/post_submission_controller.ex` |
| **Client** | |
| Social accounts manager | `client/src/components/organization/SocialAccountsManager.vue` |
| Publish dialog | `client/src/components/organization/PublishDialog.vue` |
| Social API service | `client/src/services/socialAccountsApi.ts` |
| Instagram auth helper | `client/src/lib/instagram-auth.ts` |
