<template>
  <div class="campaign-resources-editor">
    <div v-for="(resource, index) in localResources" :key="index" class="campaign-resources-editor__item">
      <div class="campaign-resources-editor__row">
        <select v-model="resource.resource_type" class="campaign-resources-editor__select">
          <option value="video">Video link</option>
          <option value="audio">Audio link (YouTube)</option>
          <option value="reference_link">Reference link</option>
          <option value="brief">Brief / instructions</option>
        </select>
        <button type="button" class="campaign-resources-editor__remove" @click="removeResource(index)">
          Remove
        </button>
      </div>

      <input
        v-model="resource.title"
        type="text"
        class="campaign-resources-editor__input"
        placeholder="Title (optional)"
      />

      <input
        v-if="resource.resource_type !== 'brief'"
        v-model="resource.url"
        type="text"
        class="campaign-resources-editor__input"
        placeholder="https://..."
      />

      <textarea
        v-model="resource.description"
        rows="2"
        class="campaign-resources-editor__textarea"
        :placeholder="
          resource.resource_type === 'brief'
            ? 'Instructions for clippers (what to clip, talking points, hashtags, etc.)'
            : 'Optional notes for clippers'
        "
      ></textarea>
    </div>

    <button type="button" class="campaign-resources-editor__add" @click="addResource">
      + Add source material
    </button>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import type { CampaignResource } from '@/services/campaignApi';

  const props = defineProps<{
    modelValue: CampaignResource[];
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: CampaignResource[]];
  }>();

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

<style scoped>
  .campaign-resources-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .campaign-resources-editor__item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: var(--sidebar-surface);
  }

  .campaign-resources-editor__row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .campaign-resources-editor__select,
  .campaign-resources-editor__input,
  .campaign-resources-editor__textarea {
    width: 100%;
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    padding: 0.5rem 0.625rem;
    font-size: 0.8125rem;
  }

  .campaign-resources-editor__remove,
  .campaign-resources-editor__add {
    border: 1px solid var(--sidebar-border);
    background: transparent;
    color: var(--sidebar-text);
    border-radius: 6px;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .campaign-resources-editor__add {
    align-self: flex-start;
  }
</style>
