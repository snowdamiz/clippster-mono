---
name: Destructive Dialogs Red Theme
overview: Add `variant="destructive"` prop to all ConfirmationModal usages that perform destructive actions (delete, remove) to ensure they use the red color theme instead of the default blue theme.
todos:
  - id: add-variant-assets
    content: Add `variant="destructive"` to ConfirmationModal in Assets.vue
    status: completed
  - id: add-variant-creator-profiles
    content: Add `variant="destructive"` to ConfirmationModal in CreatorProfiles.vue
    status: completed
  - id: add-variant-video-editor
    content: Add `variant="destructive"` to ConfirmationModal in VideoEditor.vue
    status: completed
  - id: add-variant-projects
    content: Add `variant="destructive"` to both ConfirmationModals in Projects.vue
    status: completed
  - id: add-variant-clips
    content: Add `variant="destructive"` to ConfirmationModal in Clips.vue
    status: completed
  - id: add-variant-workspace-dialog
    content: Add `variant="destructive"` to ConfirmationModal in ProjectWorkspaceDialog.vue
    status: completed
  - id: add-variant-timeline
    content: Add `variant="destructive"` to Delete Segments ConfirmationModal in Timeline.vue
    status: completed
  - id: delete-unused-component
    content: Delete unused DeleteConfirmationModal.vue component
    status: completed
---

# Destructive Dialogs Red Theme Refactor

## Current State

The app has a `ConfirmationModal` component at [`client/src/components/ConfirmationModal.vue`](client/src/components/ConfirmationModal.vue) that supports a `variant` prop with values `'default' | 'destructive'`. When `variant="destructive"` is set, the modal displays:

- Red accent bar (`#ef4444`)
- Red icon background
- Red confirm button (`#ef4444` to `#dc2626` gradient)
- Warning triangle icon

However, several delete/destructive dialogs are using the default blue theme because they're not passing `variant="destructive"`.

## Files That Need `variant="destructive"` Added

The following files use `ConfirmationModal` for destructive actions but are missing the `variant="destructive"` prop:

1. **[`client/src/pages/Assets.vue`](client/src/pages/Assets.vue)** (line ~467)

   - Delete Asset dialog

2. **[`client/src/pages/CreatorProfiles.vue`](client/src/pages/CreatorProfiles.vue)** (line ~707)

   - Delete Creator dialog

3. **[`client/src/pages/VideoEditor.vue`](client/src/pages/VideoEditor.vue)** (line ~232)

   - Delete Project dialog

4. **[`client/src/pages/Projects.vue`](client/src/pages/Projects.vue)** (lines ~978, ~990)

   - Bulk Delete Projects dialog
   - Bulk Delete Segments dialog

5. **[`client/src/pages/Clips.vue`](client/src/pages/Clips.vue)** (line ~504)

   - Delete Build dialog

6. **[`client/src/components/ProjectWorkspaceDialog.vue`](client/src/components/ProjectWorkspaceDialog.vue)** (line ~151)

   - Delete Clip dialog

7. **[`client/src/components/Timeline.vue`](client/src/components/Timeline.vue)** (line ~165)

   - Delete Segments dialog

## Files Already Using Destructive Variant Correctly

These files are already correctly styled:

- `AdminBugReports.vue` - Delete Bug Report
- `AdminOrgApplications.vue` - Delete Application
- `AdminUsers.vue` - Cancel Subscription
- `Organizations.vue` - Delete Application

## Custom Inline Dialogs Already Styled Correctly

These have their own red styling implemented inline:

- `OrganizationAssets.vue` - Delete Asset (uses `org-dialog--red`)
- `OrganizationMembers.vue` - Remove Member (uses `org-dialog--red`)
- `OrganizationShared.vue` - Delete Shared Clip (uses `--danger` classes)
- `OrganizationSocial.vue` - Disconnect Account (uses `--danger` classes)
- `Clips.vue` - Bulk Delete dialogs (uses `from-red-600 to-red-700`)
- `SharedClipsList.vue` - Delete (uses `Button variant="destructive"`)

## Non-Destructive Dialogs (Should Remain Blue)

These dialogs should NOT be changed as they are not truly destructive:

- `AdminUsers.vue` - Promote User (enhancement, not destruction)
- `ClipEditorDialog.vue` - Clear In Editor (status change)
- `LiveClip.vue` - Credit Warning (informational)
- `Timeline.vue` - Merge Segments (combining, not deleting)
- `Timeline.vue` - Warning Modal (information only)
- `DownloadCard.vue` - Cancel Download (can restart)

## Unused Component to Delete

**[`client/src/components/DeleteConfirmationModal.vue`](client/src/components/DeleteConfirmationModal.vue)** - This component is not used anywhere in the codebase and uses the blue theme inappropriately for a delete modal. It should be deleted to avoid confusion.

## Implementation

For each file listed above, add `variant="destructive"` to the `ConfirmationModal` component:

```vue
<ConfirmationModal
  :show="showDeleteDialog"
  title="Delete Item"
  message="Are you sure you want to delete"
  variant="destructive"
  ...
/>
```