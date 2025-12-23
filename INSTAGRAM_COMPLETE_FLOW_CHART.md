# Complete Instagram Clip Flow - Clippster

This document covers the complete flow from content capture to Instagram posting, with clear separation between **Organizations** and **Clippers**.

---

## 🎯 The Two User Types

```mermaid
flowchart TB
    subgraph org_type [" 🏢 ORGANIZATION "]
        direction TB
        O1[Owns the brand/creator]
        O2[Creates campaigns]
        O3[Connects THEIR Instagram accounts]
        O4[Pays clippers for views]
    end

    subgraph clipper_type [" ✂️ CLIPPER "]
        direction TB
        C1[Joins campaigns to clip for brands]
        C2[Creates clips using org's branding]
        C3[Posts to THEIR OWN Instagram]
        C4[Gets paid based on views]
    end
```

---

## 📋 Simple Overview: The Complete Journey

```mermaid
flowchart TB
    subgraph phase1 [" PHASE 1: Setup "]
        direction TB
        A1[🏢 Org creates account]
        A2[🎨 Org sets up Creator Profile<br/>intro, outro, watermark, logo]
        A3[📱 Org connects Instagram account]
        A4[📢 Org creates Clipping Campaign]
    end

    subgraph phase2 [" PHASE 2: Clipper Joins "]
        direction TB
        B1[✂️ Clipper browses campaigns]
        B2[✂️ Clipper joins campaign]
        B3[✂️ Clipper gets access to<br/>Creator Profile & assets]
        B4[📱 Clipper connects THEIR Instagram]
    end

    subgraph phase3 [" PHASE 3: Create Clips "]
        direction TB
        C1[📺 Watch/record livestream]
        C2[🔍 AI detects best moments]
        C3[✂️ Edit clip in desktop app]
        C4[🎨 Apply org's branding<br/>intro + outro + watermark]
        C5[📦 Export final video]
    end

    subgraph phase4 [" PHASE 4: Publish & Track "]
        direction TB
        D1[📤 Post to Instagram]
        D2[🔗 Submit link to campaign]
        D3[✅ Org verifies the post]
        D4[📊 Views tracked over time]
        D5[💰 Clipper gets paid based on CPM]
    end

    phase1 --> phase2 --> phase3 --> phase4
```

---

## 🏢 Organization Flow (Detailed)

### What Organizations Do

```mermaid
flowchart TB
    subgraph org_setup [" 1️⃣  ORGANIZATION SETUP "]
        A1[Create Organization] --> A2[Invite team members<br/>as admin or member]
    end

    subgraph brand_setup [" 2️⃣  BRAND SETUP "]
        B1[Create Creator Profile] --> B2[Upload intro video]
        B2 --> B3[Upload outro video]
        B3 --> B4[Upload watermark/logo]
        B4 --> B5[Link streaming platforms<br/>Kick, Twitch, YouTube, PumpFun]
    end

    subgraph social_setup [" 3️⃣  CONNECT SOCIAL ACCOUNTS "]
        C1[Admin clicks Connect Instagram] --> C2[Log into Instagram]
        C2 --> C3[Authorize Clippster app]
        C3 --> C4[Instagram account connected!]
        C4 --> C5[Optionally assign to<br/>specific team members]
    end

    subgraph campaign_setup [" 4️⃣  CREATE CAMPAIGN "]
        D1[Set campaign title & description] --> D2[Link to Creator Profile]
        D2 --> D3[Set budget & CPM rate]
        D3 --> D4[Choose allowed platforms<br/>Instagram, TikTok, X]
        D4 --> D5[Set join type:<br/>Open or Application Required]
        D5 --> D6[Launch campaign!]
    end

    subgraph manage [" 5️⃣  MANAGE SUBMISSIONS "]
        E1[Review clipper applications] --> E2[Approve/reject clippers]
        E2 --> E3[Review submitted clips]
        E3 --> E4[Verify posts are real]
        E4 --> E5[Track views & pay clippers]
    end

    org_setup --> brand_setup --> social_setup --> campaign_setup --> manage
```

---

## ✂️ Clipper Flow (Detailed)

### What Clippers Do

```mermaid
flowchart TB
    subgraph find_work [" 1️⃣  FIND A CAMPAIGN "]
        A1[Browse campaign marketplace] --> A2[View campaign details<br/>CPM rate, budget, platforms]
        A2 --> A3[Apply or Join campaign]
        A3 --> A4[Wait for approval<br/>or auto-approved if open]
    end

    subgraph get_access [" 2️⃣  GET ACCESS TO BRAND ASSETS "]
        B1[Approval granted!] --> B2[Creator Profile appears<br/>in your Creators tab]
        B2 --> B3[Download intro & outro videos]
        B3 --> B4[Get watermark settings]
        B4 --> B5[See which streamers to clip]
    end

    subgraph connect_social [" 3️⃣  CONNECT YOUR INSTAGRAM "]
        C1[Go to your profile settings] --> C2[Connect Instagram account]
        C2 --> C3[Your account = your posts]
    end

    subgraph create_clips [" 4️⃣  CREATE CLIPS "]
        D1[Open the desktop app] --> D2[Watch live or recorded streams]
        D2 --> D3[AI suggests best clip moments]
        D3 --> D4[Select and refine clips]
        D4 --> D5[Add subtitles & effects]
        D5 --> D6[Apply org's intro/outro/watermark]
        D6 --> D7[Export in 9:16 for Reels]
    end

    subgraph post_submit [" 5️⃣  POST & SUBMIT "]
        E1[Post clip to YOUR Instagram] --> E2[Copy the post URL]
        E2 --> E3[Submit URL to campaign]
        E3 --> E4[Org verifies your post]
        E4 --> E5[Views accumulate over time]
        E5 --> E6[Get paid based on CPM! 💰]
    end

    find_work --> get_access --> connect_social --> create_clips --> post_submit
```

---

## 🎬 Clip Creation Flow (Desktop App)

### How clips are actually made

```mermaid
flowchart TB
    subgraph capture [" 📺 CONTENT CAPTURE "]
        A1[Add streamer to watch list] --> A2[Detect when stream goes live]
        A2 --> A3[Auto-record livestream]
        A3 --> A4[Save video segments locally]
    end

    subgraph detect [" 🔍 CLIP DETECTION "]
        B1[Transcribe audio to text] --> B2[AI analyzes transcript]
        B2 --> B3[AI suggests clip moments<br/>funny, exciting, important]
        B3 --> B4[You review suggestions]
        B4 --> B5[Accept, modify, or create manual clips]
    end

    subgraph edit [" ✂️ CLIP EDITING "]
        C1[Open clip in editor] --> C2[Trim start & end points]
        C2 --> C3[Add auto-generated subtitles]
        C3 --> C4[Adjust subtitle style & position]
        C4 --> C5[Add music or sound effects]
        C5 --> C6[Apply video filters & effects]
    end

    subgraph brand [" 🎨 APPLY BRANDING "]
        D1[Select Creator Profile] --> D2[Add intro video at start]
        D2 --> D3[Add outro video at end]
        D3 --> D4[Apply watermark overlay]
    end

    subgraph export [" 📦 EXPORT "]
        E1[Choose aspect ratio:<br/>9:16 Reels, 16:9 YouTube, 1:1 Feed] --> E2[Choose quality: 720p, 1080p, 4K]
        E2 --> E3[FFmpeg builds final video]
        E3 --> E4[Video saved to your computer]
    end

    capture --> detect --> edit --> brand --> export
```

---

## 📱 Instagram Posting Flow

### How clips get to Instagram

```mermaid
flowchart TB
    subgraph org_path [" 🏢 ORGANIZATION MEMBER PATH "]
        direction TB
        O1[Click Publish in app] --> O2[Select org's Instagram account]
        O2 --> O3[Write caption]
        O3 --> O4[App uploads to Instagram API]
        O4 --> O5[Posted directly via org's account]
        O5 --> O6[Analytics tracked in dashboard]
    end

    subgraph clipper_path [" ✂️ CLIPPER PATH "]
        direction TB
        C1[Export clip to computer] --> C2[Open Instagram on phone]
        C2 --> C3[Post as a Reel manually]
        C3 --> C4[Copy the post URL]
        C4 --> C5[Submit URL to campaign]
        C5 --> C6[Views tracked for payment]
    end
```

---

## 📊 Analytics & Payment Flow

```mermaid
flowchart LR
    subgraph tracking [" TRACKING "]
        A1[Clip posted to Instagram] --> A2[Post URL submitted to campaign]
        A2 --> A3[Org verifies it's real]
    end

    subgraph analytics [" ANALYTICS "]
        B1[System checks view count] --> B2[Views tracked over time]
        B2 --> B3[Reaches minimum threshold?]
    end

    subgraph payment [" PAYMENT "]
        C1[Calculate earnings:<br/>Views ÷ 1000 × CPM] --> C2[Clipper sees earnings]
        C2 --> C3[Org processes payment]
        C3 --> C4[💰 Money to clipper!]
    end

    tracking --> analytics --> B3
    B3 -->|Yes| payment
    B3 -->|No| B2
```

---

## 🔑 Key Differences: Org vs Clipper

| Aspect | 🏢 Organization | ✂️ Clipper |
|--------|-----------------|------------|
| **Instagram Account** | Org owns & connects it | Clipper uses their own |
| **Who Posts** | Org member posts via app | Clipper posts manually |
| **Branding Assets** | Org creates them | Clipper uses org's assets |
| **Payment** | Org pays clippers | Clipper receives payment |
| **Analytics** | Sees all posts in dashboard | Sees only their submissions |
| **Creator Profile** | Org creates & owns | Clipper gets temporary access |

---

## 🗂️ Data Summary

### What lives WHERE?

| Data | Location | Owner |
|------|----------|-------|
| Video files, clips | Desktop app (local SQLite) | User's computer |
| Organization info | Server (PostgreSQL) | Organization |
| Creator Profiles & assets | Server | Organization |
| Org's Instagram accounts | Server (encrypted) | Organization |
| Clipper's Instagram accounts | Server (encrypted) | Individual clipper |
| Campaigns | Server | Organization |
| Clip submissions | Server | Linked to clipper & campaign |
| Post analytics | Server | Tracked per post |
| Payments | Server | Linked to submissions |

---

---

# 🔧 Technical Details (For Engineers)

---

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ organization_members : "joins"
    users ||--o{ clipper_social_accounts : "owns"
    users ||--o{ campaign_participants : "participates"
    users ||--o{ campaign_submissions : "submits"
    
    organizations ||--o{ organization_members : "has"
    organizations ||--o{ organization_creator_profiles : "owns"
    organizations ||--o{ organization_social_accounts : "connects"
    organizations ||--o{ clipping_campaigns : "creates"
    
    organization_creator_profiles ||--o{ organization_profile_assignments : "assigned_to"
    organization_creator_profiles }o--|| organization_assets : "uses_intro"
    organization_creator_profiles }o--|| organization_assets : "uses_outro"
    organization_creator_profiles }o--|| organization_assets : "uses_watermark"
    
    organization_social_accounts ||--o{ social_account_assignments : "assigned_to"
    organization_social_accounts ||--o{ post_submissions : "posts_via"
    
    clipping_campaigns ||--o{ campaign_participants : "has"
    clipping_campaigns }o--|| organization_creator_profiles : "uses"
    
    campaign_participants ||--o{ campaign_submissions : "submits"
    campaign_submissions ||--o{ campaign_payments : "earns"
    
    clipper_social_accounts ||--o{ campaign_submissions : "posted_from"

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
        string platform
        string username
        binary access_token_encrypted
    }

    clipper_social_accounts {
        int id PK
        int user_id FK
        string platform
        string username
        binary access_token_encrypted
    }

    clipping_campaigns {
        int id PK
        int organization_id FK
        int creator_profile_id FK
        string title
        decimal budget
        decimal cpm
        string status
    }

    campaign_participants {
        int id PK
        int campaign_id FK
        int user_id FK
        string status
    }

    campaign_submissions {
        int id PK
        int campaign_id FK
        int user_id FK
        int social_account_id FK
        string clip_url
        int view_count
        string status
    }

    campaign_payments {
        int id PK
        int submission_id FK
        decimal amount
        string status
    }
```

---

## Instagram OAuth Flow (Technical)

```mermaid
sequenceDiagram
    autonumber
    participant User as User (Admin/Clipper)
    participant App as Tauri Desktop App
    participant Server as Elixir Server
    participant IG as Instagram OAuth
    participant API as Instagram Graph API

    User->>App: Click "Connect Instagram"
    
    alt Organization Admin
        App->>Server: GET /auth/instagram/start<br/>?organization_id=X
    else Individual Clipper
        App->>Server: GET /auth/instagram/start<br/>?user_account=true
    end
    
    Server->>Server: Generate state token<br/>Store in Cachex
    Server->>User: Redirect to Instagram
    
    User->>IG: Log in & authorize
    IG->>Server: Callback with auth code
    
    Server->>IG: Exchange code for token
    IG-->>Server: Short-lived token
    
    Server->>API: Exchange for long-lived token
    API-->>Server: 60-day token
    
    Server->>API: GET /me (profile info)
    API-->>Server: username, id, picture
    
    Server->>Server: Encrypt token (AES-256-GCM)
    
    alt Organization Admin
        Server->>Server: Create organization_social_account
    else Individual Clipper
        Server->>Server: Create clipper_social_account
    end
    
    Server->>App: Redirect with success
    App->>User: "Connected @username!"
```

---

## Clip Build Pipeline (Technical)

```mermaid
flowchart TB
    subgraph input [Input]
        A1[Raw video segments<br/>from livestream]
        A2[Clip timestamps<br/>start & end times]
        A3[Transcript words<br/>with timing data]
    end

    subgraph processing [Processing Pipeline - Rust/FFmpeg]
        B1[Concatenate segments] --> B2[Extract clip range]
        B2 --> B3[Apply video filters<br/>brightness, contrast, etc]
        B3 --> B4[Render subtitles<br/>word-by-word animation]
        B4 --> B5[Composite watermark]
        B5 --> B6[Prepend intro video]
        B6 --> B7[Append outro video]
        B7 --> B8[Mix audio tracks]
        B8 --> B9[Encode final output]
    end

    subgraph output [Output]
        C1[9:16 Reels version]
        C2[16:9 YouTube version]
        C3[1:1 Feed version]
        C4[4:5 Feed version]
    end

    input --> processing
    B9 --> C1
    B9 --> C2
    B9 --> C3
    B9 --> C4
```

---

## System Architecture

```mermaid
flowchart TB
    subgraph client [Desktop App - Tauri]
        UI[Vue.js Frontend]
        Rust[Rust Backend]
        SQLite[(Local SQLite DB)]
        FFmpeg[FFmpeg Binaries]
        
        UI <--> Rust
        Rust <--> SQLite
        Rust <--> FFmpeg
    end

    subgraph server [Backend Server - Elixir/Phoenix]
        API[REST API]
        PG[(PostgreSQL DB)]
        Workers[Background Workers]
        
        API <--> PG
        Workers <--> PG
    end

    subgraph external [External Services]
        IG[Instagram API]
        R2[Cloudflare R2<br/>Media Storage]
        Streams[Streaming Platforms<br/>Kick, Twitch, YouTube]
    end

    UI <-->|HTTP/WebSocket| API
    Rust -->|Record streams| Streams
    API <-->|OAuth & Publish| IG
    API <-->|Upload media| R2
    Workers -->|Sync analytics| IG
```

---

## Key API Routes

### Organization Routes
```
POST   /api/organizations                              Create org
GET    /api/organizations/:id/creator-profiles         List profiles
POST   /api/organizations/:id/creator-profiles         Create profile
GET    /api/organizations/:id/social-accounts          List connected accounts
POST   /api/organizations/:id/posts/publish            Publish to Instagram
GET    /api/organizations/:id/campaigns                List campaigns
POST   /api/organizations/:id/campaigns                Create campaign
```

### Clipper Routes
```
GET    /api/campaigns                                  Browse campaigns
POST   /api/campaigns/:id/apply                        Apply to campaign
GET    /api/user/campaigns                             My campaigns
POST   /api/campaigns/:id/submissions                  Submit clip URL
GET    /api/user/submissions                           My submissions
GET    /api/user/earnings                              My earnings
CRUD   /api/user/social-accounts                       My Instagram accounts
```

### Instagram Auth Routes
```
GET    /api/auth/instagram/start                       Start OAuth flow
GET    /api/auth/instagram/callback                    OAuth callback
POST   /api/auth/instagram/exchange                    Exchange code for token
```

---

## Key Files Reference

| Component | Path |
|-----------|------|
| **Server** | |
| Instagram OAuth | `server/lib/clippster_server_web/controllers/instagram_auth_controller.ex` |
| Instagram API client | `server/lib/clippster_server/social/platforms/instagram.ex` |
| Social accounts | `server/lib/clippster_server/social/social_account.ex` |
| Post submissions | `server/lib/clippster_server/social/post_submission.ex` |
| Organizations | `server/lib/clippster_server/organizations.ex` |
| Creator profiles | `server/lib/clippster_server/organizations/organization_creator_profile.ex` |
| **Client** | |
| Clip editor | `client/src/components/clip-editor/` |
| Export tab | `client/src/components/clip-editor/tabs/ExportTab.vue` |
| Publish dialog | `client/src/components/organization/PublishDialog.vue` |
| Social API service | `client/src/services/socialAccountsApi.ts` |
| Creator profiles DB | `client/src/services/database/creator-profiles.ts` |
| **Rust** | |
| Clip orchestrator | `client/src-tauri/src/clips/orchestrator.rs` |
| Livestream clips | `client/src-tauri/src/clips/livestream_clip.rs` |
| Video processor | `client/src-tauri/src/clips/video_processor.rs` |
| PumpFun recorder | `client/src-tauri/src/pumpfun.rs` |
