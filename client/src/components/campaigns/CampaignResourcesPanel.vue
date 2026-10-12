<template>
  <section v-if="resources.length > 0" class="flex flex-col gap-2">
    <SectionHeader
      title="Source content"
      description="Download source video/audio or review campaign instructions before clipping."
      variant="eyebrow"
    />

    <div class="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-surface">
      <div
        v-for="(resource, index) in resources"
        :key="resource.id ?? resource.title ?? index"
        class="flex min-w-0 items-start gap-3 px-3 py-2"
      >
        <IconTile :icon="typeIcon(resource.resource_type)" size="md" class="mt-0.5" />
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <p class="truncate text-sm font-medium text-fg">{{ resource.title || resource.url || 'Untitled material' }}</p>
            <Badge class="shrink-0">{{ formatType(resource.resource_type) }}</Badge>
          </div>
          <p v-if="resource.description" class="mt-0.5 whitespace-pre-line text-xs text-fg-muted">
            {{ resource.description }}
          </p>
        </div>

        <Button
          v-if="resource.download_target"
          variant="secondary"
          size="xs"
          class="shrink-0"
          @click="openDownload(resource.download_target!)"
        >
          <Download />
          Open in app
        </Button>
        <a
          v-else-if="resource.url"
          :href="resource.url"
          target="_blank"
          rel="noopener noreferrer"
          :class="buttonVariants({ variant: 'secondary', size: 'xs', class: 'shrink-0' })"
        >
          <ExternalLink />
          Open link
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';
  import { useRouter } from 'vue-router';
  import { Download, ExternalLink, FileText, Link2, Music, Paperclip, Video } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { IconTile } from '@/components/ui/icon-tile';
  import { SectionHeader } from '@/components/ui/section-header';
  import type { CampaignResource } from '@/services/campaignApi';

  defineProps<{
    resources: CampaignResource[];
  }>();

  const router = useRouter();

  function formatType(type: CampaignResource['resource_type']) {
    switch (type) {
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'reference_link':
        return 'Reference';
      case 'brief':
        return 'Brief';
      default:
        return 'Material';
    }
  }

  function typeIcon(type: CampaignResource['resource_type']): Component {
    switch (type) {
      case 'video':
        return Video;
      case 'audio':
        return Music;
      case 'reference_link':
        return Link2;
      case 'brief':
        return FileText;
      default:
        return Paperclip;
    }
  }

  function openDownload(target: string) {
    router.push(target);
  }
</script>
