<template>
  <div>
    <!-- Page Title and Actions -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Prompts</h1>
          <p class="text-muted-foreground mt-2">Manage your AI prompts and templates</p>
        </div>
        <button class="px-5 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-lg flex items-center gap-2 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Prompt
        </button>
      </div>
    </div>

    <!-- Prompts List -->
    <div class="space-y-4">
      <!-- Sample Prompt Cards -->
      <div v-for="i in 8" :key="i" class="bg-card border border-border rounded-xl p-5 hover:border-foreground/20 group">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-start gap-4 flex-1">
            <div class="p-2.5 bg-muted rounded-lg flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-foreground mb-2 group-hover:text-foreground/80">Prompt Template {{ i }}</h3>
              <p class="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                This is a sample prompt template that helps you create engaging video content with AI assistance. 
                It includes various parameters and instructions for optimal results.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="p-2 hover:bg-muted rounded-md" title="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button class="p-2 hover:bg-muted rounded-md" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="p-2 hover:bg-muted rounded-md" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-5 text-xs text-muted-foreground pt-4 border-t border-border">
          <span class="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Editing
          </span>
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Used 5 times
          </span>
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Updated 2 days ago
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Prompts logic will go here
</script>