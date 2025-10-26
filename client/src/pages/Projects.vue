<template>
  <div>
    <!-- Page Title and Actions -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Projects</h1>
          <p class="text-muted-foreground mt-1">Manage and organize your video projects</p>
        </div>
        <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>
    </div>

    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Sample Project Cards -->
      <div v-for="i in 6" :key="i" class="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div class="flex items-start justify-between mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span class="text-xs text-muted-foreground">2 days ago</span>
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2">Project {{ i }}</h3>
        <p class="text-sm text-muted-foreground mb-4">Sample project description with some details about the content.</p>
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">12 clips</span>
          <div class="flex items-center gap-2">
            <button class="p-1 hover:bg-accent rounded">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="p-1 hover:bg-accent rounded">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (hidden when projects exist) -->
    <div v-if="false" class="flex flex-col items-center justify-center py-16">
      <div class="p-4 bg-muted/30 rounded-full mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
      <p class="text-muted-foreground text-sm mb-4">Create your first project to get started</p>
      <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
        Create Project
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Projects logic will go here
</script>