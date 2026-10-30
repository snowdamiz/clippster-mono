<script setup lang="ts">
  import { ref } from 'vue';
  import { MessageSquare, SlidersHorizontal } from 'lucide-vue-next';
  import SourcesPanel from './SourcesPanel.vue';
  import VideoChatPanel from './VideoChatPanel.vue';
  const tab = ref<'chat' | 'sources'>('chat');
</script>
<template>
  <aside class="flex min-h-0 w-[clamp(300px,25vw,360px)] shrink-0 flex-col border-r border-line-subtle bg-panel">
    <div role="tablist" aria-label="AI sidebar" class="flex h-11 shrink-0 gap-1 border-b border-line-subtle p-1">
      <button
        v-for="item in ['chat', 'sources'] as const"
        :key="item"
        role="tab"
        :aria-selected="tab === item"
        :aria-controls="`ai-${item}-panel`"
        class="flex flex-1 items-center justify-center gap-2 rounded-md text-xs font-medium"
        :class="tab === item ? 'bg-surface text-fg' : 'text-fg-subtle hover:text-fg'"
        @click="tab = item"
      >
        <component :is="item === 'chat' ? MessageSquare : SlidersHorizontal" class="size-3.5" />
        {{ item === 'chat' ? 'AI chat' : 'Sources & setup' }}
      </button>
    </div>
    <div id="ai-chat-panel" v-show="tab === 'chat'" role="tabpanel" class="min-h-0 flex-1"><VideoChatPanel /></div>
    <div id="ai-sources-panel" v-show="tab === 'sources'" role="tabpanel" class="min-h-0 flex-1 overflow-y-auto">
      <SourcesPanel />
    </div>
  </aside>
</template>
