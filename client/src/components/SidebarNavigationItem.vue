<template>
  <component
    :is="disabled ? 'div' : linkComponent || 'a'"
    :to="linkComponent && !disabled ? href : undefined"
    :href="!linkComponent && !disabled ? href : undefined"
    :aria-current="active ? 'page' : undefined"
    class="sidebar-navigation-item"
    :class="{
      'sidebar-nav-item--active': active,
      'sidebar-navigation-item--collapsed': collapsed,
      'sidebar-navigation-item--disabled': disabled,
    }"
    :title="collapsed ? (badge ? `${name} (${badge})` : name) : undefined"
  >
    <span class="sidebar-navigation-item__icon">
      <span
        v-if="useImage"
        class="sidebar-nav-item__custom-icon"
        :style="{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }"
      />
      <component :is="icon" v-else :size="18" />
      <span
        v-if="count && collapsed"
        class="sidebar-navigation-item__count sidebar-navigation-item__count--collapsed"
        :style="countColor ? { backgroundColor: countColor } : undefined"
      >
        {{ count > 99 ? '99+' : count }}
      </span>
    </span>
    <span v-if="!collapsed" class="sidebar-navigation-item__name">{{ name }}</span>
    <span
      v-if="count && !collapsed"
      class="sidebar-navigation-item__count"
      :style="countColor ? { backgroundColor: countColor } : undefined"
    >
      {{ count > 99 ? '99+' : count }}
    </span>
    <span
      v-else-if="badge && !collapsed"
      class="sidebar-navigation-item__badge"
      :class="{ 'sidebar-navigation-item__badge--beta': badge === 'Beta' }"
    >
      {{ badge }}
    </span>
  </component>
</template>
<script setup lang="ts">
  import type { Component } from 'vue';
  defineProps<{
    name: string;
    href: string;
    icon: string | Component;
    useImage?: boolean;
    badge?: string;
    disabled?: boolean;
    collapsed?: boolean;
    active?: boolean;
    count?: number;
    countColor?: string;
    linkComponent?: Component;
  }>();
</script>
<style scoped>
  .sidebar-navigation-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.75rem;
    gap: 0.75rem;
    border-radius: 0.375rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    text-decoration: none;
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition: all 150ms;
    cursor: pointer;
  }
  .sidebar-navigation-item:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }
  .sidebar-navigation-item--collapsed {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
    gap: 0;
  }
  .sidebar-navigation-item--disabled {
    opacity: 0.4;
    cursor: not-allowed;
    user-select: none;
  }
  .sidebar-navigation-item--disabled:hover {
    background: transparent;
    color: var(--sidebar-text-muted);
  }
  .sidebar-nav-item--active {
    background: var(--sidebar-active);
    color: var(--sidebar-accent);
  }
  .sidebar-nav-item--active:hover {
    background: var(--sidebar-active-hover);
    color: var(--sidebar-accent);
  }
  .sidebar-navigation-item__icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .sidebar-nav-item__custom-icon {
    width: 18px;
    height: 18px;
    background: currentColor;
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
  }
  .sidebar-navigation-item__name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-navigation-item__count {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--sidebar-accent);
    color: black;
    border-radius: 0.375rem;
  }
  .sidebar-navigation-item__count--collapsed {
    position: absolute;
    top: -0.375rem;
    right: -0.5rem;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.25rem;
    border-radius: 0.5rem;
  }
  .sidebar-navigation-item__badge {
    margin-left: auto;
    padding: 0.125rem 0.375rem;
    font-size: 0.5625rem;
    font-weight: 600;
    line-height: 1;
    border-radius: 0.25rem;
    white-space: nowrap;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }
  .sidebar-navigation-item__badge--beta {
    background: var(--sidebar-accent);
    color: black;
  }
</style>
