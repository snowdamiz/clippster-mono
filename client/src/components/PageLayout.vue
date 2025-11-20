<template>
  <div class="w-full">
    <!-- Page Title and Actions -->
    <div v-if="showHeader" class="mb-8 -mt-2">
      <div class="relative overflow-hidden rounded-xl bg-card border border-border p-4 shadow-sm">
        <!-- Gradient Background Decoration -->
        <div class="absolute inset-0 bg-gradient-to-r from-primary/3 to-primary/1 pointer-events-none"></div>

        <div class="relative flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              v-if="icon"
              class="p-3 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm flex-shrink-0"
            >
              <!-- SVG file reference -->
              <img
                v-if="typeof icon === 'string' && icon.endsWith('.svg')"
                :src="icon"
                :alt="title"
                class="h-6 w-6 text-primary invert-0 dark:invert"
              />
              <!-- Component icon -->
              <component v-else-if="typeof icon !== 'string'" :is="icon" class="h-6 w-6 text-primary" />
              <!-- Fallback inline SVG path -->
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
              </svg>
            </div>

            <div>
              <h1 class="text-2xl font-bold text-foreground tracking-tight">{{ title }}</h1>
              <p class="text-sm text-muted-foreground mt-1">{{ description }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 mr-1">
            <slot name="actions"></slot>
          </div>
        </div>
      </div>
    </div>
    <!-- Content -->
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';

  defineProps<{
    title: string;
    description: string;
    showHeader?: boolean;
    icon?: string | Component;
  }>();
</script>
