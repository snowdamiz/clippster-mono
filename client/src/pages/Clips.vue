<template>
  <div>
    <!-- Page Title and Actions -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Clips</h1>
          <p class="text-muted-foreground mt-2">Browse and manage all your video clips</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Search -->
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search clips..." class="pl-9 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-foreground/30 w-64 text-sm">
          </div>
          <!-- Upload Button -->
          <button class="px-5 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-lg flex items-center gap-2 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Clip
          </button>
        </div>
      </div>
    </div>

    <!-- Clips Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <!-- Sample Clip Cards -->
      <div v-for="i in 12" :key="i" class="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 cursor-pointer">
        <!-- Thumbnail -->
        <div class="aspect-video bg-muted relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <!-- Duration -->
          <span class="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs font-medium rounded">2:45</span>
          <!-- Hover Overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Play">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Add to Project">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </div>
        </div>
        <!-- Info -->
        <div class="p-4">
          <h4 class="font-semibold text-foreground truncate mb-1">Clip {{ i }}</h4>
          <p class="text-xs text-muted-foreground">Added 3 days ago</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Clips logic will go here
</script>