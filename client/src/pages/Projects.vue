<template>
  <div>
    <!-- Page Title and Actions -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Projects</h1>
          <p class="text-muted-foreground mt-2">Manage and organize your video projects</p>
        </div>
        <button class="px-5 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-lg flex items-center gap-2 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>
    </div>

    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <!-- Sample Project Cards -->
      <div v-for="i in 6" :key="i" class="bg-card border border-border rounded-xl p-6 hover:border-foreground/20 cursor-pointer group">
        <div class="flex items-start justify-between mb-5">
          <div class="p-3 bg-muted rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">2 days ago</span>
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/80">Project {{ i }}</h3>
        <p class="text-sm text-muted-foreground mb-5 line-clamp-2">Sample project description with some details about the content.</p>
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <span class="text-sm text-muted-foreground font-medium">12 clips</span>
          <div class="flex items-center gap-1">
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
      </div>
    </div>

    <!-- Empty State (hidden when projects exist) -->
    <div v-if="false" class="flex flex-col items-center justify-center py-20">
      <div class="p-5 bg-muted rounded-full mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
      <p class="text-muted-foreground mb-6">Create your first project to get started</p>
      <button class="px-5 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-lg font-medium">
        Create Project
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Projects logic will go here
</script>