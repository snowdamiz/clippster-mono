# Organization Clip Distribution & Chat System Implementation Plan

This document outlines the implementation plan for two new features:
1. **Organization Clip Distribution** - Orgs can send short videos to all their clippers with mandatory branding
2. **Organization Chat System** - 1-on-1 and group messaging between orgs and clippers

---

## Feature 1: Organization Clip Distribution

### Overview

Organizations can upload a short video (up to ~5 minutes) that gets distributed to all their clippers. The video includes org-defined watermarks, intro/outro for all aspect ratios. Clippers can edit, trim, or export as-is, but **branding is mandatory** if the org configured it.

### Key Requirements

- **Branding**: Mandatory if org sets it (watermark, intro, outro per aspect ratio)
- **Expiration**: Fixed 5 days, then auto-deleted from server
- **Local Persistence**: If clipper downloads before expiration, it stays local until they delete it
- **Video Limits**: Up to ~5 minutes / 500MB

---

### Database Schema (Server - Elixir/Ecto)

#### Table: `organization_distributed_clips`

```elixir
schema "organization_distributed_clips" do
  field :title, :string
  field :description, :string
  field :video_url, :string              # R2 URL for the source video
  field :thumbnail_url, :string
  field :duration, :decimal              # seconds (max ~300 for 5 min)
  field :file_size, :integer             # bytes (max ~500MB)
  field :status, :string, default: "active"  # "active", "expired", "deleted"
  field :expires_at, :utc_datetime       # Auto-set to 5 days from creation
  
  # Branding config per aspect ratio (JSON)
  # Structure:
  # {
  #   "16:9": { 
  #     "watermark_id": "uuid", 
  #     "watermark_settings": { position, opacity, scale, etc },
  #     "intro_id": "uuid",
  #     "outro_id": "uuid"
  #   },
  #   "9:16": { ... },
  #   "1:1": { ... }
  # }
  field :branding_config, :map, default: %{}
  
  # If true, branding MUST be applied on export (cannot be disabled by clipper)
  field :branding_required, :boolean, default: true
  
  belongs_to :organization, Organization
  belongs_to :uploaded_by, User, foreign_key: :uploaded_by_user_id
  
  has_many :access_records, OrganizationDistributedClipAccess
  
  timestamps(type: :utc_datetime)
end
```

**Constraints:**
- `duration` max 300 seconds (5 minutes)
- `file_size` max 524,288,000 bytes (500MB)
- `expires_at` auto-set to `inserted_at + 5 days`

#### Table: `organization_distributed_clip_access`

Tracks which members have accessed/downloaded the clip.

```elixir
schema "organization_distributed_clip_access" do
  field :accessed_at, :utc_datetime      # When they first viewed it
  field :downloaded_at, :utc_datetime    # When they pulled it to their client
  field :status, :string, default: "pending"  # "pending", "downloaded", "exported"
  
  belongs_to :distributed_clip, OrganizationDistributedClip
  belongs_to :user, User
  
  timestamps(type: :utc_datetime)
end
```

**Unique constraint:** `[:distributed_clip_id, :user_id]`

---

### Migration

```elixir
# priv/repo/migrations/XXXXXX_create_organization_distributed_clips.exs

defmodule ClippsterServer.Repo.Migrations.CreateOrganizationDistributedClips do
  use Ecto.Migration

  def change do
    create table(:organization_distributed_clips) do
      add :title, :string, null: false
      add :description, :text
      add :video_url, :string, null: false
      add :thumbnail_url, :string
      add :duration, :decimal
      add :file_size, :bigint
      add :status, :string, default: "active", null: false
      add :expires_at, :utc_datetime, null: false
      add :branding_config, :map, default: %{}
      add :branding_required, :boolean, default: true, null: false
      
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :uploaded_by_user_id, references(:users, on_delete: :nilify_all)
      
      timestamps(type: :utc_datetime)
    end

    create index(:organization_distributed_clips, [:organization_id])
    create index(:organization_distributed_clips, [:status])
    create index(:organization_distributed_clips, [:expires_at])

    create table(:organization_distributed_clip_access) do
      add :accessed_at, :utc_datetime
      add :downloaded_at, :utc_datetime
      add :status, :string, default: "pending", null: false
      
      add :distributed_clip_id, references(:organization_distributed_clips, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      
      timestamps(type: :utc_datetime)
    end

    create unique_index(:organization_distributed_clip_access, [:distributed_clip_id, :user_id])
    create index(:organization_distributed_clip_access, [:user_id])
  end
end
```

---

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/organizations/:org_id/distributed-clips` | Admin | Upload new distributed clip |
| `GET` | `/api/organizations/:org_id/distributed-clips` | Member | List active distributed clips for org |
| `GET` | `/api/organizations/:org_id/distributed-clips/:id` | Member | Get clip details with presigned video URL |
| `DELETE` | `/api/organizations/:org_id/distributed-clips/:id` | Admin | Delete clip early |
| `PUT` | `/api/organizations/:org_id/distributed-clips/:id/branding` | Admin | Update branding config |
| `POST` | `/api/organizations/:org_id/distributed-clips/:id/download` | Member | Mark as downloaded, get presigned URL |
| `GET` | `/api/me/distributed-clips` | User | Get all distributed clips across all orgs user belongs to |
| `GET` | `/api/organizations/:org_id/distributed-clips/:id/access` | Admin | View who has accessed/downloaded |

---

### Context Module: `ClippsterServer.DistributedClips`

Location: `server/lib/clippster_server/distributed_clips.ex`

```elixir
defmodule ClippsterServer.DistributedClips do
  @moduledoc """
  Context for organization distributed clips - videos sent to all org members.
  """
  
  @expiration_days 5
  @max_duration_seconds 300
  @max_file_size_bytes 524_288_000
  
  # CRUD
  def create_distributed_clip(organization_id, user_id, attrs)
  def get_distributed_clip(id)
  def get_distributed_clip_for_org(organization_id, clip_id)
  def list_active_clips_for_org(organization_id)
  def list_clips_for_user(user_id)  # Across all orgs user belongs to
  def update_branding_config(clip_id, branding_config, user)
  def delete_distributed_clip(clip_id, user)
  
  # Access tracking
  def mark_accessed(clip_id, user_id)
  def mark_downloaded(clip_id, user_id)
  def get_access_stats(clip_id)
  
  # Expiration
  def expire_old_clips()  # Called by Oban job
  def cleanup_expired_clips()  # Delete R2 files
end
```

---

### Background Job: Expiration Cleanup

```elixir
# lib/clippster_server/workers/distributed_clip_expiration_worker.ex

defmodule ClippsterServer.Workers.DistributedClipExpirationWorker do
  use Oban.Worker, queue: :default, max_attempts: 3

  @impl Oban.Worker
  def perform(_job) do
    # 1. Find clips where expires_at < now() and status = "active"
    # 2. Update status to "expired"
    # 3. Delete video and thumbnail from R2
    # 4. Optionally: delete access records (or keep for analytics)
    
    ClippsterServer.DistributedClips.expire_old_clips()
    ClippsterServer.DistributedClips.cleanup_expired_clips()
    
    :ok
  end
end

# Schedule in config/config.exs:
# config :clippster_server, Oban,
#   plugins: [
#     {Oban.Plugins.Cron, crontab: [
#       {"0 * * * *", ClippsterServer.Workers.DistributedClipExpirationWorker}  # Every hour
#     ]}
#   ]
```

---

### Client-Side Database (SQLite)

```sql
-- Track distributed clips synced from server
CREATE TABLE IF NOT EXISTS distributed_clips (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  organization_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,                    -- Presigned URL (refreshed on access)
  local_video_path TEXT,             -- Path after download (persists locally)
  thumbnail_url TEXT,
  local_thumbnail_path TEXT,
  duration REAL,
  file_size INTEGER,
  branding_config TEXT,              -- JSON with per-aspect-ratio settings
  branding_required INTEGER DEFAULT 1,  -- 1 = mandatory
  expires_at INTEGER,                -- Server expiration (for display)
  server_status TEXT,                -- "active", "expired" from server
  local_status TEXT DEFAULT 'pending',  -- "pending", "downloaded", "exported"
  synced_at INTEGER,                 -- Last sync with server
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX idx_distributed_clips_org ON distributed_clips(organization_id);
CREATE INDEX idx_distributed_clips_status ON distributed_clips(local_status);
```

---

### Client-Side Flow

1. **Sync on App Start / Periodic**:
   - Call `GET /api/me/distributed-clips`
   - Update local `distributed_clips` table
   - Show notification for new clips

2. **Inbox View**:
   - List all distributed clips grouped by org
   - Show expiration countdown
   - Badge for undownloaded clips

3. **Preview**:
   - Stream video directly from presigned URL
   - Show branding preview overlay

4. **Download**:
   - Call `POST /api/.../download` to get fresh presigned URL
   - Download video to local storage (`app_data/distributed_clips/{org_id}/{clip_id}/`)
   - Download associated assets (watermarks, intros, outros) if not cached
   - Update `local_video_path` and `local_status`

5. **Create Project from Distributed Clip**:
   - Create new project with video as source
   - Pre-configure branding from `branding_config`
   - Lock branding settings if `branding_required = true`

6. **Export**:
   - If `branding_required`, automatically apply watermark/intro/outro based on selected aspect ratio
   - Clipper cannot disable org branding

---

### Branding Integration with Clip Builder

When building a clip from a distributed clip source:

```typescript
// In clip build orchestrator
interface DistributedClipBranding {
  aspectRatio: string;  // "16:9", "9:16", "1:1"
  watermarkId?: string;
  watermarkSettings?: WatermarkSettings;
  introId?: string;
  outroId?: string;
}

// Before build, resolve branding for selected aspect ratio
function getDistributedClipBranding(
  brandingConfig: Record<string, DistributedClipBranding>,
  aspectRatio: string
): DistributedClipBranding | null {
  return brandingConfig[aspectRatio] || null;
}

// In build pipeline, merge org branding with any user customizations
// Org branding takes precedence if branding_required = true
```

---

## Feature 2: Organization Chat System

### Overview

1-on-1 and group chats between org admins and their clippers. Text-only for v1. No user-to-user messaging.

### Key Requirements

- **Text only** (no attachments in v1)
- **Group chat limit**: Number of org members (no artificial limit)
- **Notifications**: Toast notifications (can be hidden in settings), unread count always visible in messenger (Telegram-style)
- **Future**: Campaign-specific messaging (admins ↔ campaign applicants) - not implementing now but schema should support it

---

### Database Schema (Server)

#### Table: `chat_conversations`

```elixir
schema "chat_conversations" do
  field :type, :string                   # "direct", "group"
  field :name, :string                   # For group chats (null for direct)
  field :last_message_at, :utc_datetime
  field :last_message_preview, :string   # First ~100 chars of last message
  
  # All chats are org-scoped
  belongs_to :organization, Organization
  
  # Future: link to campaign for campaign-specific chats
  # belongs_to :campaign, Campaign  # nullable, for future campaign messaging
  
  has_many :participants, ChatParticipant
  has_many :messages, ChatMessage
  
  timestamps(type: :utc_datetime)
end
```

#### Table: `chat_participants`

```elixir
schema "chat_participants" do
  field :role, :string, default: "member"  # "admin", "member"
  field :last_read_at, :utc_datetime       # For unread count calculation
  field :muted, :boolean, default: false   # Mute toast notifications
  field :left_at, :utc_datetime            # Soft delete for leaving groups
  
  belongs_to :conversation, ChatConversation
  belongs_to :user, User
  
  timestamps(type: :utc_datetime)
end
```

**Unique constraint:** `[:conversation_id, :user_id]`

#### Table: `chat_messages`

```elixir
schema "chat_messages" do
  field :content, :string, null: false
  field :message_type, :string, default: "text"  # "text", "system"
  field :edited_at, :utc_datetime
  field :deleted_at, :utc_datetime         # Soft delete
  
  belongs_to :conversation, ChatConversation
  belongs_to :sender, User
  
  timestamps(type: :utc_datetime)
end
```

---

### Migration

```elixir
# priv/repo/migrations/XXXXXX_create_chat_tables.exs

defmodule ClippsterServer.Repo.Migrations.CreateChatTables do
  use Ecto.Migration

  def change do
    create table(:chat_conversations) do
      add :type, :string, null: false  # "direct", "group"
      add :name, :string               # For group chats
      add :last_message_at, :utc_datetime
      add :last_message_preview, :string
      
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      # Future: add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all)
      
      timestamps(type: :utc_datetime)
    end

    create index(:chat_conversations, [:organization_id])
    create index(:chat_conversations, [:last_message_at])

    create table(:chat_participants) do
      add :role, :string, default: "member", null: false
      add :last_read_at, :utc_datetime
      add :muted, :boolean, default: false, null: false
      add :left_at, :utc_datetime
      
      add :conversation_id, references(:chat_conversations, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      
      timestamps(type: :utc_datetime)
    end

    create unique_index(:chat_participants, [:conversation_id, :user_id])
    create index(:chat_participants, [:user_id])

    create table(:chat_messages) do
      add :content, :text, null: false
      add :message_type, :string, default: "text", null: false
      add :edited_at, :utc_datetime
      add :deleted_at, :utc_datetime
      
      add :conversation_id, references(:chat_conversations, on_delete: :delete_all), null: false
      add :sender_id, references(:users, on_delete: :nilify_all)
      
      timestamps(type: :utc_datetime)
    end

    create index(:chat_messages, [:conversation_id, :inserted_at])
    create index(:chat_messages, [:sender_id])
  end
end
```

---

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/organizations/:org_id/conversations` | Member | List conversations in org |
| `POST` | `/api/organizations/:org_id/conversations` | Admin | Create conversation (direct or group) |
| `GET` | `/api/conversations/:id` | Participant | Get conversation with recent messages |
| `GET` | `/api/conversations/:id/messages` | Participant | Paginated message history |
| `POST` | `/api/conversations/:id/messages` | Participant | Send message |
| `PUT` | `/api/conversations/:id/messages/:msg_id` | Sender | Edit own message |
| `DELETE` | `/api/conversations/:id/messages/:msg_id` | Sender/Admin | Delete message |
| `POST` | `/api/conversations/:id/read` | Participant | Mark conversation as read |
| `PUT` | `/api/conversations/:id/mute` | Participant | Toggle mute for toast notifications |
| `POST` | `/api/conversations/:id/participants` | Admin | Add participant to group |
| `DELETE` | `/api/conversations/:id/participants/:user_id` | Admin | Remove participant |
| `POST` | `/api/conversations/:id/leave` | Participant | Leave group chat |
| `GET` | `/api/me/conversations` | User | All conversations across orgs |
| `GET` | `/api/me/unread-count` | User | Total unread message count |

---

### Context Module: `ClippsterServer.Chat`

Location: `server/lib/clippster_server/chat.ex`

```elixir
defmodule ClippsterServer.Chat do
  @moduledoc """
  Context for organization chat system.
  """
  
  # Conversations
  def create_direct_conversation(organization_id, user1_id, user2_id)
  def create_group_conversation(organization_id, name, creator_id, member_ids)
  def get_conversation(id)
  def list_conversations_for_user(user_id)
  def list_conversations_for_org(organization_id, user_id)
  
  # Messages
  def send_message(conversation_id, sender_id, content)
  def edit_message(message_id, user_id, new_content)
  def delete_message(message_id, user_id)
  def list_messages(conversation_id, opts \\ [])  # pagination
  
  # Read status
  def mark_as_read(conversation_id, user_id)
  def get_unread_count(user_id)
  def get_unread_count_for_conversation(conversation_id, user_id)
  
  # Participants
  def add_participant(conversation_id, user_id, adder_id)
  def remove_participant(conversation_id, user_id, remover_id)
  def leave_conversation(conversation_id, user_id)
  def toggle_mute(conversation_id, user_id)
  
  # Access control
  def can_message?(organization_id, from_user_id, to_user_id)
  def is_participant?(conversation_id, user_id)
end
```

---

### Access Control Rules

```elixir
# Members can only initiate conversations with admins
def can_initiate_conversation?(organization_id, user_id) do
  # Admins can initiate with anyone in org
  # Members can only initiate with admins
  member = Organizations.get_member(organization_id, user_id)
  
  case member.role do
    role when role in ["owner", "admin"] -> true
    "member" -> :only_with_admins
    _ -> false
  end
end

# For direct messages
def can_message_user?(organization_id, from_user_id, to_user_id) do
  from_member = Organizations.get_member(organization_id, from_user_id)
  to_member = Organizations.get_member(organization_id, to_user_id)
  
  cond do
    # Admins can message anyone
    from_member.role in ["owner", "admin"] -> true
    # Members can only message admins
    from_member.role == "member" and to_member.role in ["owner", "admin"] -> true
    # Members cannot message other members
    true -> false
  end
end
```

---

### Real-time: Phoenix Channels

```elixir
# lib/clippster_server_web/channels/chat_channel.ex

defmodule ClippsterServerWeb.ChatChannel do
  use ClippsterServerWeb, :channel
  
  alias ClippsterServer.Chat
  
  # Join user's personal channel for notifications
  def join("chat:user:" <> user_id, _params, socket) do
    if socket.assigns.user_id == user_id do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end
  
  # Join specific conversation
  def join("chat:conversation:" <> conversation_id, _params, socket) do
    if Chat.is_participant?(conversation_id, socket.assigns.user_id) do
      {:ok, socket}
    else
      {:error, %{reason: "not_a_participant"}}
    end
  end
  
  # Handle new message
  def handle_in("new_message", %{"content" => content}, socket) do
    conversation_id = socket.assigns.conversation_id
    user_id = socket.assigns.user_id
    
    case Chat.send_message(conversation_id, user_id, content) do
      {:ok, message} ->
        broadcast!(socket, "new_message", serialize_message(message))
        {:reply, :ok, socket}
      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end
  
  # Typing indicator
  def handle_in("typing", _payload, socket) do
    broadcast_from!(socket, "user_typing", %{
      user_id: socket.assigns.user_id
    })
    {:noreply, socket}
  end
  
  # Mark as read
  def handle_in("mark_read", _payload, socket) do
    Chat.mark_as_read(socket.assigns.conversation_id, socket.assigns.user_id)
    {:noreply, socket}
  end
end
```

---

### Client-Side Implementation

#### WebSocket Connection

```typescript
// services/chatSocket.ts
import { Socket, Channel } from 'phoenix';

class ChatSocket {
  private socket: Socket | null = null;
  private userChannel: Channel | null = null;
  private conversationChannels: Map<string, Channel> = new Map();
  
  connect(token: string, userId: string) {
    this.socket = new Socket('/socket', { params: { token } });
    this.socket.connect();
    
    // Join user's notification channel
    this.userChannel = this.socket.channel(`chat:user:${userId}`);
    this.userChannel.join();
    
    // Listen for new message notifications
    this.userChannel.on('new_message_notification', (payload) => {
      // Update unread count, show toast if not muted
    });
  }
  
  joinConversation(conversationId: string) {
    if (!this.socket) return;
    
    const channel = this.socket.channel(`chat:conversation:${conversationId}`);
    channel.join();
    
    channel.on('new_message', (message) => {
      // Add message to conversation
    });
    
    channel.on('user_typing', ({ user_id }) => {
      // Show typing indicator
    });
    
    this.conversationChannels.set(conversationId, channel);
  }
  
  sendMessage(conversationId: string, content: string) {
    const channel = this.conversationChannels.get(conversationId);
    if (channel) {
      channel.push('new_message', { content });
    }
  }
  
  sendTyping(conversationId: string) {
    const channel = this.conversationChannels.get(conversationId);
    if (channel) {
      channel.push('typing', {});
    }
  }
}

export const chatSocket = new ChatSocket();
```

#### User Settings for Notifications

```typescript
// In user preferences/settings
interface ChatNotificationSettings {
  showToastNotifications: boolean;  // Can be disabled
  // Unread count in messenger is always shown regardless
}
```

#### UI Components

- `ChatSidebar.vue` - Conversation list with unread badges
- `ChatConversation.vue` - Message thread view
- `ChatMessage.vue` - Individual message bubble
- `ChatInput.vue` - Message input with typing indicator
- `ChatHeader.vue` - Conversation name, participants, mute toggle

---

## Implementation Phases

### Phase 1: Distributed Clips Backend (Server)
1. Create migration for `organization_distributed_clips` tables
2. Create schemas: `OrganizationDistributedClip`, `OrganizationDistributedClipAccess`
3. Create context: `ClippsterServer.DistributedClips`
4. Create controller: `DistributedClipController`
5. Add routes to router
6. Create Oban worker for expiration cleanup
7. Add R2 upload/delete functions for distributed clips

### Phase 2: Distributed Clips Frontend (Client)
1. Create SQLite migration for `distributed_clips` table
2. Create `distributedClipsService.ts` for API calls
3. Create `useDistributedClips.ts` composable
4. Create `DistributedClipsInbox.vue` page/component
5. Create `DistributedClipPreview.vue` component
6. Integrate download flow with local storage
7. Integrate branding into clip builder (mandatory branding logic)

### Phase 3: Chat Backend (Server)
1. Create migration for chat tables
2. Create schemas: `ChatConversation`, `ChatParticipant`, `ChatMessage`
3. Create context: `ClippsterServer.Chat`
4. Create controller: `ChatController`
5. Add routes to router
6. Create Phoenix channel: `ChatChannel`
7. Add to user socket

### Phase 4: Chat Frontend (Client)
1. Create `chatService.ts` for REST API calls
2. Create `chatSocket.ts` for WebSocket connection
3. Create `useChat.ts` composable
4. Create chat UI components (sidebar, conversation, messages)
5. Add chat icon with unread badge to main navigation
6. Add notification settings to user preferences
7. Integrate toast notifications (respecting user preference)

---

## Future Considerations

### Campaign Messaging (After Campaigns Implementation)
- Add `campaign_id` foreign key to `chat_conversations`
- Allow campaign applicants to message designated campaign admins
- Campaign-specific group chats for approved participants

### Attachments (v2)
- Add `attachment_url`, `attachment_metadata` fields to `chat_messages`
- Support image uploads to R2
- File sharing with presigned URLs

### Message Search
- Full-text search on message content
- Search within conversation or across all conversations

---

## Summary

| Feature | Backend | Frontend | Real-time |
|---------|---------|----------|-----------|
| Distributed Clips | Elixir context + controller + Oban job | Vue components + SQLite | - |
| Chat System | Elixir context + controller + Phoenix channel | Vue components + WebSocket | Phoenix Channels |

Both features leverage existing infrastructure:
- **R2 Storage** for video/asset storage
- **Organizations** for membership and access control
- **Presigned URLs** for secure file access
