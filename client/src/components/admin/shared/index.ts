/**
 * Shared admin building blocks — every /admin page uses these so the admin
 * area reads as one product. Each component documents its usage in a header
 * comment. Generic building blocks they use live in `@/components/ui`:
 * DataTable (list tables), SectionCard (card sections), InfoRow (label /
 * value rows), SettingRow (label + control rows), ToggleChips (multi-select
 * chips), StatGrid + StatCard (metric rows), Avatar.
 *
 * - AdminRowActions  "⋯" row menu trigger + content; children are items.
 * - AdminActionItem  menu item with icon, `destructive`, `loading`.
 * - AdminFilterBar   SearchField + filters + count + end actions for
 *                    PageLayout's `#toolbar`.
 * - AdminDetailHeader identity header for detail pages (avatar, title,
 *                    badges, subtitle, meta, actions, optional back link).
 * - statusVariant / formatStatus  status word → Badge variant / label.
 * - RichTextEditor   tiptap editor with Visual / HTML / Preview modes
 *                    (announcements, email campaigns). Import it directly
 *                    from './RichTextEditor.vue' so tiptap stays out of
 *                    pages that only need the helpers above.
 *
 * Page conventions (keep consistent across admin pages):
 * - PageLayout title = page name (sentence case), breadcrumbs Admin › Page;
 *   one primary action in `#actions` (+ an icon-only refresh button).
 * - Search/filters/count/export in `#toolbar` via AdminFilterBar.
 * - Content `px-5 py-4 flex flex-col gap-4`; metrics as StatCards inside
 *   <StatGrid :count="n">; tone only for status-like counts (e.g.
 *   Active → success), everything else neutral. Detail sections are
 *   <SectionCard>s holding InfoRow / SettingRow lists.
 * - Errors: EmptyState with tone="danger" + "Try again" button.
 */
export { default as AdminRowActions } from './AdminRowActions.vue';
export { default as AdminActionItem } from './AdminActionItem.vue';
export { default as AdminFilterBar } from './AdminFilterBar.vue';
export { default as AdminDetailHeader } from './AdminDetailHeader.vue';
export { statusVariant, formatStatus } from './status';
