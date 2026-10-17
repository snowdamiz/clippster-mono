# Clippster desktop design system

The desktop client is a dense, dark, desktop-first UI. It ships at a default
window of **1120 × 680** and must still work at the **800 × 600** minimum.
Everything below exists so screens look like one product and so we stop
re-implementing the same pieces in every file.

## Principles

1. **Tokens, not values.** Never hard-code colors. Use the semantic tokens in
   `styles/theme.css` (CSS: `var(--surface)`) or their Tailwind utilities
   (`bg-surface`, `text-fg-muted`, `border-line`, `bg-brand`, ...).
2. **Primitives, not one-offs.** Buttons, inputs, selects, modals, badges,
   empty states and search boxes come from `@/components/ui/*`. Do not write a
   new overlay, button style or search box in a page.
3. **Quiet by default.** One accent color (sky, `--brand`). Status colors only
   carry status. No decorative gradients, glows, colored left-border "accent
   bars", or colored top bars on modals. Depth comes from surface steps and
   hairline borders, not shadows.
4. **Dense but breathable.** 13px body text, 32px controls, 4px spacing grid.
   Page gutters are `px-5` (20px); gaps between cards `gap-3`/`gap-4`.
5. **No duplicate headings.** The page header already names the page. Do not
   repeat it as a big H1 + subtitle inside the content.
6. **Few frames.** A bordered box has to earn its place (see "Cards" below).
   Content sits on the panel, separated by headings, spacing and hairlines.
7. **In proportion with the sidebar.** The sidebar is 13px text, 16px icons and
   31px rows; main content should feel like the same app. Body text stays
   13px, list/table rows 40px, icons 16px. Big numbers are `text-lg` at most,
   avatars in page headers `lg` (40px) at most, icon tiles `md` (32px) in rows.

## Color tokens

| Token | Utility | Use |
| --- | --- | --- |
| `--canvas` | `bg-canvas` | Window chrome: title bar, sidebar |
| `--panel` | `bg-panel` | Main content panel background |
| `--surface` | `bg-surface` | Cards, list rows, sections |
| `--surface-raised` | `bg-surface-raised` | Inputs, popovers, menus, modals |
| `--surface-sunken` | `bg-surface-sunken` | Wells inside cards (previews, code) |
| `--surface-hover` / `--surface-active` | `bg-surface-hover` / `bg-surface-active` | Translucent hover / selected washes |
| `--line-subtle` / `--line` / `--line-strong` | `border-line-subtle` ... | Hairlines, from dividers to input borders |
| `--fg` / `--fg-muted` / `--fg-subtle` / `--fg-disabled` | `text-fg` ... | Primary, secondary, tertiary, disabled text |
| `--brand` (+ `-hover`, `-soft`, `-line`, `-fg`) | `text-brand`, `bg-brand-soft` ... | Focus, selection, active state, links, progress |
| `--success` `--warning` `--danger` (+ `-soft`, `-line`) | `text-success`, `bg-danger-soft` ... | Status only |
| `--ai` (+ `-soft`, `-line`) | `text-ai`, `bg-ai-soft` | Marks AI-powered features — sparingly |
| `--live` | `bg-live` | "Live now" indicators |

The Tailwind `zinc`/`gray`/`neutral`/`slate` palettes are remapped onto the
same cool neutral scale, so legacy `text-zinc-400` stays on-palette — but
prefer the semantic utilities in new code.

## Type

- Body: `text-sm` (13px). Secondary: `text-xs` (12px). Micro labels: `text-2xs` (11px).
- Section titles: `text-sm font-semibold`. Modal titles: 15px semibold.
- Page-level display text (rare, e.g. empty first-run states): `text-base`/`text-lg` semibold.
- Small uppercase labels: the `.eyebrow` class. Numbers that change: `.tabular`.

## Layout

- `PageLayout` renders the 52px page header: title (+ optional `#badge`) on the
  left, `#actions` on the right. Keep **one** primary action in the header.
- Put filters, sort selects, view switches and tabs in the `#toolbar` slot —
  a secondary row under the header — instead of cramming them into `#actions`.
  Toolbar controls use the default `md` size (32px); the row is 48px tall and
  wraps on narrow windows. While items are selected, swap its contents for
  `<SelectionBar>` (`@/components/ui/selection-bar`).
- Content padding: `px-5 py-4`. Collection grids (media tiles, project /
  creator / campaign cards) use the `card-grid` utility: auto-fill columns
  with a `--card-grid-min` of 220px, so tiles stay ~230–290px wide at any
  window size. Text-heavy cards raise the minimum on the grid, e.g.
  `card-grid [--card-grid-min:17.5rem]` for campaign cards.
- Must not overflow horizontally at 1120px or 800px window widths.

## Cards

Cards are for **collections of things** (a grid of campaigns, projects, media)
and for **one framed group** of related rows (a table, a `ListGroup`, a
`SectionCard` of settings). Everything else sits on the panel.

- **Never nest frames.** No bordered or filled box inside a card: inside a card
  use spacing, `border-t border-line-subtle` dividers, `StatGrid size="sm"` or
  `InfoList`. The only exception is a `bg-surface-sunken` well for media
  previews or code.
- **Key figures are one strip.** A row of stats is one `<StatGrid>` (cells
  divided by hairlines), never N separate stat cards. Inside cards, dialogs and
  headers use `<StatGrid size="sm">` (no frame at all).
- **Navigation/tool lists are one list.** A set of links ("Members", "Billing",
  "Settings"...) is one `<ListGroup :columns>` of `<ListItem>` rows, not a grid
  of link cards.
- **Headers and heroes are not cards.** A profile/entity header (avatar, name,
  meta, figures, actions) sits directly on the panel, separated from what
  follows by a hairline (`border-b border-line-subtle pb-4`).
- **One frame per section.** A table or list section is `SectionHeader` + the
  framed `DataTable`/`ListGroup`, or a single `SectionCard`. Don't wrap a
  `SectionCard` in another box, and don't put a lone sentence in a card.
- **Collection cards stay lean.** Image/cover on top, then title, one line of
  meta, a hairline and at most one row of key figures. No inner boxes, no
  empty decorative banner areas taller than the content.

## Motion and loading

Nothing should pop in. Motion is short (`--duration-base` 180ms), small (4px)
and only on things that **enter**:

- Pages fade/rise in through the layouts' enter-only `page` transition — do
  not add your own page-level transition.
- **Tab panels**: whatever switches content (`SegmentedControl`, custom tab
  rows) keys the panel so it remounts and eases in:
  `<div :key="activeTab" class="animate-enter">…</div>`. reka `<TabsContent>`
  does this already. Don't animate the leaving panel (no `out-in`).
- **Data replacing a skeleton** eases in: put `animate-enter` (or
  `animate-fade-in` for rows/grids) on the loaded content's wrapper.
- **Skeletons never flash.** Every `.skeleton` block stays invisible for
  `--skeleton-delay` (150ms) and then fades in, so fast loads go straight to
  content. A skeleton *layout* with its own borders/backgrounds (placeholder
  cards) gets the `skeleton-group` class on its wrapper for the same delay —
  or better, draw the placeholder with `.skeleton` blocks only.
- Spinners (`animate-spin`) get the same 150ms grace period automatically,
  so quick actions and loads never flash one. Loading *text* ("Loading…")
  needs `skeleton-group` for the same effect.
- **Skeletons only on the first load.** Refetches (tab switches, filters,
  pagination, polling) keep showing the current data:
  `v-if="loading && !items.length"`, never plain `v-if="loading"` in front of
  data that is already on screen. Show refetch progress, if at all, with a
  button `loading` state or a small spinner.
- During the skeleton delay show nothing new — never flash an empty state
  while the first load is still running (`v-else-if="!loading && !items.length"`
  or order the branches so loading wins).
- Hover/press feedback uses `transition-colors duration-[var(--duration-fast)]`.
  Respect `prefers-reduced-motion` (the utilities already do).

## Components (`@/components/ui`)

| Need | Use |
| --- | --- |
| Any button | `<Button variant size>` — variants: `primary` (one per view), `secondary` (default for most), `ghost` (toolbars/rows), `subtle`, `outline`, `brand`, `destructive`, `destructive-soft`, `link`; sizes `xs` `sm` `md` `lg`, `icon-xs` `icon-sm` `icon` `icon-lg`. `loading` prop shows a spinner. For links use `buttonVariants()` on the element. |
| Dialog / modal | `<Modal v-model:open title description :icon size>` with `#footer` for actions. Sizes `sm`(400) `md`(480) `lg`(640) `xl`(820) `2xl`(1040) `full`. Never hand-roll an overlay. |
| Confirm / destructive confirm | `ConfirmationModal` (built on `Modal`), or imperatively `await confirmDialog({...})` from `@/composables/useDialogs` |
| Taking a payment | `BuyCreditsDialog` (credit packs) or `SubscribeDialog` (plans) — both run on `usePaymentCheckout` (Stripe / Phantom windows, cancel, double-click guard). Promo codes: `usePromoCode` + `components/billing/PromoCodeField`. Never write another payment flow |
| Screen with unsaved edits | `useUnsavedChanges(() => isDirty, { title, message })` in the routed page — asks before leaving the route and before quitting the app |
| Ask for one line of text | `await promptDialog({ title, label, defaultValue })` from `@/composables/useDialogs` |
| Error / success feedback | `useToast().error(title, description)` / `.success(...)` — never `alert()` |
| Text input / textarea | `<Input>`, `<Textarea>` wrapped in `<Field label hint error>` |
| Select | `<Select>` (reka) or `CustomDropdown` (options array; works in Modals; `id` / `disabled` / `aria-label` go to the trigger; width classes replace `w-full`) |
| Search box | `<SearchField v-model placeholder>`; for pages whose search lives in the search palette, `SearchPaletteTrigger` (`components/`) with `:query` + `@open` / `@clear` |
| 2–5 way switch / view toggle / simple tabs | `<SegmentedControl v-model :options>` |
| Content tabs with panels | `<Tabs>` |
| Toggle / checkbox / radio | `<Switch>`, `<Checkbox>`, `<RadioGroup>` |
| Multi-select chips (tags, platforms, tiers) | `<ToggleChips v-model :options :max>` (also emits `toggle`) |
| File pick / drop area | `<Dropzone title hint :icon>` (`@select` for native dialogs; `accept` + `@files` for the browser input; `compact` row with `:file`), then `<FileRow>` for the picked file |
| Status / label pill | `<Badge variant>` — `neutral` `brand` `success` `warning` `danger` `ai` `live` `outline` |
| Empty / zero / no-results state | `<EmptyState :icon title description>` + action buttons in the default slot |
| Section heading inside a page | `<SectionHeader title :count description>` + actions in default slot |
| Card section (header inside the card) | `<SectionCard title :icon :count description flush>` + `#actions`, `#footer`. Settings dialogs (title above a divided card) use `components/settings/SettingsSection` |
| Label / value details | `<InfoList :rows>` or `<InfoRow label mono>value</InfoRow>` children; `compact` for summaries in confirm dialogs |
| Setting with a control | `<SettingRow label description :icon>` + control in the slot (`inset` inside full-bleed lists, `tone="danger"`) |
| List table | `<DataTable :columns :rows row-key>` with `#cell-<key>` slots, sorting, `hideBelow`, skeleton/empty states, `#actions`, `#footer` |
| Key figures | `<StatGrid :count>` of `<StatCard label value :icon tone hint>` — one framed strip with hairline dividers; `<StatGrid size="sm" :items>` for inside cards/dialogs/headers (no frame). `icon` is a small glyph before the label. A lone `StatCard` renders as a framed tile |
| Navigation / tool list | `<ListGroup :columns>` of `<ListItem title description :icon :to>` (`@click`, `#trailing`, `#leading`, `disabled`) |
| Icon in a rounded tile | `<IconTile :icon tone size>` |
| Platform logo (Kick, Twitch, YouTube, X, TikTok, Instagram, Snapchat, `manual` uploads, ...) | `<PlatformLogo :platform size shape>` — never write another platform icon component |
| Person / org / conversation avatar | `<Avatar :src :name :icon size shape tone>` — image → icon → initials; `shape="square"` + `Building2` for organizations; `tone="ai"` for the assistant |
| Card container | `<Card>` or `rounded-xl border border-line-subtle bg-surface` |
| Media grid tile (libraries, pickers) | `<MediaTile :title :thumbnail :meta selectable>` + `#badges` (`<MediaChip>` labels), `#actions`, `#overlay`; lay out Create-tool project grids with `components/create/ProjectGrid` |
| Bulk selection toolbar | `<SelectionBar :count :total>` in the page `#toolbar` |
| Chat message / composer | `components/messaging/MessageBubble` (`readonly` for read-only threads) and `MessageComposer` (`hide-attach send-on-enter` for text-only) |
| Loading placeholder | `.skeleton` class on sized blocks (delayed fade-in built in); `skeleton-group` on a placeholder layout wrapper |
| Content entering | `animate-enter` (fade + 4px rise), `animate-fade-in`; key tab panels with `:key` |
| Menus | `<DropdownMenu>` |
| Tooltips | `v-tooltip` directive or `title` |

`Avatar` and `PlatformLogo` are dependency-free (no `cn()` / reka / cva) so the
browser app (`apps/web`) can render them too; keep them that way. Their extra
classes are appended through attribute fallthrough (no tailwind-merge), so
pick sizes with the `size` prop instead of overriding `size-*` classes.

## Patterns to remove when you touch a file

- Centered modal headers with a big icon tile and a colored top "accent bar".
- `linear-gradient(...)` buttons/backgrounds; neon `box-shadow: 0 0 Npx` glows.
- Colored left-border bars on cards.
- Multiple accent hues (purple, indigo, cyan, pink) used as "primary".
- Hand-written button/input/select CSS that duplicates the primitives.
- Big in-content H1 + description repeating the page header.
- Custom scrollbar CSS (global styles already handle scrollbars).
- Native `alert()` / `confirm()` / `prompt()` — use toasts and `useDialogs`.
- Hand-rolled menus or popovers teleported to `<body>` — they can't be clicked
  inside a `Modal`. Use `DropdownMenu`, `Select`, `CustomDropdown` or reka `Popover`.

## Layering (z-index)

| Layer | z-index |
| --- | --- |
| Page content, sticky headers | 0–50 |
| Chat windows | 10001 |
| `Modal` / `Dialog` / `Sheet` | 10040 |
| Menus, selects, popovers (`DropdownMenu`, `Select`, `CustomDropdown`) | 10060 |
| Tooltips | 10070 (directive: 99999) |
| Toasts | 10100 |
| Title bar (window chrome) | 99999 |

New overlays should use `Modal` and inherit this ladder rather than picking numbers.
