# Admin Panel Overhaul: User Profiles, Org Details, Moderators & Customer Service Chat

Comprehensive plan to add admin user profile management, org detail views, a moderator role, admin/mod→user messaging, and a "Customer Service" support chat system across server, client, and landing.

---

## Audit Summary

### Current State
- **User schema** (`user.ex`): Has `is_admin` boolean, no moderator field, no `restricted`/`banned` fields at the user level (restrictions are org-member-scoped)
- **AdminPlug**: Only checks `conn.assigns[:is_admin]` — no moderator awareness
- **Admin routes**: All behind `api_admin` pipeline (AdminPlug)
- **AdminHub.vue**: Static card grid linking to sub-pages. No role-based filtering
- **AdminUsers.vue**: Table with actions dropdown (promote to admin, add credits, subscription management). No user profile detail view, no delete, no discount, no restrict
- **AdminOrganizations.vue**: Table with credits/sub/seat management. No detail view with member/campaign/hiring stats
- **Messaging**: Org-scoped + global-direct conversations. Conversation types: `direct`, `group`, `announcement`. No `support` type. No concept of "customer service" channel
- **Landing messaging** (`OrgMessages.tsx`): Full messaging UI using `useMessaging` hook. Org-scoped only
- **Client messaging** (`Messages.vue`): Full messaging page in Tauri app

### What Needs to Be Built

| Feature | Server | Client (Tauri) | Landing (React) |
|---------|--------|----------------|-----------------|
| Moderator role | ✅ | ✅ | N/A |
| User profile detail (admin) | ✅ | ✅ | N/A |
| Org detail view (admin) | ✅ | ✅ | N/A |
| User delete (end of billing) | ✅ | ✅ | N/A |
| User restrict (platform-level) | ✅ | ✅ | N/A |
| User discount (months) | ✅ | ✅ | N/A |
| Free month for user | ✅ | ✅ | N/A |
| Admin/mod → user messaging | ✅ | ✅ | N/A |
| Admin/mod → org owner messaging | ✅ | ✅ | N/A |
| Customer Service chat (user side) | ✅ | ✅ | ✅ |
| Customer Service chat (admin/mod side) | ✅ | ✅ | N/A |

---

## Phase 1: Moderator Role (Server)

### 1.1 Migration: Add `is_moderator` to users table
- `alter table(:users) do add :is_moderator, :boolean, default: false end`

### 1.2 Update User schema (`accounts/user.ex`)
- Add `field :is_moderator, :boolean, default: false`
- Add `moderator_changeset/2` for promoting/demoting

### 1.3 Update Accounts context (`accounts.ex`)
- `promote_user_to_moderator/1`, `demote_moderator/1`
- `list_admins_and_moderators/0` (for customer service routing)
- Validation: moderator cannot be free tier — check subscription status before promoting

### 1.4 Create ModeratorPlug (`plugs/moderator_plug.ex`)
- Allows access if `is_admin` OR `is_moderator`
- Used for routes that both admins and mods can access

### 1.5 Update AdminPlug
- No change — admin-only routes stay admin-only

### 1.6 Update AuthPlug (`auth_plug.ex`)
- Add `is_moderator` to conn assigns from user record (not JWT claims — read from DB user)

### 1.7 Update JWT token generation
- Add `is_moderator` claim to JWT so client can check role without extra API call

### 1.8 New router pipeline: `api_mod`
- `plug AuthPlug` + `plug ModeratorPlug`
- Routes: org applications, bug reports, analytics, AI usage, customer service messages

### 1.9 Router changes
- **Admin-only** (keep in `api_admin`): Users tab, Orgs tab, promote/demote mod, settings, beta codes, discount codes, waitlist, affiliates, free tier branding, mod action logs
- **Mod+Admin** (new `api_mod`): Org applications, bug reports, analytics, AI usage, customer service messages
- New admin routes:
  - `POST /admin/users/:user_id/moderator` — promote to mod
  - `DELETE /admin/users/:user_id/moderator` — demote mod
  - `POST /admin/users/:user_id/mod-discount` — enable mod discount
  - `DELETE /admin/users/:user_id/mod-discount` — disable mod discount
  - `POST /admin/users/:user_id/restrict` — platform-level restrict
  - `DELETE /admin/users/:user_id/restrict` — unrestrict
  - `POST /admin/users/:user_id/discount` — apply discount
  - `POST /admin/users/:user_id/free-month` — grant free month
  - `DELETE /admin/users/:user_id` — schedule deletion
  - `GET /admin/users/:user_id/profile` — detailed user profile
  - `GET /admin/organizations/:id/details` — detailed org view
  - `GET /admin/mod-logs` — list all moderator actions
  - `GET /admin/mod-logs/:mod_id` — logs for specific moderator

### 1.10 AdminController additions
- `promote_to_moderator/2`, `demote_moderator/2`
- `enable_mod_discount/2`, `disable_mod_discount/2` — toggle 10% mod discount
- `restrict_user/2`, `unrestrict_user/2`
- `apply_user_discount/2` — params: `percent_off`, `months`
- `grant_free_month/2`
- `delete_user/2` — if active Stripe sub, cancel at period end; if no sub, soft-delete immediately
- `get_user_profile/2` — returns full user data: credits purchased/used, subscription history, account age, org memberships
- `get_org_details/2` — returns: member count, creator profile count, seats used/total, additional seats purchased, campaigns ran/completed, hiring posts count, hires made, AI credits purchased/used
- `list_mod_logs/2`, `get_mod_logs_for_user/2` — retrieve moderator action logs

### 1.11 Moderator Action Logging System

**Migration**: Create `mod_action_logs` table
- `id` (primary key)
- `moderator_id` (references users) — who performed the action
- `action_type` (string) — e.g., "approve_org_application", "reject_bug_report", "archive_support_conversation", "respond_to_support"
- `target_type` (string) — e.g., "organization_application", "bug_report", "support_conversation", "user"
- `target_id` (integer) — ID of the target entity
- `details` (jsonb) — action-specific metadata (e.g., rejection reason, response content preview)
- `inserted_at` (timestamp)

**Context**: `server/lib/clippster_server/mod_logs.ex`
- `log_action/4` — creates a log entry (moderator_id, action_type, target_type, target_id, details)
- `list_all_logs/1` — returns all logs with pagination, sorted by timestamp desc
- `list_logs_for_moderator/2` — returns logs for a specific moderator
- `list_logs_for_target/3` — returns logs for a specific target (e.g., all actions on a user)

**Logged Actions**:
- Org application: approve, reject
- Bug report: update status, update severity, delete
- Support conversation: respond, archive
- Customer service: send message, archive conversation
- Analytics: view (optional — may be too noisy)
- AI usage: view (optional)

**Integration Points**:
- Wrap all moderator actions in controllers with `ModLogs.log_action/4` calls
- Example: After approving org application, log `ModLogs.log_action(mod_id, "approve_org_application", "organization_application", app_id, %{organization_name: org.name})`

**Admin UI** (`AdminModLogs.vue`):
- Table view: timestamp, moderator name, action type, target, details
- Filters: moderator, action type, date range
- Search by target ID or moderator name
- Export to CSV

---

## Phase 2: User Restriction (Platform-Level)

### 2.1 Migration: Add platform-level restriction fields to users
- `add :is_restricted, :boolean, default: false`
- `add :restricted_at, :utc_datetime`
- `add :restricted_reason, :string`
- `add :scheduled_deletion_at, :utc_datetime` (for end-of-billing-cycle deletion)

### 2.2 Update User schema
- Add fields, changeset for restrict/unrestrict

### 2.3 Restriction enforcement
- **Decision**: Allow login but block actions. Restricted users see a restriction banner.
- Add middleware check: if `user.is_restricted`, allow read-only endpoints (GET /auth/me, GET /credits/balance) but block all mutation endpoints (POST/PUT/DELETE)
- Client-side: auth store reads `is_restricted`, shows a full-page restriction banner overlay
- Landing: same — check user restriction status on load

---

## Phase 3: Per-User Discount & Free Month (Server)

> **Note**: A promo code system already exists (`promo_codes.ex`, `AdminDiscountCodes.vue`) — admins create codes, users redeem at checkout. What's missing is the ability to **directly apply a discount to a specific user's active Stripe subscription** from the admin user profile (no code needed).

### 3.1 Migration: Add per-user discount tracking
- `add :admin_discount_percent, :integer` (e.g., 20 for 20%)
- `add :admin_discount_months_remaining, :integer`
- `add :admin_discount_applied_at, :utc_datetime`
- `add :admin_discount_stripe_coupon_id, :string` (to track/remove the Stripe coupon)

### 3.2 Stripe integration for per-user discounts
- When admin applies discount from user profile: create a one-off Stripe coupon, apply it to the user's active Stripe subscription via `Stripe.Subscription.update(sub_id, %{coupon: coupon_id})`
- For "free month": same flow but 100% discount for 1 billing cycle
- Track the coupon ID so it can be removed/replaced later
- If user has no active Stripe subscription (crypto/admin-granted), just track in DB and apply credit adjustment

### 3.3 Moderator 10% discount (admin-controlled toggle)
- **Decision**: Discount is NOT automatic on promotion — admin manually enables/disables it
- Add `mod_discount_enabled` boolean field to users table
- Admin action: "Toggle Moderator Discount" button on user profile
  - When enabled: create 10% recurring Stripe coupon, apply to subscription, set `mod_discount_enabled: true`, store coupon ID
  - When disabled: remove coupon via Stripe API, set `mod_discount_enabled: false`
- Tracked separately from admin-applied discounts (use `mod_discount_stripe_coupon_id` field)
- Discount persists even if user is demoted from moderator (admin must manually disable it)

---

## Phase 4: Admin User Profile Detail View (Client)

### 4.1 New page: `AdminUserProfile.vue`
- Route: `/admin/users/:id`
- Sections:
  - **Header**: Avatar, name/email/wallet, role badge (Admin/Mod/User), **subscription tier badge** (Free/Starter/Creator/Pro), account age, last active
  - **Subscription card** (prominent): Current tier, status (active/cancelled/expired/none), billing interval (monthly/yearly), start date, renewal/expiry date, Stripe subscription ID (linked), payment method (stripe/crypto/admin-granted), subscription history table
  - **Credits**: Purchased total, used total, remaining, transaction history
  - **Actions panel**: Add credits, apply discount (% + months), grant free month, change subscription, restrict/unrestrict, delete account, promote/demote mod/admin, toggle mod discount (if moderator)
  - **Organization memberships**: List of orgs user belongs to
  - **Moderator actions log** (if user is/was a moderator): Recent actions performed by this moderator
  - **Message user** button → opens/creates global-direct conversation

### 4.2 Router update (`client/src/router/index.ts`)
- Add `/admin/users/:id` route

### 4.3 Update `AdminUsers.vue`
- Make user rows clickable → navigate to `/admin/users/:id`

---

## Phase 5: Admin Org Detail View (Client)

### 5.1 New page: `AdminOrgDetail.vue`
- Route: `/admin/organizations/:id`
- Sections:
  - **Header**: Org name, logo, description, **subscription tier badge** (None/Solo/Enterprise Base/Enterprise AI/Enterprise Unlimited), created date
  - **Subscription card** (prominent): Current tier, status (active/cancelled/expired/none), billing interval, price/mo, seats used/total, additional seats purchased, start date, renewal/expiry date, Stripe subscription ID, admin-set price if applicable
  - **Members**: Count, list with roles
  - **Creator Profiles**: Count, list
  - **Campaigns**: Total ran, completed, active
  - **Hiring**: Posts count, hires made
  - **AI Credits**: Purchased, used, remaining
  - **Actions**: Edit sub, add credits, message org owner

### 5.2 Server endpoint: `GET /admin/organizations/:id/details`
- Aggregates: member count, creator profile count, seats used/max, campaigns (by status), hiring posts + accepted applications count, credit balance

### 5.3 Router update
- Add `/admin/organizations/:id` route

### 5.4 Update `AdminOrganizations.vue`
- Make org rows clickable → navigate to `/admin/organizations/:id`

---

## Phase 6: Admin Hub Role-Based Filtering (Client)

### 6.1 Update `AdminHub.vue`
- Show role badge: Admin or Moderator
- Filter tool cards based on role:
  - **Admin**: All cards visible
  - **Moderator**: Only Org Applications, Bug Reports, AI Usage, Analytics, Customer Service Messages
  - Hide Users, Organizations, Beta Codes, Discount Codes, Waitlist, Settings, Affiliates for mods

### 6.2 Update router guards
- Admin routes: check `is_admin`
- Mod routes: check `is_admin || is_moderator`

### 6.3 Update `auth.d.ts` / auth store
- Add `is_moderator` to `AuthUser` interface
- Update `auth.js` store to read `is_moderator` from JWT/user data

---

## Phase 7: Customer Service Chat System (Server)

This is the most complex feature. Architecture:

### 7.1 New conversation type: `"support"`
- Update `@conversation_types` in `conversation.ex` to include `"support"`
- Support conversations are **not** org-scoped (`organization_id: nil`)
- Each user gets at most ONE active support conversation
- Support conversations have a special `status` field: `open`, `archived`

### 7.2 Migration: Add support fields to conversations
- `add :status, :string, default: "open"` (for support conversations)
- `add :archived_at, :utc_datetime`
- `add :archived_by_user_id, references(:users)`

### 7.3 Messaging context additions (`messaging.ex`)
- `create_support_conversation/1` — creates support conv for user, adds user + all current admins/mods as participants
- `get_or_create_support_conversation/1` — returns existing open support conv or creates new one
- `archive_support_conversation/2` — admin/mod archives (sets status=archived, archived_at)
- `reopen_support_conversation/1` — when user sends new message to archived conv, reopen it
- `list_support_conversations/1` — for admin/mod: list all support convs, sorted by unread-first then last_message_at
- `send_support_message/3` — same as send_message but with auto-reopen logic
- `get_support_auto_message/0` — returns the automated welcome message text

### 7.4 Auto-message on creation
- **Decision**: System message with no sender (sender_id: null, message_type: "system")
- When user creates support conversation, system sends automated message:
  - sender_id: nil
  - content: "Thanks for reaching out! This is an automated message. A member of our team will get back to you within 24 hours."
  - `message_type: "system"`
  - Rendered in UI: centered, gray background, no avatar — clearly distinguishable from human messages

### 7.5 Migration: Add `message_type` values
- Already has `message_type` field on Message schema — just need to support `"system"` type

### 7.6 Participant management for support convs
- On creation: add user + all users where `is_admin = true OR is_moderator = true`
- When new admin/mod is promoted: add them to ALL open support conversations
- When admin/mod is demoted: remove them from support conversations (optional — could leave them)

### 7.7 New routes
- **Authenticated (any user)**:
  - `GET /api/support/conversation` — get or create user's support conversation
  - `POST /api/support/conversation/messages` — send message to support
  - `GET /api/support/conversation/messages` — get messages
- **Mod+Admin**:
  - `GET /api/admin/support/conversations` — list all support conversations (with unread counts)
  - `GET /api/admin/support/conversations/:id/messages` — get messages for a support conv
  - `POST /api/admin/support/conversations/:id/messages` — respond to support conv
  - `POST /api/admin/support/conversations/:id/archive` — archive conversation
  - `POST /api/admin/support/conversations/:id/read` — mark as read

### 7.8 New controller: `SupportController`
- Handles all support-specific endpoints
- Validates that only the user who owns the support conv (or admins/mods) can access it

### 7.9 Security considerations
- Users can ONLY see their own support conversation
- Admins/mods can see ALL support conversations
- Support conversations are NOT visible in regular messaging lists (filtered out)
- Regular messaging endpoints filter out `type: "support"` conversations
- Support messages go through same WebSocket channels for real-time delivery

---

## Phase 8: Customer Service Chat (Client — Tauri App)

### 8.1 Pinned "Customer Service" entry in Messages.vue
- Always pinned at top of conversation list
- Special icon (Headset or LifeBuoy)
- Shows unread badge
- On click: loads/creates support conversation via `GET /api/support/conversation`
- First message triggers auto-response

### 8.2 Admin/Mod: Customer Service inbox
- New page: `AdminCustomerService.vue` (route: `/admin/customer-service`)
- Left panel: list of support conversations, sorted by unread-first
  - Each entry shows: user name/email, last message preview, time, unread badge
  - Filter tabs: Open | Archived
- Right panel: message thread
  - Send message, mark as read
  - "Archive" button to close resolved tickets
- Add to AdminHub tool grid (visible to both admins and mods)

### 8.3 Update AdminHub
- Add "Customer Service" card to Content & Reports section

---

## Phase 9: Customer Service Chat (Landing — React App)

### 9.1 Update `OrgMessages.tsx` or create separate support entry
- Since landing messaging is org-scoped, support chat needs to work outside org context
- Add a pinned "Customer Service" entry at the top of the conversation list in `OrgMessages.tsx`
- OR: Add a floating support chat button in `DashboardLayout.tsx` that opens a slide-out panel

### 9.2 New hook: `useSupport.ts`
- `getOrCreateSupportConversation()`
- `sendSupportMessage(content)`
- `getSupportMessages()`
- Uses same REST endpoints as client

### 9.3 New API functions in landing `messagingApi.ts`
- `getOrCreateSupportConversation()`
- `sendSupportMessage(content)`
- `getSupportMessages()`

### 9.4 UI: Pinned support chat in sidebar or messages page
- Always visible, always at top
- Same auto-message behavior

---

## Phase 10: Admin/Mod → User/Org Messaging

### 10.1 "Message User" button on AdminUserProfile.vue
- Creates global-direct conversation between admin/mod and the user
- Uses existing `POST /api/messaging/conversations/global-direct` endpoint
- Navigates to Messages page with that conversation active

### 10.2 "Message Org Owner" button on AdminOrgDetail.vue
- Looks up org owner_id
- Creates global-direct conversation with org owner
- Same flow as above

### 10.3 Landing dashboard: ensure global-direct conversations show up
- `useMessaging` already calls `GET /api/me/conversations` which returns all conversations including global-direct
- Verify this works correctly — global-direct convs (org_id: null) should appear in the landing messaging UI

---

## Phase 11: Admin/Mod Internal Messaging

> Admins and moderators need a private communication channel separate from customer service and user messaging.

### 11.1 New conversation type: `"staff"`
- Update `@conversation_types` in `conversation.ex` to include `"staff"`
- Staff conversations are NOT org-scoped (`organization_id: nil`)
- Only admins and moderators can participate
- Multiple staff conversations allowed (group chats, direct between staff members)

### 11.2 Server endpoints
- **New routes** (mod+admin access via `api_mod` pipeline):
  - `GET /api/staff/conversations` — list all staff conversations
  - `POST /api/staff/conversations/direct` — create direct conversation between two staff members
  - `POST /api/staff/conversations/group` — create group conversation (all staff or subset)
  - `GET /api/staff/conversations/:id/messages` — get messages
  - `POST /api/staff/conversations/:id/messages` — send message
  - Uses existing messaging endpoints but filtered to staff-only participants

### 11.3 Messaging context additions (`messaging.ex`)
- `create_staff_direct_conversation/2` — creates direct conv between two staff members
- `create_staff_group_conversation/3` — creates group conv with name + staff member IDs
- `list_staff_conversations/1` — returns all staff conversations for a staff member
- Validation: ensure all participants have `is_admin = true OR is_moderator = true`

### 11.4 Client UI (Tauri app)
- **New page**: `AdminStaffMessages.vue` (route: `/admin/staff-messages`)
  - Left panel: list of staff conversations (direct + group)
  - Right panel: message thread
  - "New Conversation" button → modal to select staff members (admins + mods)
  - Shows online status indicators for staff members
- Add to AdminHub tool grid (visible to both admins and mods)
- Add to main sidebar navigation (icon: Users with shield badge)

### 11.5 Security enforcement
- Staff conversations filtered OUT of regular `list_conversations` / `list_all_conversations`
- Regular messaging endpoints filter out `type: "staff"` conversations
- Only staff members (admin OR moderator) can access staff conversations
- Validation in `MessagingController`: check `conn.assigns[:is_admin] || conn.assigns[:is_moderator]`
- When user is demoted from admin/mod: remove from all staff conversations

### 11.6 WebSocket channels
- Staff conversations use same WebSocket infrastructure
- Channel name: `messaging:staff:conversation:{id}`
- Only staff members can join staff conversation channels

---

## Implementation Order (Recommended)

1. **Phase 1** — Moderator role (server migration + schema + plugs + routes) — Foundation for everything
2. **Phase 2** — User restriction (migration + enforcement)
3. **Phase 3** — Discount/free month (migration + Stripe integration)
4. **Phase 6** — Auth store + AdminHub role filtering (client)
5. **Phase 4** — Admin User Profile detail view (client + server endpoint)
6. **Phase 5** — Admin Org Detail view (client + server endpoint)
7. **Phase 7** — Customer Service chat system (server — biggest piece)
8. **Phase 8** — Customer Service chat (client/Tauri)
9. **Phase 9** — Customer Service chat (landing/React)
10. **Phase 10** — Admin/mod → user messaging (mostly wiring existing endpoints)
11. **Phase 11** — Admin/mod internal messaging (staff conversations)

---

## Files to Create

| File | Description |
|------|-------------|
| `server/priv/repo/migrations/*_add_moderator_and_restrictions.exs` | Migration for moderator, restriction, discount, support fields |
| `server/priv/repo/migrations/*_add_mod_action_logs.exs` | Migration for moderator action logging table |
| `server/lib/clippster_server_web/plugs/moderator_plug.ex` | Plug allowing admin OR moderator |
| `server/lib/clippster_server_web/controllers/support_controller.ex` | Customer service endpoints |
| `server/lib/clippster_server/mod_logs.ex` | Context for moderator action logging |
| `server/lib/clippster_server/mod_logs/mod_action_log.ex` | Schema for mod action logs |
| `client/src/pages/admin/AdminUserProfile.vue` | User detail view |
| `client/src/pages/admin/AdminOrgDetail.vue` | Org detail view |
| `client/src/pages/admin/AdminCustomerService.vue` | Customer service inbox |
| `client/src/pages/admin/AdminStaffMessages.vue` | Staff internal messaging |
| `client/src/pages/admin/AdminModLogs.vue` | Moderator action logs viewer |
| `landing/src/hooks/useSupport.ts` | Support chat hook |

## Files to Modify

| File | Changes |
|------|---------|
| `server/lib/clippster_server/accounts/user.ex` | Add `is_moderator`, `is_restricted`, `restricted_at`, `restricted_reason`, `scheduled_deletion_at`, discount fields |
| `server/lib/clippster_server/accounts.ex` | Moderator promote/demote, list admins+mods, restrict/unrestrict |
| `server/lib/clippster_server/messaging.ex` | Support conversation CRUD, archive, reopen, auto-message; staff conversation CRUD |
| `server/lib/clippster_server/messaging/conversation.ex` | Add `"support"` and `"staff"` types, `status`, `archived_at`, `archived_by_user_id` fields |
| `server/lib/clippster_server_web/router.ex` | New `api_mod` pipeline, new routes for support + admin actions + staff messaging + mod logs |
| `server/lib/clippster_server_web/controllers/admin_controller.ex` | New actions: moderator, restrict, discount, free month, delete, user profile, org details |
| `server/lib/clippster_server_web/plugs/auth_plug.ex` | Add `is_moderator` to assigns, check `is_restricted` |
| `client/src/stores/auth.d.ts` | Add `is_moderator` to AuthUser |
| `client/src/stores/auth.js` | Read `is_moderator` from user data |
| `client/src/router/index.ts` | New admin routes, role-based guards |
| `client/src/pages/admin/AdminHub.vue` | Role-based card filtering, add Customer Service card, add Staff Messages card, add Mod Logs card (admin-only) |
| `client/src/pages/admin/AdminUsers.vue` | Clickable rows, moderator badge, remove mod action |
| `client/src/pages/admin/AdminOrganizations.vue` | Clickable rows |
| `client/src/pages/Messages.vue` | Pinned Customer Service entry at top |
| `landing/src/pages/dashboard/OrgMessages.tsx` | Pinned Customer Service entry at top |
| `landing/src/components/dashboard/DashboardSidebar.tsx` | Support chat indicator/badge |
| `landing/src/hooks/useMessaging.ts` | Filter out support convs from regular list |
| `landing/src/services/messagingApi.ts` | Add support API functions |

---

## Security Checklist

- [ ] Users can ONLY see their own support conversation (server-side enforcement)
- [ ] Support conversations filtered OUT of regular `list_conversations` / `list_all_conversations`
- [ ] Staff conversations filtered OUT of regular `list_conversations` / `list_all_conversations`
- [ ] Only staff members (admin OR moderator) can access staff conversations
- [ ] Moderators cannot access Users tab, Orgs tab, Settings, Beta Codes, Discount Codes, Waitlist, Affiliates, Mod Logs
- [ ] Moderators cannot promote/demote other users
- [ ] Moderators cannot enable/disable mod discount for themselves or others
- [ ] Moderators cannot be free-tier accounts (enforce on promotion)
- [ ] Platform-level restriction blocks user from all actions (not just org-scoped)
- [ ] User deletion respects Stripe billing cycle (cancel at period end)
- [ ] Discount application goes through Stripe API (not just DB flag)
- [ ] Auto-message on support conversation creation is clearly marked as automated
- [ ] Archived support conversations reopen when user sends new message
- [ ] New admins/mods are added to all open support conversations
- [ ] Global-direct conversations between admin/mod and users are private (not visible to other admins/mods)
- [ ] All moderator actions are logged with timestamp, action type, target user/org, and details
- [ ] Admins can view all mod logs; moderators cannot view logs
- [ ] When user is demoted from admin/mod: remove from all staff conversations and support conversations
