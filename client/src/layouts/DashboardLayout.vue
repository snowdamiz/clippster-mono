<template>
  <div class="bg-background flex">
    <DashboardSidebar @show-auth-modal="showAuthModal = true" />
    <!-- Main content area with left margin to account for fixed sidebar -->
    <main class="flex-1 ml-64">
      <!-- <DashboardHeader /> -->
      <!-- Page content with top margin to account for fixed header -->
      <div class="px-6 pb-8 pt-8">
        <div class="max-w-7xl mx-auto">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in"><component :is="Component" /></transition>
          </router-view>
        </div>
      </div>
    </main>
    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import DashboardSidebar from '@/components/DashboardSidebar.vue';
  import AuthModal from '@/components/AuthModal.vue';

  const showAuthModal = ref(false);
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
