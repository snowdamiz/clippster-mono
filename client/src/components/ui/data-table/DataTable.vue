<script setup lang="ts" generic="Row">
  /**
   * The list table: compact header row (sortable columns optional), rows
   * rendered through per-column slots, skeleton loading, empty state, a
   * row-end actions column and an optional footer (pagination). Used by every
   * admin list, billing/payment history and affiliate tables.
   *
   *   <DataTable
   *     :columns="[
   *       { key: 'name', label: 'Name', sortable: true },
   *       { key: 'plan', label: 'Plan', width: '120px', hideBelow: 'md' },
   *       { key: 'created', label: 'Created', width: '110px', align: 'right' },
   *     ]"
   *     :rows="users"
   *     row-key="id"
   *     :loading="loading"
   *     :sort-key="sortColumn"
   *     :sort-direction="sortDirection"
   *     clickable
   *     empty-title="No users found"
   *     @sort="toggleSort"
   *     @row-click="(user) => open(user.id)"
   *   >
   *     <template #cell-name="{ row }">{{ row.name }}</template>
   *     <template #actions="{ row }">
   *       <AdminRowActions>
   *         <AdminActionItem :icon="Pencil" @select="edit(row)">Edit</AdminActionItem>
   *       </AdminRowActions>
   *     </template>
   *     <template #footer><PaginationFooter mode="static" ... /></template>
   *   </DataTable>
   *
   * Cells without a slot print `row[column.key]`. Long text should be wrapped
   * in `truncate` (cells are `min-w-0` inside a fixed table layout). Columns
   * with `hideBelow` disappear when the table gets narrow (container query),
   * and the table scrolls horizontally inside its card as a last resort.
   *
   * Expandable rows: pass `:expanded="(row) => openId === row.id"` and fill
   * the `#expanded="{ row }"` slot; it renders as a full-width row below.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import type { DataTableColumn, SortDirection } from './types';
  import { computed, useSlots } from 'vue';
  import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-vue-next';
  import { EmptyState } from '@/components/ui/empty-state';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      columns: DataTableColumn[];
      rows: Row[];
      /** Property name or function that returns a stable key for each row. */
      rowKey: string | ((row: Row) => string | number);
      loading?: boolean;
      skeletonRows?: number;
      sortKey?: string | null;
      sortDirection?: SortDirection;
      /** Rows get a pointer + hover state and emit `row-click`. */
      clickable?: boolean;
      rowClass?: (row: Row) => HTMLAttributes['class'];
      expanded?: (row: Row) => boolean;
      /** Drop the card chrome (border/background) when embedding in a card. */
      bare?: boolean;
      /** Minimum table width before it scrolls horizontally inside the card. */
      minWidth?: string;
      emptyTitle?: string;
      emptyDescription?: string;
      emptyIcon?: Component;
      class?: HTMLAttributes['class'];
    }>(),
    {
      skeletonRows: 6,
      sortDirection: 'asc',
      emptyTitle: 'Nothing here yet',
    }
  );

  const emit = defineEmits<{
    sort: [key: string];
    rowClick: [row: Row, event: MouseEvent];
  }>();

  const slots = useSlots();
  const hasActions = computed(() => !!slots.actions);
  const colspan = computed(() => props.columns.length + (hasActions.value ? 1 : 0));

  const hideClass: Record<NonNullable<DataTableColumn['hideBelow']>, string> = {
    sm: '@max-md:hidden',
    md: '@max-3xl:hidden',
    lg: '@max-5xl:hidden',
  };

  const alignClass = (col: DataTableColumn) =>
    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

  const order: NonNullable<DataTableColumn['hideBelow']>[] = ['sm', 'md', 'lg'];
  const padLeft = { sm: '@max-md:pl-4', md: '@max-3xl:pl-4', lg: '@max-5xl:pl-4' } as const;
  const padRight = { sm: '@max-md:pr-4', md: '@max-3xl:pr-4', lg: '@max-5xl:pr-4' } as const;

  /** The narrowest breakpoint at which every column in `cols` is hidden (null if one never hides). */
  function allHiddenBelow(cols: DataTableColumn[]) {
    if (!cols.length || cols.some((c) => !c.hideBelow)) return null;
    return order.find((bp) => cols.some((c) => c.hideBelow === bp)) ?? null;
  }

  /**
   * Edge cells get a 16px gutter. When the leading/trailing columns collapse
   * (hideBelow), the first/last *visible* column takes over that gutter.
   */
  const edgeClasses = computed(() =>
    props.columns.map((_, i) => {
      const before = allHiddenBelow(props.columns.slice(0, i));
      const after = hasActions.value ? null : allHiddenBelow(props.columns.slice(i + 1));
      return cn(
        i === 0 && 'pl-4',
        before && padLeft[before],
        i === props.columns.length - 1 && !hasActions.value && 'pr-4',
        after && padRight[after]
      );
    })
  );

  const colClass = (col: DataTableColumn, i: number) =>
    cn(alignClass(col), edgeClasses.value[i], col.hideBelow && hideClass[col.hideBelow], col.class);

  function keyOf(row: Row, index: number): string | number {
    if (typeof props.rowKey === 'function') return props.rowKey(row);
    const value = (row as Record<string, unknown>)[props.rowKey];
    return typeof value === 'string' || typeof value === 'number' ? value : index;
  }

  function valueOf(row: Row, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  function onRowClick(row: Row, event: MouseEvent) {
    if (!props.clickable) return;
    // Ignore clicks on interactive children (buttons, links, inputs, menus).
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="menuitem"], [data-row-action]')) return;
    emit('rowClick', row, event);
  }

  const skeletonWidths = ['w-24', 'w-32', 'w-16', 'w-20', 'w-28', 'w-12'];
</script>

<template>
  <div
    :class="
      cn(
        '@container min-w-0',
        bare ? '' : 'overflow-hidden rounded-[var(--radius-card)] border border-line-subtle bg-surface',
        props.class
      )
    "
  >
    <div class="overflow-x-auto">
      <table class="w-full table-fixed border-collapse text-sm" :style="minWidth ? { minWidth } : undefined">
        <thead>
          <tr class="border-b border-line-subtle">
            <th
              v-for="(col, i) in columns"
              :key="col.key"
              scope="col"
              :class="cn('eyebrow h-8 px-3 align-middle', colClass(col, i))"
              :style="col.width ? { width: col.width } : undefined"
              :aria-sort="
                col.sortable && sortKey === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
              "
            >
              <slot :name="`header-${col.key}`" :column="col">
                <button
                  v-if="col.sortable"
                  type="button"
                  class="group/sort inline-flex max-w-full items-center gap-1 rounded uppercase tracking-[inherit] transition-colors hover:text-fg"
                  :class="[sortKey === col.key ? 'text-fg-muted' : '', col.align === 'right' ? 'flex-row-reverse' : '']"
                  @click="emit('sort', col.key)"
                >
                  <span class="truncate">{{ col.label }}</span>
                  <ArrowUp v-if="sortKey === col.key && sortDirection === 'asc'" class="size-3 shrink-0" />
                  <ArrowDown v-else-if="sortKey === col.key" class="size-3 shrink-0" />
                  <ChevronsUpDown
                    v-else
                    class="size-3 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-100"
                  />
                </button>
                <span v-else class="block truncate">{{ col.label }}</span>
              </slot>
            </th>
            <th v-if="hasActions" scope="col" class="h-8 w-12 pr-2" aria-label="Actions" />
          </tr>
        </thead>

        <tbody>
          <!-- Loading skeleton (only when there is nothing to show yet) -->
          <template v-if="loading && rows.length === 0">
            <tr v-for="i in skeletonRows" :key="'skeleton-' + i" class="border-b border-line-subtle last:border-0">
              <td v-for="(col, c) in columns" :key="col.key" :class="cn('h-10 px-3', colClass(col, c))">
                <div
                  class="skeleton h-3"
                  :class="[skeletonWidths[(i + c) % skeletonWidths.length], col.align === 'right' ? 'ml-auto' : '']"
                />
              </td>
              <td v-if="hasActions" class="pr-2" />
            </tr>
          </template>

          <!-- Empty -->
          <tr v-else-if="rows.length === 0" class="animate-fade-in">
            <td :colspan="colspan">
              <slot name="empty">
                <EmptyState size="sm" :icon="emptyIcon || Inbox" :title="emptyTitle" :description="emptyDescription" />
              </slot>
            </td>
          </tr>

          <!-- Rows -->
          <template v-else>
            <template v-for="(row, index) in rows" :key="keyOf(row, index)">
              <tr
                :class="
                  cn(
                    'group/row animate-fade-in border-b border-line-subtle transition-colors last:border-0',
                    clickable ? 'cursor-pointer hover:bg-surface-hover' : 'hover:bg-[rgba(255,255,255,0.02)]',
                    expanded?.(row) && 'bg-surface-hover',
                    rowClass?.(row)
                  )
                "
                @click="onRowClick(row, $event)"
              >
                <td
                  v-for="(col, i) in columns"
                  :key="col.key"
                  :class="cn('h-10 min-w-0 px-3 py-1.5 align-middle text-fg', colClass(col, i))"
                >
                  <slot :name="`cell-${col.key}`" :row="row" :index="index" :value="valueOf(row, col.key)">
                    <span class="block truncate">{{ valueOf(row, col.key) ?? '—' }}</span>
                  </slot>
                </td>
                <td v-if="hasActions" class="w-12 pr-2 text-right align-middle" data-row-action @click.stop>
                  <slot name="actions" :row="row" :index="index" />
                </td>
              </tr>
              <tr
                v-if="expanded?.(row) && $slots.expanded"
                class="border-b border-line-subtle bg-surface-sunken last:border-0"
              >
                <td :colspan="colspan" class="p-0">
                  <slot name="expanded" :row="row" :index="index" />
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Footer content brings its own top border (e.g. <PaginationFooter mode="static">) -->
    <slot name="footer" />
  </div>
</template>
