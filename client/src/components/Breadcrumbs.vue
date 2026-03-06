<template>
  <nav class="breadcrumbs">
    <ol class="breadcrumbs__list">
      <li v-for="(item, index) in items" :key="index" class="breadcrumbs__item">
        <router-link
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          class="breadcrumbs__link"
        >
          {{ item.label }}
        </router-link>
        <span v-else class="breadcrumbs__current">{{ item.label }}</span>
        <span v-if="index < items.length - 1" class="breadcrumbs__separator">/</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
  interface BreadcrumbItem {
    label: string
    to?: string
  }

  defineProps<{
    items: BreadcrumbItem[]
  }>()
</script>

<style scoped>
  .breadcrumbs {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sidebar-border);
    margin-bottom: 1.5rem;
  }

  .breadcrumbs__list {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .breadcrumbs__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .breadcrumbs__link {
    color: var(--sidebar-text-muted);
    text-decoration: none;
    transition: color 0.2s;
  }

  .breadcrumbs__link:hover {
    color: var(--sidebar-text);
  }

  .breadcrumbs__current {
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .breadcrumbs__separator {
    color: var(--sidebar-text-muted);
    user-select: none;
  }
</style>
