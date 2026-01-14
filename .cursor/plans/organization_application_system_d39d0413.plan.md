---
name: Organization Application System
overview: Convert organization creation from self-service to an application-based system requiring admin approval. Users will apply through a dialog, and admins will review applications in a new admin page.
todos:
  - id: remove-create-flow
    content: Remove organization creation from AccountTypeDialog, OrganizationSelector, and delete wizard
    status: completed
  - id: application-dialog
    content: Create OrganizationApplicationDialog.vue with detailed form fields
    status: completed
  - id: update-orgs-page
    content: Update Organizations.vue to use apply dialog instead of create button
    status: completed
  - id: backend-migration
    content: Create Elixir migration for organization_applications table
    status: completed
  - id: backend-schema
    content: Create OrganizationApplication schema and context functions
    status: completed
    dependencies:
      - backend-migration
  - id: backend-api
    content: Add API endpoints for submit, list, approve, reject applications
    status: completed
    dependencies:
      - backend-schema
  - id: admin-page
    content: Create AdminOrgApplications.vue with table and actions
    status: completed
    dependencies:
      - backend-api
  - id: admin-routing
    content: Add admin route and navigation link to hub
    status: completed
    dependencies:
      - admin-page
---

# Organization Application System

## Overview

Replace the self-service organization creation wizard with an application-based flow where users submit applications for admin review and approval.

## Architecture

```mermaid
flowchart LR
    subgraph frontend [Frontend]
        OrgPage[Organizations.vue]
        AppDialog[OrgApplicationDialog.vue]
        AdminPage[AdminOrgApplications.vue]
    end
    
    subgraph backend [Backend API]
        SubmitAPI[POST /org-applications]
        ListAPI[GET /admin/org-applications]
        ApproveAPI[PUT approve]
        RejectAPI[PUT reject]
    end
    
    subgraph database [Database]
        AppTable[organization_applications]
        OrgTable[organizations]
    end
    
    OrgPage --> AppDialog
    AppDialog --> SubmitAPI
    AdminPage --> ListAPI
    AdminPage --> ApproveAPI
    AdminPage --> RejectAPI
    SubmitAPI --> AppTable
    ApproveAPI --> OrgTable
```

## Frontend Changes

### 1. Remove Organization Creation Flow

- **[`AccountTypeDialog.vue`](client/src/components/AccountTypeDialog.vue)**: Remove organization option, always create personal accounts and redirect to `/projects`
- **[`OrganizationSelector.vue`](client/src/components/OrganizationSelector.vue)**: Remove "Create Organization" link from footer
- **[`router/index.ts`](client/src/router/index.ts)**: Remove `/organization/setup` route
- Delete [`OrganizationSetupWizard.vue`](client/src/components/OrganizationSetupWizard.vue)

### 2. Create Application Dialog

- New component `client/src/components/OrganizationApplicationDialog.vue`
- Fields: organization name, description, website/social links, team size, use case, contact email
- Style matching [`BugReportDialog.vue`](client/src/components/BugReportDialog.vue) pattern

### 3. Update Organizations Page

- **[`Organizations.vue`](client/src/pages/Organizations.vue)**: Replace "Create Organization" button with "Apply for Organization" button that opens the application dialog

### 4. Add Admin Page

- New page `client/src/pages/admin/AdminOrgApplications.vue`
- Table view with filters (status: pending/approved/rejected)
- Actions: Approve (creates org), Reject, Delete
- Style matching [`AdminBugReports.vue`](client/src/pages/admin/AdminBugReports.vue)
- Add route `/admin/org-applications` and nav item in [`AdminHub.vue`](client/src/pages/admin/AdminHub.vue)

## Backend Changes (Elixir/Phoenix)

### 5. Database Migration

- New table `organization_applications`:
- `id`, `user_id`, `name`, `description`, `website`, `team_size`, `use_case`, `contact_email`
- `status` (pending/approved/rejected), `admin_notes`, `reviewed_by_id`, `reviewed_at`
- `inserted_at`, `updated_at`

### 6. Schema and Context

- New schema `ClippsterServer.Organizations.OrganizationApplication`
- Functions: `create_application/2`, `list_applications/1`, `approve_application/2`, `reject_application/2`

### 7. API Endpoints

- `POST /api/organization-applications` - submit application (authenticated)
- `GET /api/admin/organization-applications` - list all (admin only)
- `PUT /api/admin/organization-applications/:id/approve` - creates organization from application
- `PUT /api/admin/organization-applications/:id/reject` - marks rejected with optional notes
- `DELETE /api/admin/organization-applications/:id` - removes application

## Application Flow

1. User clicks "Apply for Organization" on `/organizations`
2. Dialog collects detailed info, submits to API
3. Admin sees pending applications at `/admin/org-applications`