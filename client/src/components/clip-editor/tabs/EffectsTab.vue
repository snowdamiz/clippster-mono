<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Effects</h3>
      <p class="text-xs text-white/50 mb-4">Add zoom, pan, transitions, and special effects.</p>
    </div>

    <!-- Effect Presets -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Add Effect</h4>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="effect in effectTypes"
          :key="effect.type"
          @click="addEffect(effect.type)"
          class="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
        >
          <component :is="effect.icon" :size="20" class="text-violet-400 mb-2" />
          <div class="text-sm font-medium text-white">{{ effect.name }}</div>
          <div class="text-xs text-white/50">{{ effect.description }}</div>
        </button>
      </div>
    </div>

    <!-- Effects List -->
    <div v-if="effects.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Applied Effects</h4>

      <div v-for="effect in effects" :key="effect.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="text-sm font-medium text-white capitalize">{{ effect.type }}</div>
            <div class="text-xs text-white/50">
              {{ formatTime(effect.startTime) }} - {{ formatTime(effect.endTime) }}
            </div>
          </div>
          <button @click="emit('deleteEffect', effect.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Trash2 :size="14" class="text-red-400" />
          </button>
        </div>

        <!-- Timing -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Start</label>
            <input
              type="number"
              :value="effect.startTime"
              @input="(e) => updateEffect(effect.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              min="0"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">End</label>
            <input
              type="number"
              :value="effect.endTime"
              @input="(e) => updateEffect(effect.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              :min="effect.startTime"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
        </div>

        <!-- Effect-specific Settings -->
        <!-- Zoom Effect -->
        <div v-if="effect.type === 'zoom'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-white/60 mb-1">Start Zoom ({{ effect.settings.startZoom || 1 }}x)</label>
              <input
                type="range"
                :value="effect.settings.startZoom || 1"
                @input="
                  (e) => updateEffectSetting(effect.id, 'startZoom', parseFloat((e.target as HTMLInputElement).value))
                "
                min="0.5"
                max="3"
                step="0.1"
                class="w-full accent-violet-500"
              />
            </div>
            <div>
              <label class="block text-xs text-white/60 mb-1">End Zoom ({{ effect.settings.endZoom || 1.5 }}x)</label>
              <input
                type="range"
                :value="effect.settings.endZoom || 1.5"
                @input="
                  (e) => updateEffectSetting(effect.id, 'endZoom', parseFloat((e.target as HTMLInputElement).value))
                "
                min="0.5"
                max="3"
                step="0.1"
                class="w-full accent-violet-500"
              />
            </div>
          </div>
        </div>

        <!-- Blur Effect -->
        <div v-if="effect.type === 'blur'" class="space-y-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">
              Blur Amount ({{ effect.settings.blurAmount || 5 }}px)
            </label>
            <input
              type="range"
              :value="effect.settings.blurAmount || 5"
              @input="
                (e) => updateEffectSetting(effect.id, 'blurAmount', parseFloat((e.target as HTMLInputElement).value))
              "
              min="0"
              max="20"
              step="1"
              class="w-full accent-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">Blur Type</label>
            <select
              :value="effect.settings.blurType || 'gaussian'"
              @change="(e) => updateEffectSetting(effect.id, 'blurType', (e.target as HTMLSelectElement).value)"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            >
              <option value="gaussian">Gaussian</option>
              <option value="motion">Motion</option>
              <option value="radial">Radial</option>
            </select>
          </div>
        </div>

        <!-- Transition Effect -->
        <div v-if="effect.type === 'transition'" class="space-y-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Transition Type</label>
            <select
              :value="effect.settings.transitionType || 'fade'"
              @change="(e) => updateEffectSetting(effect.id, 'transitionType', (e.target as HTMLSelectElement).value)"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            >
              <option value="fade">Fade</option>
              <option value="dissolve">Dissolve</option>
              <option value="slide">Slide</option>
              <option value="wipe">Wipe</option>
              <option value="zoom">Zoom</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">
              Duration ({{ effect.settings.transitionDuration || 0.5 }}s)
            </label>
            <input
              type="range"
              :value="effect.settings.transitionDuration || 0.5"
              @input="
                (e) =>
                  updateEffectSetting(effect.id, 'transitionDuration', parseFloat((e.target as HTMLInputElement).value))
              "
              min="0.1"
              max="2"
              step="0.1"
              class="w-full accent-violet-500"
            />
          </div>
        </div>

        <!-- Flash/Shake Effect -->
        <div v-if="effect.type === 'flash' || effect.type === 'shake'" class="space-y-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Intensity ({{ effect.settings.intensity || 50 }}%)</label>
            <input
              type="range"
              :value="effect.settings.intensity || 50"
              @input="
                (e) => updateEffectSetting(effect.id, 'intensity', parseFloat((e.target as HTMLInputElement).value))
              "
              min="10"
              max="100"
              step="10"
              class="w-full accent-violet-500"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ZoomIn, Move, Layers, CloudFog, Snowflake, Zap, Activity, Trash2 } from 'lucide-vue-next';
  import type { Effect, EffectType, EffectSettings } from '@/types';

  const props = defineProps<{
    effects: Effect[];
    currentTime: number;
    duration: number;
  }>();

  const emit = defineEmits<{
    (e: 'addEffect', type: EffectType, settings: EffectSettings): void;
    (e: 'updateEffect', effectId: string, updates: Partial<Effect>): void;
    (e: 'deleteEffect', effectId: string): void;
  }>();

  const effectTypes = [
    { type: 'zoom' as EffectType, name: 'Zoom', description: 'Ken Burns effect', icon: ZoomIn },
    { type: 'pan' as EffectType, name: 'Pan', description: 'Camera movement', icon: Move },
    { type: 'transition' as EffectType, name: 'Transition', description: 'Segment transitions', icon: Layers },
    { type: 'blur' as EffectType, name: 'Blur', description: 'Background blur', icon: CloudFog },
    { type: 'freeze' as EffectType, name: 'Freeze', description: 'Freeze frame', icon: Snowflake },
    { type: 'flash' as EffectType, name: 'Flash', description: 'Flash effect', icon: Zap },
    { type: 'shake' as EffectType, name: 'Shake', description: 'Camera shake', icon: Activity },
  ];

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function addEffect(type: EffectType) {
    const defaultSettings: EffectSettings = {};

    switch (type) {
      case 'zoom':
        defaultSettings.startZoom = 1;
        defaultSettings.endZoom = 1.5;
        break;
      case 'pan':
        defaultSettings.startPosition = { x: 50, y: 50 };
        defaultSettings.endPosition = { x: 50, y: 50 };
        break;
      case 'blur':
        defaultSettings.blurAmount = 5;
        defaultSettings.blurType = 'gaussian';
        break;
      case 'transition':
        defaultSettings.transitionType = 'fade';
        defaultSettings.transitionDuration = 0.5;
        break;
      case 'flash':
      case 'shake':
        defaultSettings.intensity = 50;
        defaultSettings.frequency = 10;
        break;
    }

    emit('addEffect', type, defaultSettings);
  }

  function updateEffect(effectId: string, key: string, value: any) {
    emit('updateEffect', effectId, { [key]: value });
  }

  function updateEffectSetting(effectId: string, settingKey: string, value: any) {
    const effect = props.effects.find((e) => e.id === effectId);
    if (effect) {
      emit('updateEffect', effectId, {
        settings: { ...effect.settings, [settingKey]: value },
      });
    }
  }
</script>
