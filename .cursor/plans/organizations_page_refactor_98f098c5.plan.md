---
name: Organizations Page Refactor
overview: Refactor both the Organizations listing page and OrganizationDashboard component to match the modern design patterns used in Projects.vue and Billing.vue, converting Tailwind classes to custom BEM-style CSS with consistent styling.
todos:
  - id: orgs-listing
    content: Refactor Organizations.vue with BEM CSS, modern cards, and skeleton loaders
    status: completed
  - id: dashboard-header
    content: Refactor OrganizationDashboard header and tabs to match Billing.vue style
    status: completed
    dependencies:
      - orgs-listing
  - id: dashboard-members
    content: Refactor Members tab with modern card styling and accent indicators
    status: completed
    dependencies:
      - dashboard-header
  - id: dashboard-other-tabs
    content: Refactor remaining tabs (Creators, Campaigns, Assets, etc.) with consistent styling
    status: completed
    dependencies:
      - dashboard-members
  - id: dashboard-modals
    content: Refactor all modal dialogs to match Billing.vue modal patterns
    status: completed
    dependencies:
      - dashboard-other-tabs
---

# Organizations Page Refactor Plan

## Overview

Refactor both `Organizations.vue` and `OrganizationDashboard.vue` to match the modern design patterns established in `Projects.vue` and `Billing.vue`. This involves converting Tailwind utility classes to custom BEM-style CSS classes with consistent naming conventions and CSS variables.

## Design Patterns to Implement

The target pages use these consistent patterns:

- **CSS class prefixes**: `{page-name}__` (e.g., `org__content`, `org-dashboard__`)
- **CSS variables**: `var(--sidebar-text)`, `var(--sidebar-accent)`, `var(--sidebar-surface)`, etc.
- **Card styling**: Left accent indicators with rounded corners
- **Skeleton loaders**: Shimmer animation with gradient backgrounds
- **Section headers**: Icon + text pattern with consistent spacing
- **Typography**: `letter-spacing: -0.02em` for titles, muted subtitles

## Files to Modify

### 1. [client/src/pages/Organizations.vue](client/src/pages/Organizations.vue)

**Current state**: ~240 lines, uses Tailwind classes**Changes**:

- Add page heading section with title/subtitle (like Projects page "Your Projects")
- Replace Tailwind with BEM-style CSS classes (`org__content`, `org__card`, `org__grid`)
- Add modern skeleton loading with shimmer animation
- Style organization cards with left accent indicators
- Add proper header actions slot styling
- Implement consistent card hover states

### 2. [client/src/components/OrganizationDashboard.vue](client/src/components/OrganizationDashboard.vue)

**Current state**: ~3547 lines, uses Tailwind classes throughout**Changes**:

- Convert page header to match Billing.vue style
- Replace all Tailwind classes with BEM CSS (`org-dashboard__header`, `org-dashboard__tabs`, etc.)
- Modernize tab styling to match Projects.vue folder dialog tabs
- Update member cards with accent indicators
- Style all form inputs, buttons, and modals consistently
- Add proper skeleton loaders for each tab content
- Style credit allocation section like Billing.vue cards

## Key CSS Class Structure

```javascript
Organizations.vue:
- .org__content, .org__heading, .org__title, .org__subtitle
- .org__grid, .org__card, .org__card-indicator
- .org__card-logo, .org__card-info, .org__card-credits
- .org__empty, .org-skeleton__*

OrganizationDashboard.vue:
- .org-dashboard__header, .org-dashboard__header-icon
- .org-dashboard__tabs, .org-dashboard__tab, .org-dashboard__tab--active
- .org-dashboard__section, .org-dashboard__section-header
- .org-dashboard__member-card, .org-dashboard__member-avatar
- .org-dashboard__modal, .org-dashboard__modal-overlay
```



## Implementation Notes

- Preserve all existing functionality (data loading, API calls, event handlers)
- Keep Vue component logic unchanged; only modify template classes and add scoped styles