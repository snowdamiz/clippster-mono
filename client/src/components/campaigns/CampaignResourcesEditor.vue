<template>
  <div class="flex flex-col gap-2">
    <!-- One framed list of resources (divided rows), not a box per resource -->
    <div
      v-if="localResources.length"
      class="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-surface"
    >
      <div v-for="(resource, index) in localResources" :key="index" class="flex flex-col gap-2 p-3">
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <CustomDropdown v-model="resource.resource_type" :options="typeOptions" size="sm" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Remove source material"
            aria-label="Remove source material"
            @click="removeResource(index)"
          >
            <Trash2 />
          </Button>
        </div>

        <Input
          :model-value="resource.title ?? ''"
          type="text"
          placeholder="Title (optional)"
          @update:model-value="resource.title = String($event)"
        />

        <Input
          v-if="resource.resource_type !== 'brief'"
          :model-value="resource.url ?? ''"
          type="text"
          placeholder="https://..."
          @update:model-value="resource.url = String($event)"
        />

        <Textarea
          :model-value="resource.description ?? ''"
          rows="2"
          class="min-h-[56px]"
          :placeholder="
            resource.resource_type === 'brief'
              ? 'Instructions for clippers (what to clip, talking points, hashtags, etc.)'
              : 'Optional notes for clippers'
          "
          @update:model-value="resource.description = String($event)"
        />
      </div>
    </div>

    <Button type="button" variant="secondary" size="sm" class="self-start" @click="addResource">
      <Plus />
      Add source material
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Plus, Trash2 } from 'lucide-vue-next';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import type { CampaignResource } from '@/services/campaignApi';

  const props = defineProps<{
    modelValue: CampaignResource[];
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: CampaignResource[]];
  }>();

  const typeOptions: { value: CampaignResource['resource_type']; label: string }[] = [
    { value: 'video', label: 'Video link' },
    { value: 'audio', label: 'Audio link (YouTube)' },
    { value: 'reference_link', label: 'Reference link' },
    { value: 'brief', label: 'Brief / instructions' },
  ];

  const localResources = ref<CampaignResource[]>([...props.modelValue]);

  watch(
    () => props.modelValue,
    (value) => {
      localResources.value = [...value];
    },
    { deep: true }
  );

  watch(
    localResources,
    (value) => {
      emit('update:modelValue', value);
    },
    { deep: true }
  );

  function addResource() {
    localResources.value.push({
      resource_type: 'video',
      url: '',
      title: '',
      description: '',
    });
  }

  function removeResource(index: number) {
    localResources.value.splice(index, 1);
  }
</script>
