<script setup lang="ts">
  /**
   * "Recent" searches menu for the Download video / Download audio pages.
   */
  import { ChevronDown, Clock, Trash2 } from 'lucide-vue-next'
  import type { RecentSearch } from '@/stores/platform'
  import { Button } from '@/components/ui/button'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu'
  import { PlatformLogo } from '@/components/ui/platform-logo'

  withDefaults(
    defineProps<{
      searches: RecentSearch[]
      /** Primary label for a search (symbol, label or cleaned id). */
      formatName: (search: RecentSearch) => string
      limit?: number
    }>(),
    { limit: 15 }
  )

  const emit = defineEmits<{
    select: [search: RecentSearch]
    clear: []
  }>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="secondary" size="md" class="streamvods-recent group" title="Recent searches">
        <Clock />
        Recent
        <ChevronDown class="text-fg-subtle transition-transform group-data-[state=open]:rotate-180" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="streamvods-recent w-72">
      <DropdownMenuLabel>Recent searches</DropdownMenuLabel>
      <div class="max-h-[min(360px,60vh)] overflow-y-auto">
        <DropdownMenuItem
          v-for="search in searches.slice(0, limit)"
          :key="`${search.platform}-${search.id}`"
          class="h-auto gap-2.5 py-1.5"
          @select="emit('select', search)"
        >
          <span class="relative shrink-0">
            <span class="grid size-7 place-items-center overflow-hidden rounded-full bg-surface-sunken">
              <img v-if="search.imageUrl" :src="search.imageUrl" alt="" class="size-full object-cover" />
              <Clock v-else class="size-3.5 text-fg-subtle" />
            </span>
            <PlatformLogo
              :platform="search.platform"
              size="xs"
              shape="circle"
              class="absolute -right-1 -bottom-1 !size-3.5 ring-2 ring-[var(--surface-raised)]"
            />
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-sm text-fg">{{ formatName(search) }}</span>
            <span class="truncate text-2xs text-fg-subtle">{{ search.name || search.displayText }}</span>
          </span>
        </DropdownMenuItem>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="text-fg-muted" @select="emit('clear')">
        <Trash2 />
        Clear all
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
