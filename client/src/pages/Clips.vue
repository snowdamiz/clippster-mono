<template>
  <div>
    <!-- Page Title and Actions -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Clips</h1>
          <p class="text-muted-foreground mt-1">Browse and manage all your video clips</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Search -->
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search clips..." class="pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 w-64">
          </div>
          <!-- Upload Button -->
          <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Clip
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <button class="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg border border-primary/20">All Clips</button>
      <button class="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">Recent</button>
      <button class="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">Favorites</button>
      <button class="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">Archived</button>
    </div>

    <!-- Clips Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <!-- Sample Clip Cards -->
      <div v-for="i in 12" :key="i" class="group relative bg-card border border-border rounded-lg overflow-hidden hover:shadow-xl transition-all cursor-pointer">
        <!-- Thumbnail -->
        <div class="aspect-video bg-gradient-to-br from-purple-600/20 to-indigo-600/20 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <!-- Duration -->
          <span class="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">2:45</span>
          <!-- Hover Overlay -->
          <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button class="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button class="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
        <!-- Info -->
        <div class="p-3">
          <h4 class="font-medium text-foreground truncate">Clip {{ i }}</h4>
          <p class="text-xs text-muted-foreground mt-1">Added 3 days ago</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Clips logic will go here
</script>