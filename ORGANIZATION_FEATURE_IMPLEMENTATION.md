# Organization-Level Creator Profile Management - Complete Implementation Guide

## Document Purpose
This document contains the complete design, database schema, API specifications, frontend components, and implementation steps for adding organization-level creator profile management to Clippster. Organizations can manage creator profiles and assign them to users, providing standardized presets while maintaining full user autonomy.

**Created:** December 15, 2025  
**Status:** Design & Planning Phase - Ready for Implementation

---

## Table of Contents
1. [Core Concepts & Principles](#core-concepts--principles)
2. [Database Schema](#database-schema)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Frontend Components](#frontend-components)
5. [UI/UX Flows](#uiux-flows)
6. [Settings Priority & Override System](#settings-priority--override-system)
7. [Implementation Steps](#implementation-steps)
8. [Code Examples](#code-examples)

---

## Core Concepts & Principles

### What Are Organizations?

**Organizations** are parent-level entities that allow companies or teams to:
- Create and manage creator profiles with standardized settings (watermarks, intros, outros, subtitles, etc.)
- Assign these creator profiles to specific user email addresses
- Add and remove creator assignments at any time
- Provide consistent clip generation settings across team members

### Key Design Principles

#### 1. Organizations Are Optional & Non-Restrictive
- Users can use Clippster fully without any organization involvement
- Organization features are purely additive convenience features
- No features are gated behind organization membership

#### 2. Users Retain Full Autonomy
Users can **always** do the following, regardless of organization assignments:
- Create personal creator profiles
- Download VODs for any streamer
- Build clips with any settings
- Upload videos with or without organization context
- Use all features freely

#### 3. Organization Settings Are Smart Defaults
- Organization-assigned creator profiles provide **default settings**
- Users can **toggle off** or **override** these settings when needed
- Useful for one-off clips or working with the same creator outside the organization context
- Organization settings are used **first** as defaults, but never lock the user in

#### 4. Multi-Organization Support
- Users can be assigned to creators across multiple organizations
- If the same creator exists in multiple organizations for a user, they can select which organization's defaults to use
- Supports users who work as clippers for multiple companies

#### 5. Manual Upload Flexibility
- When users upload videos manually, they can optionally select an organization/creator context
- This applies all organization presets automatically
- Users can also choose not to select any organization (personal project)
- Only organizations/creators assigned to the user are available for selection

---

## Database Schema

### New Tables

#### `organizations`
Stores organization entities.

```sql
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,                     -- Organization name
    description TEXT,                       -- Optional description
    logo_path TEXT,                         -- Path to org logo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    owner_email TEXT NOT NULL,              -- Email of user who created the org
    settings TEXT                           -- JSON for org-wide defaults
);

CREATE INDEX idx_org_owner ON organizations(owner_email);
```

**Example Row:**
```json
{
  "id": "org-uuid-1",
  "name": "Acme Gaming Studios",
  "description": "Professional esports clipping team",
  "logo_path": "/assets/logos/acme-logo.png",
  "owner_email": "admin@acmegaming.com",
  "settings": "{\"default_export_format\": \"mp4\", \"default_quality\": \"1080p\"}"
}
```

---

#### `organization_members`
Tracks which users belong to which organizations.

```sql
CREATE TABLE organization_members (
    id TEXT PRIMARY KEY,                    -- UUID
    organization_id TEXT NOT NULL,          -- Foreign key to organizations
    user_email TEXT NOT NULL,               -- User's email
    role TEXT NOT NULL DEFAULT 'member',    -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_email)
);

CREATE INDEX idx_member_email ON organization_members(user_email);
CREATE INDEX idx_member_org ON organization_members(organization_id);
```

**Roles:**
- `owner`: Created the organization, full permissions
- `admin`: Can manage creator profiles, assign users, add/remove members
- `member`: Can view assigned creators and use their presets

**Example Row:**
```json
{
  "id": "member-uuid-1",
  "organization_id": "org-uuid-1",
  "user_email": "clipper@example.com",
  "role": "member",
  "joined_at": "2025-12-15T10:00:00Z"
}
```

---

#### `organization_creator_assignments`
Maps which creator profiles are assigned to which users within an organization.

```sql
CREATE TABLE organization_creator_assignments (
    id TEXT PRIMARY KEY,                    -- UUID
    organization_id TEXT NOT NULL,          -- Foreign key to organizations
    creator_profile_id TEXT NOT NULL,       -- Foreign key to creator_profiles
    user_email TEXT NOT NULL,               -- User's email
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,                       -- Email of admin who made the assignment
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE CASCADE,
    UNIQUE(organization_id, creator_profile_id, user_email)
);

CREATE INDEX idx_assignment_user ON organization_creator_assignments(user_email);
CREATE INDEX idx_assignment_org_creator ON organization_creator_assignments(organization_id, creator_profile_id);
```

**Example Row:**
```json
{
  "id": "assignment-uuid-1",
  "organization_id": "org-uuid-1",
  "creator_profile_id": "creator-uuid-1",
  "user_email": "clipper@example.com",
  "assigned_at": "2025-12-15T10:30:00Z",
  "assigned_by": "admin@acmegaming.com"
}
```

---

### Modified Tables

#### `creator_profiles`
Add organization ownership to existing creator profiles table.

```sql
-- Add new columns
ALTER TABLE creator_profiles ADD COLUMN organization_id TEXT NULL;
ALTER TABLE creator_profiles ADD COLUMN created_by_email TEXT NOT NULL DEFAULT '';

-- Add foreign key
ALTER TABLE creator_profiles ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_creator_org ON creator_profiles(organization_id);
```

**Logic:**
- `organization_id = NULL` → Personal creator profile (owned by user)
- `organization_id = 'some-org-id'` → Organization creator profile (managed by org admins)

---

#### `clips`
Add organization context to clips for tracking and analytics.

```sql
ALTER TABLE clips ADD COLUMN organization_id TEXT NULL;
ALTER TABLE clips ADD COLUMN creator_profile_id TEXT NULL;
ALTER TABLE clips ADD COLUMN used_org_presets BOOLEAN DEFAULT FALSE;

ALTER TABLE clips ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE clips ADD FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_clip_org ON clips(organization_id);
```

**Purpose:**
- Track which clips were made using organization presets
- Enable organization-level analytics
- Allow filtering clips by organization

---

#### `projects`
Add organization context to projects (for manual uploads).

```sql
ALTER TABLE projects ADD COLUMN organization_id TEXT NULL;
ALTER TABLE projects ADD COLUMN creator_profile_id TEXT NULL;

ALTER TABLE projects ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE projects ADD FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_project_org ON projects(organization_id);
```

---

## Backend API Endpoints

### Organization Management

#### Create Organization

```rust
#[tauri::command]
pub async fn create_organization(
    name: String,
    description: Option<String>,
    logo_path: Option<String>,
    owner_email: String,
    app_state: State<'_, AppState>,
) -> Result<Organization, String> {
    let db = &app_state.db;
    let org_id = Uuid::new_v4().to_string();
    
    // Create organization
    db.execute(
        "INSERT INTO organizations (id, name, description, logo_path, owner_email) VALUES (?, ?, ?, ?, ?)",
        params![org_id, name, description, logo_path, owner_email],
    )?;
    
    // Auto-add owner as admin member
    let member_id = Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO organization_members (id, organization_id, user_email, role) VALUES (?, ?, ?, ?)",
        params![member_id, org_id, owner_email, "owner"],
    )?;
    
    Ok(Organization {
        id: org_id,
        name,
        description,
        logo_path,
        owner_email,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}
```

---

#### Get User's Organizations

```rust
#[tauri::command]
pub async fn get_user_organizations(
    user_email: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<OrganizationWithRole>, String> {
    let db = &app_state.db;
    
    let mut stmt = db.prepare(
        "SELECT o.*, m.role 
         FROM organizations o
         JOIN organization_members m ON o.id = m.organization_id
         WHERE m.user_email = ?
         ORDER BY o.name"
    )?;
    
    let orgs = stmt.query_map([user_email], |row| {
        Ok(OrganizationWithRole {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            logo_path: row.get(3)?,
            role: row.get("role")?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(orgs)
}
```

---

#### Update Organization

```rust
#[tauri::command]
pub async fn update_organization(
    organization_id: String,
    name: Option<String>,
    description: Option<String>,
    logo_path: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    db.execute(
        "UPDATE organizations 
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             logo_path = COALESCE(?, logo_path),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
        params![name, description, logo_path, organization_id],
    )?;
    
    Ok(())
}
```

---

#### Delete Organization

```rust
#[tauri::command]
pub async fn delete_organization(
    organization_id: String,
    user_email: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    // Verify user is owner
    let role: String = db.query_row(
        "SELECT role FROM organization_members WHERE organization_id = ? AND user_email = ?",
        params![organization_id, user_email],
        |row| row.get(0),
    )?;
    
    if role != "owner" {
        return Err("Only organization owner can delete the organization".to_string());
    }
    
    // Cascade delete will handle members, assignments, and creator profiles
    db.execute("DELETE FROM organizations WHERE id = ?", params![organization_id])?;
    
    Ok(())
}
```

---

### Member Management

#### Add Member to Organization

```rust
#[tauri::command]
pub async fn add_organization_member(
    organization_id: String,
    user_email: String,
    role: String,
    added_by: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    // Verify requester is admin or owner
    verify_admin_permission(&db, &organization_id, &added_by)?;
    
    // Validate role
    if !["member", "admin"].contains(&role.as_str()) {
        return Err("Invalid role. Must be 'member' or 'admin'".to_string());
    }
    
    let member_id = Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO organization_members (id, organization_id, user_email, role) 
         VALUES (?, ?, ?, ?)",
        params![member_id, organization_id, user_email, role],
    )?;
    
    Ok(())
}
```

---

#### Remove Member from Organization

```rust
#[tauri::command]
pub async fn remove_organization_member(
    organization_id: String,
    user_email: String,
    removed_by: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    // Verify requester is admin or owner
    verify_admin_permission(&db, &organization_id, &removed_by)?;
    
    // Cannot remove owner
    let role: String = db.query_row(
        "SELECT role FROM organization_members WHERE organization_id = ? AND user_email = ?",
        params![organization_id, user_email],
        |row| row.get(0),
    )?;
    
    if role == "owner" {
        return Err("Cannot remove organization owner".to_string());
    }
    
    // Remove member (cascade will remove their assignments)
    db.execute(
        "DELETE FROM organization_members WHERE organization_id = ? AND user_email = ?",
        params![organization_id, user_email],
    )?;
    
    Ok(())
}
```

---

#### Get Organization Members

```rust
#[tauri::command]
pub async fn get_organization_members(
    organization_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<OrganizationMember>, String> {
    let db = &app_state.db;
    
    let mut stmt = db.prepare(
        "SELECT id, user_email, role, joined_at 
         FROM organization_members 
         WHERE organization_id = ?
         ORDER BY joined_at"
    )?;
    
    let members = stmt.query_map([organization_id], |row| {
        Ok(OrganizationMember {
            id: row.get(0)?,
            user_email: row.get(1)?,
            role: row.get(2)?,
            joined_at: row.get(3)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(members)
}
```

---

### Creator Assignment Management

#### Assign Creator to User

```rust
#[tauri::command]
pub async fn assign_creator_to_user(
    organization_id: String,
    creator_profile_id: String,
    user_email: String,
    assigned_by: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    // Verify requester is admin or owner
    verify_admin_permission(&db, &organization_id, &assigned_by)?;
    
    // Verify creator profile belongs to this organization
    let creator_org_id: String = db.query_row(
        "SELECT organization_id FROM creator_profiles WHERE id = ?",
        params![creator_profile_id],
        |row| row.get(0),
    )?;
    
    if creator_org_id != organization_id {
        return Err("Creator profile does not belong to this organization".to_string());
    }
    
    // Verify user is a member of the organization
    let member_exists: bool = db.query_row(
        "SELECT COUNT(*) > 0 FROM organization_members WHERE organization_id = ? AND user_email = ?",
        params![organization_id, user_email],
        |row| row.get(0),
    )?;
    
    if !member_exists {
        return Err("User is not a member of this organization".to_string());
    }
    
    // Create assignment
    let assignment_id = Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO organization_creator_assignments (id, organization_id, creator_profile_id, user_email, assigned_by)
         VALUES (?, ?, ?, ?, ?)",
        params![assignment_id, organization_id, creator_profile_id, user_email, assigned_by],
    )?;
    
    Ok(())
}
```

---

#### Unassign Creator from User

```rust
#[tauri::command]
pub async fn unassign_creator_from_user(
    organization_id: String,
    creator_profile_id: String,
    user_email: String,
    unassigned_by: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let db = &app_state.db;
    
    // Verify requester is admin or owner
    verify_admin_permission(&db, &organization_id, &unassigned_by)?;
    
    db.execute(
        "DELETE FROM organization_creator_assignments 
         WHERE organization_id = ? AND creator_profile_id = ? AND user_email = ?",
        params![organization_id, creator_profile_id, user_email],
    )?;
    
    Ok(())
}
```

---

#### Get User's Assigned Creators

```rust
#[tauri::command]
pub async fn get_user_assigned_creators(
    user_email: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<AssignedCreatorProfile>, String> {
    let db = &app_state.db;
    
    let mut stmt = db.prepare(
        "SELECT 
            cp.*,
            o.id as org_id,
            o.name as org_name,
            o.logo_path as org_logo,
            oca.assigned_at
         FROM organization_creator_assignments oca
         JOIN creator_profiles cp ON cp.id = oca.creator_profile_id
         JOIN organizations o ON o.id = oca.organization_id
         WHERE oca.user_email = ?
         ORDER BY o.name, cp.name"
    )?;
    
    let creators = stmt.query_map([user_email], |row| {
        Ok(AssignedCreatorProfile {
            // Creator profile fields
            id: row.get("id")?,
            name: row.get("name")?,
            watermark_settings: row.get("watermark_settings")?,
            intro_id: row.get("intro_id")?,
            outro_id: row.get("outro_id")?,
            subtitle_settings: row.get("subtitle_settings")?,
            // Organization fields
            organization_id: row.get("org_id")?,
            organization_name: row.get("org_name")?,
            organization_logo: row.get("org_logo")?,
            assigned_at: row.get("assigned_at")?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(creators)
}
```

---

#### Get Organizations for Creator

```rust
#[tauri::command]
pub async fn get_organizations_for_creator(
    user_email: String,
    creator_name: String, // Or use creator_profile_id if available
    app_state: State<'_, AppState>,
) -> Result<Vec<OrganizationContext>, String> {
    let db = &app_state.db;
    
    // Find all organizations where:
    // 1. User is assigned to a creator profile with this name
    // 2. Multiple orgs may have different profiles for the same creator name
    
    let mut stmt = db.prepare(
        "SELECT 
            o.id as org_id,
            o.name as org_name,
            o.logo_path as org_logo,
            cp.id as creator_profile_id,
            cp.name as creator_name
         FROM organization_creator_assignments oca
         JOIN organizations o ON o.id = oca.organization_id
         JOIN creator_profiles cp ON cp.id = oca.creator_profile_id
         WHERE oca.user_email = ? AND cp.name = ?
         ORDER BY o.name"
    )?;
    
    let contexts = stmt.query_map(params![user_email, creator_name], |row| {
        Ok(OrganizationContext {
            org_id: row.get("org_id")?,
            org_name: row.get("org_name")?,
            org_logo: row.get("org_logo")?,
            creator_profile_id: row.get("creator_profile_id")?,
            creator_name: row.get("creator_name")?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(contexts)
}
```

---

#### Get User Organization Contexts (for Upload Dialog)

```rust
#[tauri::command]
pub async fn get_user_organization_contexts(
    user_email: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<OrganizationContext>, String> {
    let db = &app_state.db;
    
    // Returns only organizations + creators that are assigned to this user
    // Used for the dropdown in upload/clip dialogs
    
    let mut stmt = db.prepare(
        "SELECT 
            o.id as org_id,
            o.name as org_name,
            o.logo_path as org_logo,
            cp.id as creator_profile_id,
            cp.name as creator_name
         FROM organization_creator_assignments oca
         JOIN organizations o ON o.id = oca.organization_id
         JOIN creator_profiles cp ON cp.id = oca.creator_profile_id
         WHERE oca.user_email = ?
         ORDER BY o.name, cp.name"
    )?;
    
    let contexts = stmt.query_map([user_email], |row| {
        Ok(OrganizationContext {
            org_id: row.get("org_id")?,
            org_name: row.get("org_name")?,
            org_logo: row.get("org_logo")?,
            creator_profile_id: row.get("creator_profile_id")?,
            creator_name: row.get("creator_name")?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(contexts)
}
```

---

### Creator Profile Management (Modified)

#### Create Creator Profile for Organization

```rust
#[tauri::command]
pub async fn create_creator_profile_for_org(
    organization_id: String,
    creator_name: String,
    watermark_settings: Option<String>,
    intro_id: Option<String>,
    outro_id: Option<String>,
    subtitle_settings: Option<String>,
    created_by: String,
    app_state: State<'_, AppState>,
) -> Result<CreatorProfile, String> {
    let db = &app_state.db;
    
    // Verify requester is admin or owner
    verify_admin_permission(&db, &organization_id, &created_by)?;
    
    let profile_id = Uuid::new_v4().to_string();
    
    db.execute(
        "INSERT INTO creator_profiles 
         (id, name, organization_id, created_by_email, watermark_settings, intro_id, outro_id, subtitle_settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            profile_id,
            creator_name,
            organization_id,
            created_by,
            watermark_settings,
            intro_id,
            outro_id,
            subtitle_settings
        ],
    )?;
    
    Ok(CreatorProfile {
        id: profile_id,
        name: creator_name,
        organization_id: Some(organization_id),
        created_by_email: created_by,
        watermark_settings,
        intro_id,
        outro_id,
        subtitle_settings,
    })
}
```

---

#### Get Organization Creator Profiles

```rust
#[tauri::command]
pub async fn get_organization_creator_profiles(
    organization_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<CreatorProfile>, String> {
    let db = &app_state.db;
    
    let mut stmt = db.prepare(
        "SELECT * FROM creator_profiles 
         WHERE organization_id = ?
         ORDER BY name"
    )?;
    
    let profiles = stmt.query_map([organization_id], |row| {
        Ok(CreatorProfile {
            id: row.get("id")?,
            name: row.get("name")?,
            organization_id: row.get("organization_id")?,
            created_by_email: row.get("created_by_email")?,
            watermark_settings: row.get("watermark_settings")?,
            intro_id: row.get("intro_id")?,
            outro_id: row.get("outro_id")?,
            subtitle_settings: row.get("subtitle_settings")?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(profiles)
}
```

---

#### Get Creator Profile Presets

```rust
#[tauri::command]
pub async fn get_creator_profile_presets(
    creator_profile_id: String,
    app_state: State<'_, AppState>,
) -> Result<CreatorProfilePresets, String> {
    let db = &app_state.db;
    
    let profile: CreatorProfile = db.query_row(
        "SELECT * FROM creator_profiles WHERE id = ?",
        params![creator_profile_id],
        |row| {
            Ok(CreatorProfile {
                id: row.get("id")?,
                name: row.get("name")?,
                organization_id: row.get("organization_id")?,
                created_by_email: row.get("created_by_email")?,
                watermark_settings: row.get("watermark_settings")?,
                intro_id: row.get("intro_id")?,
                outro_id: row.get("outro_id")?,
                subtitle_settings: row.get("subtitle_settings")?,
            })
        },
    )?;
    
    Ok(CreatorProfilePresets {
        watermark_settings: profile.watermark_settings,
        intro_id: profile.intro_id,
        outro_id: profile.outro_id,
        subtitle_settings: profile.subtitle_settings,
    })
}
```

---

### Upload & Build Commands (Modified)

#### Upload Video with Optional Organization Context

```rust
#[tauri::command]
pub async fn upload_video_to_project(
    file_path: String,
    organization_id: Option<String>,
    creator_profile_id: Option<String>,
    apply_presets: bool,
    user_email: String,
    app_state: State<'_, AppState>,
) -> Result<Project, String> {
    let db = &app_state.db;
    
    // If organization_id and creator_profile_id are provided:
    //   - Verify user is assigned to this creator in this org
    //   - Load and apply organization's creator profile settings (if apply_presets = true)
    //   - Mark project as linked to org
    
    // If both are None:
    //   - Create as personal project
    //   - User can manually configure settings later
    
    if let (Some(org_id), Some(creator_id)) = (&organization_id, &creator_profile_id) {
        // Verify assignment
        let is_assigned: bool = db.query_row(
            "SELECT COUNT(*) > 0 FROM organization_creator_assignments 
             WHERE organization_id = ? AND creator_profile_id = ? AND user_email = ?",
            params![org_id, creator_id, user_email],
            |row| row.get(0),
        )?;
        
        if !is_assigned {
            return Err("User not assigned to this creator in this organization".to_string());
        }
        
        // Load org presets if apply_presets is true
        let presets = if apply_presets {
            Some(get_creator_profile_presets(creator_id.clone(), app_state.clone()).await?)
        } else {
            None
        };
        
        // Create project with org context
        create_project_with_org_context(file_path, org_id.clone(), creator_id.clone(), presets, db).await
    } else {
        // Create personal project
        create_personal_project(file_path, user_email, db).await
    }
}
```

---

#### Build Clips with Organization Context

```rust
#[tauri::command]
pub async fn build_clips(
    settings: ClipBuildSettings,
    organization_id: Option<String>,
    creator_profile_id: Option<String>,
    used_org_presets: bool,
    app_state: State<'_, AppState>,
) -> Result<Vec<Clip>, String> {
    let db = &app_state.db;
    
    // Build clips as usual, but store org context
    let clips = perform_clip_building(settings, app_state).await?;
    
    // Update clips with org context
    for clip in &clips {
        db.execute(
            "UPDATE clips 
             SET organization_id = ?, creator_profile_id = ?, used_org_presets = ?
             WHERE id = ?",
            params![organization_id, creator_profile_id, used_org_presets, clip.id],
        )?;
    }
    
    Ok(clips)
}
```

---

### Helper Functions

```rust
fn verify_admin_permission(
    db: &Connection,
    organization_id: &str,
    user_email: &str,
) -> Result<(), String> {
    let role: Result<String, _> = db.query_row(
        "SELECT role FROM organization_members WHERE organization_id = ? AND user_email = ?",
        params![organization_id, user_email],
        |row| row.get(0),
    );
    
    match role {
        Ok(r) if r == "owner" || r == "admin" => Ok(()),
        Ok(_) => Err("Insufficient permissions. Must be admin or owner.".to_string()),
        Err(_) => Err("User is not a member of this organization.".to_string()),
    }
}
```

---

## Frontend Components

### New Components

#### 1. `OrganizationDashboard.vue`

Main dashboard for organization management.

```vue
<template>
  <div class="organization-dashboard">
    <!-- Organization Selector (if user is in multiple orgs) -->
    <div v-if="organizations.length > 1" class="org-selector">
      <Select v-model="selectedOrgId" @change="loadOrganizationData">
        <option v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }} ({{ org.role }})
        </option>
      </Select>
    </div>

    <!-- Single Org Header -->
    <div v-if="currentOrg" class="org-header">
      <img v-if="currentOrg.logo_path" :src="currentOrg.logo_path" class="org-logo" />
      <h1>{{ currentOrg.name }}</h1>
      <p>{{ currentOrg.description }}</p>
      
      <!-- Admin Actions -->
      <div v-if="isAdmin" class="admin-actions">
        <Button @click="openEditOrgDialog">Edit Organization</Button>
        <Button @click="openMembersDialog">Manage Members</Button>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab">
      <Tab value="creators">Creator Profiles</Tab>
      <Tab value="assignments">Creator Assignments</Tab>
      <Tab value="members" v-if="isAdmin">Members</Tab>
      <Tab value="analytics">Analytics</Tab>
    </Tabs>

    <!-- Creator Profiles Tab -->
    <div v-if="activeTab === 'creators'" class="creators-section">
      <div class="section-header">
        <h2>Creator Profiles</h2>
        <Button v-if="isAdmin" @click="openCreateCreatorDialog">
          + Create Creator Profile
        </Button>
      </div>
      
      <div class="profiles-grid">
        <CreatorProfileCard
          v-for="profile in orgCreatorProfiles"
          :key="profile.id"
          :profile="profile"
          :editable="isAdmin"
          :badge="`${currentOrg.name} Managed`"
          @edit="editCreatorProfile"
          @delete="deleteCreatorProfile"
        />
      </div>
    </div>

    <!-- Creator Assignments Tab -->
    <div v-if="activeTab === 'assignments'" class="assignments-section">
      <CreatorAssignmentManager
        :organization-id="selectedOrgId"
        :is-admin="isAdmin"
      />
    </div>

    <!-- Members Tab (Admin only) -->
    <div v-if="activeTab === 'members' && isAdmin" class="members-section">
      <OrganizationMembersManager
        :organization-id="selectedOrgId"
      />
    </div>

    <!-- Analytics Tab -->
    <div v-if="activeTab === 'analytics'" class="analytics-section">
      <OrganizationAnalytics
        :organization-id="selectedOrgId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';

const organizations = ref<OrganizationWithRole[]>([]);
const selectedOrgId = ref<string | null>(null);
const currentOrg = ref<OrganizationWithRole | null>(null);
const orgCreatorProfiles = ref<CreatorProfile[]>([]);
const activeTab = ref('creators');
const userEmail = ref(''); // Get from auth context

const isAdmin = computed(() => {
  return currentOrg.value?.role === 'admin' || currentOrg.value?.role === 'owner';
});

onMounted(async () => {
  // Load user's organizations
  organizations.value = await invoke('get_user_organizations', { userEmail: userEmail.value });
  
  if (organizations.value.length > 0) {
    selectedOrgId.value = organizations.value[0].id;
    await loadOrganizationData();
  }
});

async function loadOrganizationData() {
  if (!selectedOrgId.value) return;
  
  currentOrg.value = organizations.value.find(o => o.id === selectedOrgId.value) || null;
  orgCreatorProfiles.value = await invoke('get_organization_creator_profiles', {
    organizationId: selectedOrgId.value
  });
}

function openCreateCreatorDialog() {
  // Open dialog to create new creator profile for this org
}

function editCreatorProfile(profileId: string) {
  // Open edit dialog for creator profile
}

async function deleteCreatorProfile(profileId: string) {
  // Confirm and delete creator profile
}
</script>
```

---

#### 2. `CreatorAssignmentManager.vue`

Interface for assigning creator profiles to users.

```vue
<template>
  <div class="assignment-manager">
    <div class="section-header">
      <h2>Creator Assignments</h2>
      <p>Assign creator profiles to team members to provide them with standardized presets</p>
    </div>

    <!-- Creator Profiles List with Assignments -->
    <div class="creators-with-assignments">
      <div
        v-for="creator in creatorsWithAssignments"
        :key="creator.id"
        class="creator-assignment-card"
      >
        <div class="creator-info">
          <h3>{{ creator.name }}</h3>
          <p class="assigned-count">
            {{ creator.assignedUsers.length }} user(s) assigned
          </p>
        </div>

        <!-- Assigned Users -->
        <div class="assigned-users">
          <div
            v-for="user in creator.assignedUsers"
            :key="user.email"
            class="user-badge"
          >
            <span>{{ user.email }}</span>
            <button
              v-if="isAdmin"
              @click="unassignUser(creator.id, user.email)"
              class="remove-btn"
              title="Remove assignment"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div v-if="creator.assignedUsers.length === 0" class="no-assignments">
            No users assigned yet
          </div>
        </div>

        <!-- Assign User Button -->
        <div v-if="isAdmin" class="assign-action">
          <Button
            @click="openAssignDialog(creator)"
            variant="secondary"
            size="sm"
          >
            + Assign User
          </Button>
        </div>
      </div>
    </div>

    <!-- Assign User Dialog -->
    <Dialog v-model:open="assignDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {{ selectedCreator?.name }} to User</DialogTitle>
        </DialogHeader>
        
        <div class="assign-form">
          <label>Select User</label>
          <Select v-model="selectedUserEmail">
            <option value="">-- Select a member --</option>
            <option
              v-for="member in unassignedMembers"
              :key="member.user_email"
              :value="member.user_email"
            >
              {{ member.user_email }} ({{ member.role }})
            </option>
          </Select>

          <p v-if="unassignedMembers.length === 0" class="info-text">
            All members are already assigned to this creator
          </p>
        </div>

        <DialogFooter>
          <Button @click="assignDialogOpen = false" variant="ghost">Cancel</Button>
          <Button
            @click="assignUser"
            :disabled="!selectedUserEmail"
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { X } from 'lucide-vue-next';

const props = defineProps<{
  organizationId: string;
  isAdmin: boolean;
}>();

const creatorsWithAssignments = ref<CreatorWithAssignments[]>([]);
const organizationMembers = ref<OrganizationMember[]>([]);
const assignDialogOpen = ref(false);
const selectedCreator = ref<CreatorProfile | null>(null);
const selectedUserEmail = ref('');

const unassignedMembers = computed(() => {
  if (!selectedCreator.value) return [];
  
  const assignedEmails = selectedCreator.value.assignedUsers.map(u => u.email);
  return organizationMembers.value.filter(m => !assignedEmails.includes(m.user_email));
});

onMounted(async () => {
  await loadData();
});

async function loadData() {
  // Load creator profiles
  const profiles = await invoke('get_organization_creator_profiles', {
    organizationId: props.organizationId
  });
  
  // Load members
  organizationMembers.value = await invoke('get_organization_members', {
    organizationId: props.organizationId
  });
  
  // For each creator, get assigned users
  creatorsWithAssignments.value = await Promise.all(
    profiles.map(async (creator) => {
      const assignments = await invoke('get_creator_assignments', {
        organizationId: props.organizationId,
        creatorProfileId: creator.id
      });
      
      return {
        ...creator,
        assignedUsers: assignments
      };
    })
  );
}

function openAssignDialog(creator: CreatorProfile) {
  selectedCreator.value = creator;
  selectedUserEmail.value = '';
  assignDialogOpen.value = true;
}

async function assignUser() {
  if (!selectedCreator.value || !selectedUserEmail.value) return;
  
  try {
    await invoke('assign_creator_to_user', {
      organizationId: props.organizationId,
      creatorProfileId: selectedCreator.value.id,
      userEmail: selectedUserEmail.value,
      assignedBy: currentUserEmail.value // From auth context
    });
    
    await loadData();
    assignDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to assign creator:', error);
  }
}

async function unassignUser(creatorId: string, userEmail: string) {
  if (!confirm(`Remove ${userEmail} from this creator?`)) return;
  
  try {
    await invoke('unassign_creator_from_user', {
      organizationId: props.organizationId,
      creatorProfileId: creatorId,
      userEmail: userEmail,
      unassignedBy: currentUserEmail.value
    });
    
    await loadData();
  } catch (error) {
    console.error('Failed to unassign creator:', error);
  }
}
</script>
```

---

#### 3. `MyAssignedCreators.vue`

User view of their assigned creator profiles from all organizations.

```vue
<template>
  <div class="my-assigned-creators">
    <div class="page-header">
      <h1>My Assigned Creators</h1>
      <p>Creator profiles assigned to you by organizations</p>
    </div>

    <div v-if="assignedCreators.length === 0" class="empty-state">
      <p>You don't have any assigned creators yet.</p>
      <p>Contact your organization admin to get creator assignments.</p>
    </div>

    <!-- Group by Organization -->
    <div
      v-for="org in groupedByOrg"
      :key="org.organizationId"
      class="org-group"
    >
      <div class="org-header">
        <img v-if="org.logo" :src="org.logo" class="org-logo-sm" />
        <h2>{{ org.organizationName }}</h2>
        <span class="creator-count">{{ org.creators.length }} creator(s)</span>
      </div>

      <div class="creators-grid">
        <div
          v-for="creator in org.creators"
          :key="creator.id"
          class="creator-card"
        >
          <div class="creator-header">
            <h3>{{ creator.name }}</h3>
            <Badge variant="secondary">Organization Managed</Badge>
          </div>

          <div class="creator-details">
            <div class="preset-info">
              <p><strong>Assigned:</strong> {{ formatDate(creator.assigned_at) }}</p>
              
              <!-- Preview of presets -->
              <div class="presets-preview">
                <div v-if="creator.watermark_settings" class="preset-item">
                  <Check class="w-4 h-4 text-green-500" />
                  <span>Watermark configured</span>
                </div>
                <div v-if="creator.intro_id" class="preset-item">
                  <Check class="w-4 h-4 text-green-500" />
                  <span>Intro video</span>
                </div>
                <div v-if="creator.outro_id" class="preset-item">
                  <Check class="w-4 h-4 text-green-500" />
                  <span>Outro video</span>
                </div>
                <div v-if="creator.subtitle_settings" class="preset-item">
                  <Check class="w-4 h-4 text-green-500" />
                  <span>Subtitle style</span>
                </div>
              </div>
            </div>
          </div>

          <div class="creator-actions">
            <Button @click="startClipping(creator)" variant="primary">
              Start Clipping
            </Button>
            <Button @click="downloadVOD(creator)" variant="secondary">
              Download VOD
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { Check } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const router = useRouter();
const assignedCreators = ref<AssignedCreatorProfile[]>([]);
const userEmail = ref(''); // From auth context

const groupedByOrg = computed(() => {
  const groups = new Map<string, {
    organizationId: string;
    organizationName: string;
    logo: string | null;
    creators: AssignedCreatorProfile[];
  }>();

  assignedCreators.value.forEach(creator => {
    if (!groups.has(creator.organization_id)) {
      groups.set(creator.organization_id, {
        organizationId: creator.organization_id,
        organizationName: creator.organization_name,
        logo: creator.organization_logo,
        creators: []
      });
    }
    groups.get(creator.organization_id)!.creators.push(creator);
  });

  return Array.from(groups.values());
});

onMounted(async () => {
  assignedCreators.value = await invoke('get_user_assigned_creators', {
    userEmail: userEmail.value
  });
});

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}

function startClipping(creator: AssignedCreatorProfile) {
  // Navigate to clips page with this creator's presets loaded
  router.push({
    name: 'clips',
    query: {
      creatorProfileId: creator.id,
      organizationId: creator.organization_id
    }
  });
}

function downloadVOD(creator: AssignedCreatorProfile) {
  // Navigate to VOD download with creator context
  router.push({
    name: 'download-vod',
    query: {
      creatorName: creator.name
    }
  });
}
</script>
```

---

#### 4. `OrganizationSelector.vue`

Reusable dropdown for selecting organization context.

```vue
<template>
  <div class="organization-selector">
    <label v-if="label">{{ label }}</label>
    <Select
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :disabled="disabled"
    >
      <option v-if="allowNone" :value="null">
        {{ noneLabel }}
      </option>
      
      <optgroup
        v-for="org in organizations"
        :key="org.orgId"
        :label="org.orgName"
      >
        <option
          v-for="creator in org.assignedCreators"
          :key="`${org.orgId}-${creator.id}`"
          :value="{ orgId: org.orgId, creatorId: creator.id }"
        >
          {{ creator.name }}
        </option>
      </optgroup>
    </Select>

    <!-- Preview of selected presets -->
    <div v-if="selectedContext && showPreview" class="preset-preview">
      <p class="preview-title">Will use {{ selectedContext.orgName }}'s presets:</p>
      <ul class="preset-list">
        <li v-if="presets.watermark">✓ Watermark</li>
        <li v-if="presets.intro">✓ Intro</li>
        <li v-if="presets.outro">✓ Outro</li>
        <li v-if="presets.subtitles">✓ Subtitles</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';

const props = defineProps<{
  modelValue: OrganizationContext | null;
  organizations: OrganizationWithCreators[];
  label?: string;
  allowNone?: boolean;
  noneLabel?: string;
  showPreview?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: OrganizationContext | null): void;
}>();

const presets = ref<any>({});
const selectedContext = ref<OrganizationContext | null>(null);

watch(() => props.modelValue, async (newValue) => {
  selectedContext.value = newValue;
  
  if (newValue && props.showPreview) {
    // Load presets for preview
    presets.value = await invoke('get_creator_profile_presets', {
      creatorProfileId: newValue.creatorId
    });
  } else {
    presets.value = {};
  }
}, { immediate: true });
</script>
```

---

### Modified Components

#### `ClipBuildSettingsDialog.vue`

Add organization context selection when user has multiple organization assignments for the same creator.

**Key Changes:**
- Add organization context selector at the top of the dialog
- Show selector only if user has this creator in multiple organizations
- Add "Override presets" toggle when org context is selected
- Lock/disable settings when using org presets (unless override is enabled)
- Show banner indicating which org's presets are being used

**Conceptual Code:**

```typescript
// Add to existing ClipBuildSettingsDialog.vue

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-4xl">
      <!-- NEW: Organization Context Selector -->
      <div v-if="availableOrgContexts.length > 0" class="org-context-section">
        <label>Use Organization Presets (Optional)</label>
        <p class="help-text">
          This creator is assigned to you by {{ availableOrgContexts.length }} organization(s).
          Select one to use their presets, or leave blank for personal settings.
        </p>
        
        <OrganizationSelector
          v-model="selectedOrgContext"
          :organizations="[{ orgId: null, orgName: 'Personal Settings', assignedCreators: [] }, ...availableOrgContexts]"
          allow-none
          none-label="Personal Settings (No Organization)"
          show-preview
        />

        <!-- Toggle to override org presets -->
        <div v-if="selectedOrgContext" class="override-toggle">
          <Checkbox v-model="overrideOrgPresets" id="override-presets" />
          <label for="override-presets">
            Override organization presets for this clip
          </label>
          <p class="help-text">
            Check this to customize settings for a one-off clip or when working
            with this creator outside the organization context
          </p>
        </div>
      </div>

      <!-- Existing settings (now with conditional defaults) -->
      <div class="settings-sections" :class="{ 'using-org-presets': usingOrgPresets }">
        <!-- Visual indicator when using org presets -->
        <div v-if="usingOrgPresets && !overrideOrgPresets" class="org-preset-banner">
          <Info class="w-4 h-4" />
          <span>Using {{ selectedOrgContext.orgName }}'s preset settings</span>
          <Button @click="overrideOrgPresets = true" variant="ghost" size="sm">
            Customize
          </Button>
        </div>

        <!-- Aspect Ratio Selection -->
        <div class="setting-group">
          <label>Aspect Ratios</label>
          <AspectRatioSelector
            v-model="settings.aspectRatios"
            :disabled="usingOrgPresets && !overrideOrgPresets"
          />
        </div>

        <!-- Watermark Settings -->
        <div class="setting-group">
          <label>Watermark</label>
          <WatermarkSettings
            v-model="settings.watermark"
            :disabled="usingOrgPresets && !overrideOrgPresets"
            :org-preset="usingOrgPresets && !overrideOrgPresets"
          />
        </div>

        <!-- Similar for other settings... -->
      </div>

      <DialogFooter>
        <Button @click="isOpen = false" variant="ghost">Cancel</Button>
        <Button @click="buildClips">Build Clips</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';

const props = defineProps<{
  creatorName: string;
  creatorProfileId?: string;
}>();

const availableOrgContexts = ref<OrganizationContext[]>([]);
const selectedOrgContext = ref<OrganizationContext | null>(null);
const overrideOrgPresets = ref(false);
const settings = ref<ClipBuildSettings>({});
const userEmail = ref(''); // From auth context

const usingOrgPresets = computed(() => {
  return selectedOrgContext.value !== null && !overrideOrgPresets.value;
});

onMounted(async () => {
  // Check if this creator exists in multiple organizations for this user
  availableOrgContexts.value = await invoke('get_organizations_for_creator', {
    userEmail: userEmail.value,
    creatorName: props.creatorName
  });

  // If only one org context, auto-select it
  if (availableOrgContexts.value.length === 1) {
    selectedOrgContext.value = availableOrgContexts.value[0];
  }
});

// Load org presets when organization is selected
watch(selectedOrgContext, async (ctx) => {
  if (ctx) {
    const presets = await invoke('get_creator_profile_presets', {
      creatorProfileId: ctx.creatorProfileId
    });
    
    // Merge presets into settings (as defaults)
    settings.value = { ...presets, ...settings.value };
  }
});

// When override is toggled on, keep current settings
// When toggled off, reload org presets
watch(overrideOrgPresets, async (override) => {
  if (!override && selectedOrgContext.value) {
    const presets = await invoke('get_creator_profile_presets', {
      creatorProfileId: selectedOrgContext.value.creatorProfileId
    });
    settings.value = presets;
  }
});

async function buildClips() {
  await invoke('build_clips', {
    settings: settings.value,
    organizationId: selectedOrgContext.value?.orgId || null,
    creatorProfileId: selectedOrgContext.value?.creatorProfileId || null,
    usedOrgPresets: usingOrgPresets.value
  });
}
</script>
```

---

#### `VideoUploadDialog.vue` (NEW or Modified)

Add organization context selection for manual video uploads.

```vue
<template>
  <Dialog v-model:open="isOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload Video</DialogTitle>
      </DialogHeader>

      <!-- File Selection -->
      <div class="upload-section">
        <label>Select Video File</label>
        <input
          type="file"
          accept="video/*"
          @change="handleFileSelect"
          ref="fileInput"
        />
        <p v-if="selectedFile" class="file-name">
          {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
        </p>
      </div>

      <!-- OPTIONAL Organization/Creator Selection -->
      <div class="org-context-section">
        <label>Apply Organization Presets (Optional)</label>
        <p class="help-text">
          Select to automatically apply organization settings, or leave blank for personal project
        </p>

        <Select v-model="selectedOrgCreator" clearable>
          <option :value="null">No Organization (Personal Project)</option>
          <optgroup
            v-for="org in userOrganizations"
            :key="org.orgId"
            :label="org.orgName"
          >
            <option
              v-for="creator in org.assignedCreators"
              :key="`${org.orgId}-${creator.id}`"
              :value="{ orgId: org.orgId, creatorId: creator.id, creatorName: creator.name }"
            >
              {{ creator.name }}
            </option>
          </optgroup>
        </Select>

        <!-- Preview of what will be applied -->
        <div v-if="selectedOrgCreator && presets" class="preset-preview">
          <p><strong>Will Apply {{ selectedOrgCreator.creatorName }}'s Presets:</strong></p>
          <ul>
            <li v-if="presets.watermark">
              <Check class="w-4 h-4" /> Watermark: {{ presets.watermark.name }}
            </li>
            <li v-if="presets.intro">
              <Check class="w-4 h-4" /> Intro: {{ presets.intro.name }}
            </li>
            <li v-if="presets.outro">
              <Check class="w-4 h-4" /> Outro: {{ presets.outro.name }}
            </li>
            <li v-if="presets.subtitles">
              <Check class="w-4 h-4" /> Subtitle Style: {{ presets.subtitles.style }}
            </li>
          </ul>

          <!-- Toggle to override -->
          <div class="override-option">
            <Checkbox v-model="overridePresets" id="override-upload" />
            <label for="override-upload">
              Don't apply presets (customize settings after upload)
            </label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button @click="isOpen = false" variant="ghost">Cancel</Button>
        <Button
          @click="upload"
          :disabled="!selectedFile || uploading"
        >
          <Loader2 v-if="uploading" class="w-4 h-4 animate-spin mr-2" />
          Upload
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { Check, Loader2 } from 'lucide-vue-next';

const isOpen = ref(false);
const selectedFile = ref<File | null>(null);
const selectedOrgCreator = ref<{ orgId: string; creatorId: string; creatorName: string } | null>(null);
const overridePresets = ref(false);
const presets = ref<any>(null);
const userOrganizations = ref<OrganizationWithCreators[]>([]);
const uploading = ref(false);
const userEmail = ref(''); // From auth context

// Load user's organization contexts on mount
onMounted(async () => {
  userOrganizations.value = await invoke('get_user_organization_contexts', {
    userEmail: userEmail.value
  });
});

// When org/creator selected, preview what presets will apply
watch(selectedOrgCreator, async (selection) => {
  if (selection) {
    presets.value = await invoke('get_creator_profile_presets', {
      creatorProfileId: selection.creatorId
    });
  } else {
    presets.value = null;
  }
});

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0];
  }
}

async function upload() {
  if (!selectedFile.value) return;

  uploading.value = true;

  try {
    const result = await invoke('upload_video_to_project', {
      filePath: selectedFile.value.path,
      organizationId: selectedOrgCreator.value?.orgId || null,
      creatorProfileId: selectedOrgCreator.value?.creatorId || null,
      applyPresets: selectedOrgCreator.value !== null && !overridePresets.value,
      userEmail: userEmail.value
    });

    console.log('Upload successful:', result);
    isOpen.value = false;

    // Navigate to project or show success message
  } catch (error) {
    console.error('Upload failed:', error);
    // Show error message
  } finally {
    uploading.value = false;
  }
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}
</script>
```

---

#### `CreatorProfilesView.vue` (Modified)

Show both personal and organization-assigned profiles.

**Key Changes:**
- Add tabs to switch between "My Profiles" (personal), "Assigned by Organizations", and "All Available"
- Show org-managed badge on assigned profiles
- Disable editing for org profiles (users can't modify them)
- Add override toggle for using assigned profiles with custom settings

**Conceptual Code:**

```vue
<template>
  <div class="profiles-page">
    <!-- Tabs to switch between views -->
    <Tabs v-model="activeView">
      <Tab value="personal">My Profiles</Tab>
      <Tab value="assigned">Assigned by Organizations</Tab>
      <Tab value="all">All Available</Tab>
    </Tabs>

    <!-- Personal Profiles Section -->
    <div v-if="activeView === 'personal'" class="personal-profiles">
      <div class="section-header">
        <h2>My Creator Profiles</h2>
        <p>Your personal profiles, not linked to any organization</p>
        <Button @click="createPersonalProfile">+ Create Personal Profile</Button>
      </div>

      <div class="profiles-grid">
        <CreatorProfileCard
          v-for="profile in personalProfiles"
          :key="profile.id"
          :profile="profile"
          :editable="true"
          @edit="editProfile"
          @delete="deleteProfile"
        />
      </div>

      <div v-if="personalProfiles.length === 0" class="empty-state">
        <p>You haven't created any personal profiles yet.</p>
      </div>
    </div>

    <!-- Organization Assigned Profiles Section -->
    <div v-if="activeView === 'assigned'" class="org-profiles">
      <div class="section-header">
        <h2>Organization Assigned Profiles</h2>
        <p>Creators assigned to you by organizations (presets managed by organization)</p>
      </div>

      <div v-for="org in organizationGroups" :key="org.id" class="org-group">
        <div class="org-header">
          <img v-if="org.logo" :src="org.logo" class="org-logo" />
          <h3>{{ org.name }}</h3>
          <span class="badge">{{ org.creators.length }} creator(s)</span>
        </div>

        <div class="profiles-grid">
          <CreatorProfileCard
            v-for="profile in org.creators"
            :key="profile.id"
            :profile="profile"
            :editable="false"
            :badge="`${org.name} Managed`"
            :show-override-toggle="true"
            @override-settings="handleOverrideSettings"
          />
        </div>
      </div>

      <div v-if="assignedProfiles.length === 0" class="empty-state">
        <p>You don't have any assigned creators yet.</p>
        <p>Contact your organization admin to get creator assignments.</p>
      </div>
    </div>

    <!-- All Available (Combined) -->
    <div v-if="activeView === 'all'" class="all-profiles">
      <MyAssignedCreators />
      <hr />
      <div class="personal-section">
        <h2>Personal Profiles</h2>
        <div class="profiles-grid">
          <CreatorProfileCard
            v-for="profile in personalProfiles"
            :key="profile.id"
            :profile="profile"
            :editable="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';

const activeView = ref('all');
const personalProfiles = ref<CreatorProfile[]>([]);
const assignedProfiles = ref<AssignedCreatorProfile[]>([]);
const userEmail = ref(''); // From auth context

const organizationGroups = computed(() => {
  const groups = new Map();
  assignedProfiles.value.forEach(profile => {
    if (!groups.has(profile.organization_id)) {
      groups.set(profile.organization_id, {
        id: profile.organization_id,
        name: profile.organization_name,
        logo: profile.organization_logo,
        creators: []
      });
    }
    groups.get(profile.organization_id).creators.push(profile);
  });
  return Array.from(groups.values());
});

onMounted(async () => {
  await loadProfiles();
});

async function loadProfiles() {
  // Load personal profiles (where organization_id is NULL)
  personalProfiles.value = await invoke('get_user_personal_profiles', {
    userEmail: userEmail.value
  });

  // Load assigned profiles
  assignedProfiles.value = await invoke('get_user_assigned_creators', {
    userEmail: userEmail.value
  });
}

function createPersonalProfile() {
  // Open creator profile dialog
}

function editProfile(profileId: string) {
  // Open edit dialog
}

async function deleteProfile(profileId: string) {
  // Confirm and delete
  await invoke('delete_creator_profile', { profileId });
  await loadProfiles();
}

function handleOverrideSettings(profile: CreatorProfile) {
  // Open dialog to customize/override organization settings for this profile
  // This is for temporary overrides, not editing the org profile itself
}
</script>
```

---

## UI/UX Flows

### Flow 1: Organization Admin Creating & Assigning Creator Profiles

1. **Admin navigates to Organization Dashboard**
   - Sees their organization(s)
   - Selects "Creator Profiles" tab

2. **Admin creates creator profile**
   - Clicks "Create Creator Profile"
   - Enters creator name (e.g., "xQc")
   - Configures settings:
     - Uploads watermarks for different aspect ratios (16:9, 9:16, etc.)
     - Uploads intro video
     - Uploads outro video
     - Configures subtitle style
     - Sets other clip defaults
   - Saves profile (profile is now owned by the organization)

3. **Admin assigns creator to team members**
   - Navigates to "Creator Assignments" tab
   - Sees list of creator profiles
   - Clicks "Assign User" for the "xQc" profile
   - Selects user email from dropdown (only shows org members)
   - Confirms assignment

4. **User receives assignment**
   - User logs in
   - Sees "xQc" appear in their "Assigned Creators" section
   - Can now use xQc's preset settings when clipping

---

### Flow 2: User Using Organization-Assigned Creator Presets

1. **User logs in and sees assigned creators**
   - Navigates to "My Assigned Creators" or sees them in main dashboard
   - Sees creators grouped by organization

2. **User starts clipping process**
   - Option A: Downloads VOD for assigned creator
   - Option B: Uploads a video

3. **If downloading VOD:**
   - Selects "Download VOD" for assigned creator
   - Downloads VOD as usual
   - VOD is automatically tagged with creator context

4. **If uploading manually:**
   - Opens upload dialog
   - Selects file
   - Sees dropdown: "Apply Organization Presets (Optional)"
   - Selects organization + creator from dropdown
   - Sees preview of what presets will apply
   - Can check "Don't apply presets" if needed for one-off
   - Uploads

5. **Building clips:**
   - Opens clip build settings
   - If creator exists in multiple orgs, sees org selector
   - Selects organization (or "Personal Settings")
   - Sees banner: "Using [Org Name]'s preset settings"
   - All settings pre-filled from org presets
   - Can toggle "Override presets" to customize for one-off
   - Builds clips with org settings (or overrides)

---

### Flow 3: User Working with Same Creator Across Multiple Organizations

**Scenario**: User clips for "Streamer X" for both "Company A" and "Company B"

1. **Both orgs have assigned "Streamer X" to the user**
   - Company A wants horizontal watermark on bottom-right
   - Company B wants vertical watermark on top-left

2. **User starts clipping for Streamer X**
   - Opens clip build settings
   - Sees organization selector showing:
     - "Company A - Streamer X"
     - "Company B - Streamer X"
     - "Personal Settings"

3. **User selects organization**
   - Selects "Company A - Streamer X"
   - Settings auto-populate with Company A's presets
   - Builds clips → clips are tagged with Company A context

4. **Later, user clips same streamer for Company B**
   - Opens clip build settings
   - Selects "Company B - Streamer X"
   - Settings auto-populate with Company B's presets
   - Builds clips → clips are tagged with Company B context

---

### Flow 4: User Overriding Organization Presets for One-Off Clip

**Scenario**: User needs to make a special clip with different settings

1. **User has assigned creator with org presets**
   - Organization has set watermark, intro, outro, subtitles

2. **User needs to make clip without watermark (one-off)**
   - Opens clip build settings
   - Organization presets are loaded by default
   - Checks "Override organization presets for this clip"

3. **Settings become editable**
   - User disables watermark
   - Changes subtitle style
   - Builds clip with custom settings

4. **Clip is still tagged with org context**
   - But `used_org_presets` flag is set to `false`
   - Organization can see this clip didn't use their presets (for analytics)

5. **Next time user clips, org presets are default again**
   - Override was temporary, just for that one clip

---

### Flow 5: User Uploading Video with Optional Org Context

1. **User has video file to upload**
   - Opens "Upload Video" dialog

2. **Sees organization selector (optional)**
   - Dropdown shows all assigned creators across all orgs
   - Also shows "No Organization (Personal Project)"

3. **Option A: User selects org/creator**
   - Selects "Company A - Streamer X"
   - Sees preview: "Will apply watermark, intro, outro, subtitles"
   - Can check "Don't apply presets" if needed
   - Uploads → project is tagged with Company A context

4. **Option B: User selects "No Organization"**
   - Uploads as personal project
   - No org context or presets applied
   - User can manually configure settings later

---

## Settings Priority & Override System

### Priority Hierarchy

When determining which settings to use for a clip or upload:

```
1. User Override (if "Override presets" toggled ON)
   ↓
2. Organization Presets (if org context selected)
   ↓
3. Personal Creator Profile Settings (if user created profile)
   ↓
4. Application Defaults
```

---

### How Override System Works

#### Default Behavior (Using Org Presets)

```typescript
// When organization context is selected and override is OFF
const settings = {
  watermark: orgPresets.watermark,          // From organization
  intro: orgPresets.intro,                  // From organization
  outro: orgPresets.outro,                  // From organization
  subtitles: orgPresets.subtitles,          // From organization
  aspectRatios: orgPresets.aspectRatios,    // From organization
  // All settings locked (grayed out in UI)
};
```

#### With Override Enabled

```typescript
// When user toggles "Override organization presets"
const settings = {
  // Starts with org presets as defaults
  watermark: orgPresets.watermark,
  intro: orgPresets.intro,
  // ... but user can now modify ANY setting

  // User modifications:
  watermark: null,                          // User disabled watermark
  subtitles: userCustomSubtitles,           // User changed subtitle style
  
  // Settings become editable in UI
};

// When clip is built:
await buildClips({
  settings: settings,
  organizationId: selectedOrg.id,
  usedOrgPresets: false,  // Flag indicates override was used
});
```

---

### UI Behavior for Override Toggle

```vue
<template>
  <div class="settings-dialog">
    <!-- Organization banner (when org selected) -->
    <div v-if="hasOrgContext" class="org-banner">
      <img :src="selectedOrg.logo" />
      <span>Using {{ selectedOrg.name }}'s presets for {{ creator.name }}</span>
      
      <button @click="overridePresets = !overridePresets" class="override-btn">
        {{ overridePresets ? 'Use Org Presets' : 'Customize Settings' }}
      </button>
    </div>

    <!-- Settings sections -->
    <div class="settings-groups" :class="{ 'locked': hasOrgContext && !overridePresets }">
      <!-- Watermark Settings -->
      <div class="setting-group">
        <label>
          Watermark
          <span v-if="hasOrgContext && !overridePresets" class="org-indicator">
            (Organization Default)
          </span>
        </label>
        
        <WatermarkSelector
          v-model="settings.watermark"
          :disabled="hasOrgContext && !overridePresets"
          :org-preset="hasOrgContext && !overridePresets"
        />
        
        <!-- Show org preset value when locked -->
        <div v-if="hasOrgContext && !overridePresets" class="preset-value">
          Currently using: {{ orgPresets.watermark.name }}
          <img :src="orgPresets.watermark.preview" class="watermark-preview" />
        </div>
      </div>

      <!-- Similar pattern for other settings... -->
    </div>
  </div>
</template>

<script setup lang="ts">
const overridePresets = ref(false);
const hasOrgContext = computed(() => selectedOrg.value !== null);

// When override toggled OFF, reload org presets
watch(overridePresets, async (isOverride) => {
  if (!isOverride && selectedOrg.value) {
    // Reset to org presets
    settings.value = await loadOrgPresets(selectedOrg.value.creatorProfileId);
  }
});
</script>
```

---

### Storing Override Information

```sql
-- In clips table, track whether org presets were used
ALTER TABLE clips ADD COLUMN used_org_presets BOOLEAN DEFAULT FALSE;

-- Example: Clip built with org presets (no override)
{
  organization_id: "org-123",
  creator_profile_id: "creator-456",
  used_org_presets: true,
  settings_overridden: null  -- No overrides
}

-- Example: Clip built with override
{
  organization_id: "org-123",
  creator_profile_id: "creator-456",
  used_org_presets: false,
  settings_overridden: {  -- JSON of what was changed
    "watermark": { "disabled": true },
    "subtitles": { "style": "custom-style" }
  }
}
```

---

### Analytics: Tracking Preset Usage

Organizations can track how often their presets are used vs. overridden:

```typescript
// Analytics query
SELECT
  cp.name AS creator_name,
  COUNT(*) AS total_clips,
  SUM(CASE WHEN used_org_presets = true THEN 1 ELSE 0 END) AS clips_with_presets,
  SUM(CASE WHEN used_org_presets = false THEN 1 ELSE 0 END) AS clips_overridden,
  ROUND(
    100.0 * SUM(CASE WHEN used_org_presets = true THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) AS preset_usage_rate
FROM clips c
JOIN creator_profiles cp ON c.creator_profile_id = cp.id
WHERE c.organization_id = 'org-123'
GROUP BY cp.id
ORDER BY total_clips DESC;
```

Result:
```
creator_name   | total_clips | clips_with_presets | clips_overridden | preset_usage_rate
---------------|-------------|--------------------|--------------------|------------------
xQc            | 150         | 142                | 8                  | 94.67%
Pokimane       | 98          | 95                 | 3                  | 96.94%
Shroud         | 76          | 70                 | 6                  | 92.11%
```

---

## Implementation Steps

### Phase 1: Database & Backend (Estimated: 2-3 days)

#### Step 1.1: Database Schema
- [ ] Create migration file for new tables (`organizations`, `organization_members`, `organization_creator_assignments`)
- [ ] Add foreign keys and indexes
- [ ] Modify existing tables (`creator_profiles`, `clips`, `projects`)
- [ ] Run migration and test

#### Step 1.2: Rust Backend - Organization CRUD
- [ ] Implement `create_organization` command
- [ ] Implement `get_user_organizations` command
- [ ] Implement `update_organization` command
- [ ] Implement `delete_organization` command
- [ ] Add helper functions (permission checks, etc.)
- [ ] Write unit tests

#### Step 1.3: Rust Backend - Member Management
- [ ] Implement `add_organization_member` command
- [ ] Implement `remove_organization_member` command
- [ ] Implement `get_organization_members` command
- [ ] Implement `update_member_role` command
- [ ] Write unit tests

#### Step 1.4: Rust Backend - Creator Assignment
- [ ] Implement `assign_creator_to_user` command
- [ ] Implement `unassign_creator_from_user` command
- [ ] Implement `get_user_assigned_creators` command
- [ ] Implement `get_organizations_for_creator` command
- [ ] Implement `get_creator_assignments` command
- [ ] Implement `get_user_organization_contexts` command
- [ ] Write unit tests

#### Step 1.5: Rust Backend - Creator Profiles (Modified)
- [ ] Modify `create_creator_profile` to support `organization_id`
- [ ] Implement `create_creator_profile_for_org` command
- [ ] Implement `get_organization_creator_profiles` command
- [ ] Implement `get_creator_profile_presets` command
- [ ] Update `delete_creator_profile` to check permissions
- [ ] Write unit tests

#### Step 1.6: Rust Backend - Upload & Build Commands (Modified)
- [ ] Modify `upload_video_to_project` to accept org context
- [ ] Modify `build_clips` to accept org context and track `used_org_presets`
- [ ] Write unit tests

---

### Phase 2: Frontend - Core Components (Estimated: 3-4 days)

#### Step 2.1: TypeScript Types
- [ ] Define `Organization`, `OrganizationMember`, `AssignedCreatorProfile` interfaces
- [ ] Define `OrganizationContext`, `OrganizationWithRole` interfaces
- [ ] Update existing types to include org context

#### Step 2.2: Organization Dashboard
- [ ] Create `OrganizationDashboard.vue` component
- [ ] Implement organization selector (for multi-org users)
- [ ] Implement tabs (Creator Profiles, Assignments, Members, Analytics)
- [ ] Add creator profile CRUD for admins
- [ ] Style and test

#### Step 2.3: Creator Assignment Manager
- [ ] Create `CreatorAssignmentManager.vue` component
- [ ] Implement assignment interface (assign/unassign users)
- [ ] Add user search/filter
- [ ] Show assignment history
- [ ] Style and test

#### Step 2.4: User Views
- [ ] Create `MyAssignedCreators.vue` component
- [ ] Group creators by organization
- [ ] Add quick actions (Start Clipping, Download VOD)
- [ ] Style and test

#### Step 2.5: Organization Selector Component
- [ ] Create `OrganizationSelector.vue` reusable component
- [ ] Implement preset preview
- [ ] Add "None" option for personal projects
- [ ] Style and test

---

### Phase 3: Frontend - Integration (Estimated: 2-3 days)

#### Step 3.1: Modify Clip Build Settings Dialog
- [ ] Add organization context selector
- [ ] Implement "Override presets" toggle
- [ ] Load org presets when org selected
- [ ] Gray out/lock settings when using org presets
- [ ] Show org banner indicator
- [ ] Test with multiple orgs

#### Step 3.2: Modify Video Upload Dialog
- [ ] Add organization context selector (optional)
- [ ] Show preset preview
- [ ] Implement "Don't apply presets" option
- [ ] Test upload with/without org context

#### Step 3.3: Modify Creator Profiles View
- [ ] Add tabs for Personal vs Assigned profiles
- [ ] Show org-managed badge on assigned profiles
- [ ] Disable editing for org profiles
- [ ] Add override toggle for assigned profiles
- [ ] Test viewing and overriding

#### Step 3.4: Navigation & Routing
- [ ] Add "Organizations" to main navigation (if user is member)
- [ ] Add "My Assignments" to navigation
- [ ] Update routing
- [ ] Test navigation flow

---

### Phase 4: Testing & Polish (Estimated: 2 days)

#### Step 4.1: End-to-End Testing
- [ ] Test organization creation
- [ ] Test member management (add/remove)
- [ ] Test creator profile creation by org
- [ ] Test creator assignment to users
- [ ] Test user seeing assigned creators
- [ ] Test clipping with org presets
- [ ] Test upload with org context
- [ ] Test override functionality
- [ ] Test multi-org scenario (same creator, different orgs)

#### Step 4.2: Edge Cases
- [ ] Test organization deletion (cascade deletes)
- [ ] Test removing user from org (assignments removed)
- [ ] Test permissions (members can't edit org profiles)
- [ ] Test assigning creator not in org (should fail)
- [ ] Test non-member trying to use org presets (should fail)

#### Step 4.3: UI/UX Polish
- [ ] Add loading states
- [ ] Add error handling and user feedback
- [ ] Add confirmation dialogs (delete, remove, etc.)
- [ ] Improve empty states
- [ ] Responsive design check
- [ ] Accessibility check

#### Step 4.4: Documentation
- [ ] Write user guide for organization admins
- [ ] Write user guide for team members
- [ ] Add tooltips and help text
- [ ] Create video tutorial (optional)

---

### Phase 5: Analytics & Reporting (Optional, Estimated: 1-2 days)

#### Step 5.1: Organization Analytics
- [ ] Implement clip count by creator
- [ ] Track preset usage rate
- [ ] Show override frequency
- [ ] Display user activity
- [ ] Export reports

---

## Code Examples

### Example: Complete Org Creation Flow

```typescript
// Frontend: CreateOrganizationDialog.vue
async function createOrganization() {
  try {
    const org = await invoke('create_organization', {
      name: orgName.value,
      description: orgDescription.value,
      logoPath: uploadedLogo.value,
      ownerEmail: currentUser.email
    });

    console.log('Organization created:', org);

    // Navigate to organization dashboard
    router.push(`/organizations/${org.id}`);
  } catch (error) {
    console.error('Failed to create organization:', error);
    showError('Failed to create organization');
  }
}
```

```rust
// Backend: commands/organizations.rs
#[tauri::command]
pub async fn create_organization(
    name: String,
    description: Option<String>,
    logo_path: Option<String>,
    owner_email: String,
    app_state: State<'_, AppState>,
) -> Result<Organization, String> {
    let db = &app_state.db;
    let org_id = Uuid::new_v4().to_string();
    
    // Begin transaction
    let tx = db.transaction()?;
    
    // Create organization
    tx.execute(
        "INSERT INTO organizations (id, name, description, logo_path, owner_email) 
         VALUES (?, ?, ?, ?, ?)",
        params![org_id, name, description, logo_path, owner_email],
    )?;
    
    // Auto-add owner as admin member
    let member_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO organization_members (id, organization_id, user_email, role) 
         VALUES (?, ?, ?, ?)",
        params![member_id, &org_id, owner_email, "owner"],
    )?;
    
    tx.commit()?;
    
    Ok(Organization {
        id: org_id,
        name,
        description,
        logo_path,
        owner_email,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}
```

---

### Example: Loading Org Presets in Clip Builder

```typescript
// ClipBuildSettingsDialog.vue
async function loadOrganizationPresets(orgContext: OrganizationContext) {
  try {
    // Fetch preset settings from creator profile
    const presets = await invoke('get_creator_profile_presets', {
      creatorProfileId: orgContext.creatorProfileId
    });

    // Parse watermark settings (per-ratio)
    const watermarkSettings = JSON.parse(presets.watermark_settings || '{}');
    
    // Parse subtitle settings
    const subtitleSettings = JSON.parse(presets.subtitle_settings || '{}');

    // Populate settings
    settings.value = {
      watermark: {
        enabled: true,
        watermarkId: watermarkSettings.default_watermark_id,
        perRatioSettings: watermarkSettings.per_ratio || {},
        ...watermarkSettings
      },
      intro: {
        enabled: !!presets.intro_id,
        introId: presets.intro_id
      },
      outro: {
        enabled: !!presets.outro_id,
        outroId: presets.outro_id
      },
      subtitles: subtitleSettings,
      aspectRatios: watermarkSettings.default_aspect_ratios || ['16:9']
    };

    console.log('Loaded org presets:', settings.value);
  } catch (error) {
    console.error('Failed to load org presets:', error);
  }
}
```

---

### Example: Checking Multi-Org Assignment

```typescript
// When user opens clip builder for a creator
async function checkOrganizationContexts(creatorName: string) {
  const contexts = await invoke('get_organizations_for_creator', {
    userEmail: currentUser.email,
    creatorName: creatorName
  });

  if (contexts.length === 0) {
    // No organization assignment, use personal settings
    usePersonalSettings();
  } else if (contexts.length === 1) {
    // Single org, auto-select it
    selectedOrgContext.value = contexts[0];
    await loadOrganizationPresets(contexts[0]);
  } else {
    // Multiple orgs, show selector
    showOrgSelector.value = true;
    availableOrgs.value = contexts;
  }
}
```

---

### Example: Override Toggle Behavior

```typescript
// When user toggles override
watch(overridePresets, async (isOverride) => {
  if (isOverride) {
    // Switching TO override mode
    // Keep current settings (which are org presets), but make them editable
    settingsLocked.value = false;
    showOverrideBanner.value = true;
  } else {
    // Switching OFF override mode (back to org presets)
    // Reload org presets (discards any user changes)
    if (selectedOrgContext.value) {
      const confirmed = confirm(
        'This will discard your custom changes and reload organization presets. Continue?'
      );
      
      if (confirmed) {
        await loadOrganizationPresets(selectedOrgContext.value);
        settingsLocked.value = true;
        showOverrideBanner.value = false;
      } else {
        // User cancelled, keep override enabled
        overridePresets.value = true;
      }
    }
  }
});
```

---

## Summary

This organization-level system provides:

✅ **Standardization** - Companies can ensure consistent clip generation across team members  
✅ **Flexibility** - Users retain full autonomy and can override when needed  
✅ **Scalability** - Supports users working for multiple organizations  
✅ **Optional** - Completely opt-in, doesn't affect independent users  
✅ **Tracking** - Organizations can see usage analytics and preset adoption  

The implementation follows these principles:
- Organization settings are **smart defaults**, not restrictions
- Users can **always** create personal profiles and use all features
- **Override toggle** allows one-off customization
- **Multi-org support** handles same creator across different organizations
- **Manual uploads** can optionally apply org presets

---

**Total Estimated Implementation Time: 10-14 days**

---

*End of Document*

