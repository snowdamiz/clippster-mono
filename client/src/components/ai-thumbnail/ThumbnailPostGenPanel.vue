<template>
  <!-- Sits on the results panel: a row of tool chips + the open tool's form, no card around it -->
  <section class="flex flex-col gap-3 border-t border-line-subtle pt-4">
    <SectionHeader title="Post-gen tools" description="Uses the working thumbnail" />
    <ToggleChips
      label="Post-gen tools"
      :model-value="activeTool ? [activeTool] : []"
      :options="toolOptions"
      :disabled="busy || !imageUrl"
      :checkmark="false"
      @toggle="(id) => openTool(id as ToolId)"
    />
    <div v-if="activeTool" :key="activeTool" class="flex animate-enter flex-col gap-2">
      <p class="text-sm font-semibold text-fg">{{ activeToolMeta?.label }}</p>
      <Textarea v-if="needsPrompt" v-model="prompt" rows="2" class="min-h-[56px] text-xs" :placeholder="promptPlaceholder" />
      <Input v-if="activeTool === 'face-swap'" v-model="faceUrl" type="url" class="text-xs" placeholder="Face image URL" />
      <Input v-if="activeTool === 'combine'" v-model="secondUrl" type="url" class="text-xs" placeholder="Second image URL" />
      <CustomDropdown v-if="activeTool === 'variations'" v-model="variationCount" :options="variationOptions" size="sm" />
      <div v-if="activeTool === 'color'" class="flex gap-2">
        <div class="min-w-0 flex-1">
          <CustomDropdown v-model="preset" :options="presetOptions" size="sm" />
        </div>
        <div class="w-28 shrink-0">
          <CustomDropdown v-model="intensity" :options="intensityOptions" size="sm" />
        </div>
      </div>
      <CustomDropdown v-if="activeTool === 'upscale'" v-model="scale" :options="scaleOptions" size="sm" />
      <div v-if="critiqueResult" class="max-h-40 animate-fade-in overflow-y-auto rounded-md bg-surface-sunken p-2 text-xs text-fg-muted">
        <p class="font-semibold text-fg">Score <span class="tabular">{{ critiqueResult.overallScore }}</span></p>
        <p class="mt-1">{{ critiqueResult.summary }}</p>
      </div>
      <div v-if="overlayResult" class="animate-fade-in rounded-md bg-surface-sunken p-2 text-xs text-fg-muted">
        {{ overlayResult }}
      </div>
      <div class="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" @click="activeTool = null">Cancel</Button>
        <Button variant="secondary" size="sm" :disabled="busy || !canRun" :loading="busy" @click="run">
          {{ busy ? 'Working…' : 'Run' }}
        </Button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { thumbnailPostGen } from '@/services/aiThumbnailApi';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { SectionHeader } from '@/components/ui/section-header';
  import { Textarea } from '@/components/ui/textarea';
  import { ToggleChips } from '@/components/ui/toggle-chips';

  const props = defineProps<{
    sessionId: number;
    imageUrl: string | null;
    busy?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'done', payload: Record<string, unknown>): void;
    (e: 'error', message: string): void;
    (e: 'busy', value: boolean): void;
  }>();

  const tools = [
    { id: 'critique', label: 'Critique', hint: '4 credits' },
    { id: 'variations', label: 'Variations', hint: '2 each' },
    { id: 'optimize', label: 'Optimize', hint: '8 credits' },
    { id: 'text-overlay', label: 'Text overlay', hint: 'Free' },
    { id: 'edit', label: 'AI edit', hint: '2 credits' },
    { id: 'face-swap', label: 'Face swap', hint: '2 credits' },
    { id: 'bg-remove', label: 'BG remove', hint: 'Free' },
    { id: 'bg-replace', label: 'BG replace', hint: '2 credits' },
    { id: 'color', label: 'Color enhance', hint: 'Free' },
    { id: 'upscale', label: 'Upscale', hint: 'Free' },
    { id: 'filter', label: 'Filter', hint: 'Free' },
    { id: 'combine', label: 'Combine', hint: '2 credits' },
  ] as const;

  type ToolId = (typeof tools)[number]['id'];
  const toolOptions = tools.map((tool) => ({ value: tool.id, label: `${tool.label} · ${tool.hint}` }));

  const activeTool = ref<ToolId | null>(null);
  const prompt = ref('');
  const faceUrl = ref('');
  const secondUrl = ref('');
  const variationCount = ref(4);
  const preset = ref('cinematic');
  const intensity = ref('medium');
  const scale = ref('2x');
  const critiqueResult = ref<Record<string, unknown> | null>(null);
  const overlayResult = ref<string | null>(null);
  const localBusy = ref(false);

  const presets = ['vibrant', 'dramatic', 'warm', 'cool', 'high-contrast', 'cinematic'];
  const presetOptions = presets.map((p) => ({ value: p, label: p }));
  const intensityOptions = ['light', 'medium', 'strong'].map((v) => ({ value: v, label: v }));
  const scaleOptions = ['2x', '4x'].map((v) => ({ value: v, label: v }));
  const variationOptions = [2, 4, 6, 10].map((n) => ({ value: n, label: `${n} variations` }));

  const busy = computed(() => props.busy || localBusy.value);
  const activeToolMeta = computed(() => tools.find((t) => t.id === activeTool.value));
  const needsPrompt = computed(() =>
    ['optimize', 'edit', 'bg-replace', 'filter', 'combine'].includes(activeTool.value || '')
  );
  const promptPlaceholder = computed(() => {
    switch (activeTool.value) {
      case 'optimize':
        return 'Rough idea for a viral thumbnail…';
      case 'bg-replace':
        return 'Background scene prompt…';
      case 'filter':
        return 'Filter / style prompt…';
      case 'combine':
        return 'How to combine the images…';
      default:
        return 'Describe the edit…';
    }
  });

  const canRun = computed(() => {
    if (!props.imageUrl && activeTool.value !== 'optimize') return false;
    if (activeTool.value === 'face-swap') return !!faceUrl.value.trim();
    if (activeTool.value === 'combine') return !!secondUrl.value.trim() && !!prompt.value.trim();
    if (needsPrompt.value) return !!prompt.value.trim();
    return true;
  });

  function openTool(id: ToolId) {
    activeTool.value = id;
    critiqueResult.value = null;
    overlayResult.value = null;
    prompt.value = '';
  }

  async function run() {
    if (!props.sessionId || !activeTool.value) return;
    localBusy.value = true;
    emit('busy', true);
    critiqueResult.value = null;
    overlayResult.value = null;
    try {
      const imageUrl = props.imageUrl || undefined;
      let result: Record<string, unknown>;
      switch (activeTool.value) {
        case 'critique':
          result = await thumbnailPostGen.critique(props.sessionId, { imageUrl, niche: 'general' });
          critiqueResult.value = result as any;
          break;
        case 'variations':
          result = await thumbnailPostGen.variations(props.sessionId, {
            imageUrl,
            count: variationCount.value,
          });
          break;
        case 'optimize':
          result = await thumbnailPostGen.optimize(props.sessionId, prompt.value.trim());
          break;
        case 'text-overlay':
          result = await thumbnailPostGen.textOverlay(props.sessionId, { imageUrl });
          overlayResult.value = String((result as any).textOverlayPrompt || '');
          break;
        case 'edit':
          result = await thumbnailPostGen.edit(props.sessionId, prompt.value.trim(), { imageUrl });
          break;
        case 'face-swap':
          result = await thumbnailPostGen.faceSwap(props.sessionId, faceUrl.value.trim(), { imageUrl });
          break;
        case 'bg-remove':
          result = await thumbnailPostGen.backgroundRemove(props.sessionId, { imageUrl });
          break;
        case 'bg-replace':
          result = await thumbnailPostGen.backgroundReplace(props.sessionId, prompt.value.trim(), {
            imageUrl,
          });
          break;
        case 'color':
          result = await thumbnailPostGen.colorEnhance(props.sessionId, preset.value, {
            imageUrl,
            intensity: intensity.value,
          });
          break;
        case 'upscale':
          result = await thumbnailPostGen.upscale(props.sessionId, scale.value, { imageUrl });
          break;
        case 'filter':
          result = await thumbnailPostGen.filter(props.sessionId, prompt.value.trim(), { imageUrl });
          break;
        case 'combine':
          result = await thumbnailPostGen.combine(
            props.sessionId,
            imageUrl!,
            secondUrl.value.trim(),
            prompt.value.trim()
          );
          break;
        default:
          throw new Error('Unknown tool');
      }
      emit('done', result);
      if (!['critique', 'text-overlay'].includes(activeTool.value)) {
        activeTool.value = null;
      }
    } catch (e: any) {
      emit('error', e.response?.data?.error || e.message || 'Post-gen failed');
    } finally {
      localBusy.value = false;
      emit('busy', false);
    }
  }
</script>
