<template>
  <div class="min-h-screen bg-background flex">
    <DashboardSidebar />

    <!-- Main content area with left margin to account for fixed sidebar -->
    <main class="flex-1 ml-64">
      <DashboardHeader />

      <!-- Page content -->
      <div class="p-8">
        <div class="max-w-7xl mx-auto">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import DashboardSidebar from '@/components/DashboardSidebar.vue'
import DashboardHeader from '@/components/DashboardHeader.vue'
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
