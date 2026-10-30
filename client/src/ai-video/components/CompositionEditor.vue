<script setup lang="ts">
  import { computed, ref, watch, h, render } from 'vue';
  import { ArrowRight, CircleCheck, Heart, Play, Star } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  const props = defineProps<{ path: string; source: string; busy?: boolean }>();
  const emit = defineEmits<{ save: [path: string, source: string] }>();
  const draft = ref('');
  const selected = ref('');
  const tab = ref<'elements' | 'animation' | 'source'>('elements');
  watch(
    () => props.source,
    (value) => (draft.value = value),
    { immediate: true }
  );
  watch(
    () => props.path,
    () => (selected.value = '')
  );
  const parsed = computed(() => new DOMParser().parseFromString(draft.value, 'text/html'));
  const root = computed(() => parsed.value.querySelector('template')?.content ?? parsed.value.body);
  const elements = computed(() =>
    Array.from(root.value.querySelectorAll<HTMLElement | SVGElement>('[id]')).filter(
      (node) => node.id !== 'root' && !['SCRIPT', 'STYLE'].includes(node.tagName)
    )
  );
  const element = computed(() => elements.value.find((node) => node.id === selected.value) ?? null);
  const scripts = computed(() => Array.from(root.value.querySelectorAll<HTMLScriptElement>('script:not([src])')));
  const scriptIndex = ref(0);
  const iconChoices = { play: Play, star: Star, heart: Heart, check: CircleCheck, arrow: ArrowRight };
  const easeChoices = [
    'none',
    'power1.out',
    'power2.out',
    'power3.out',
    'sine.inOut',
    'back.out(1.7)',
    'elastic.out(1,0.3)',
  ];
  function chooseIcon(name: string) {
    const icon = iconChoices[name as keyof typeof iconChoices];
    if (!icon) return;
    const host = document.createElement('div');
    render(h(icon, { size: 300, color: '#ffffff' }), host);
    const svg = host.querySelector('svg');
    if (svg) replaceIcon(svg.outerHTML);
    render(null, host);
  }
  function setEase(value: string) {
    const script = scripts.value[scriptIndex.value];
    if (script)
      updateScript((script.textContent ?? '').replace(/\bease\s*:\s*(["'])(.*?)\1/g, `ease: ${JSON.stringify(value)}`));
  }
  const fields = [
    { key: 'translate', label: 'Offset (x y)' },
    { key: 'rotate', label: 'Rotation' },
    { key: 'scale', label: 'Scale' },
    { key: 'opacity', label: 'Opacity' },
    { key: 'color', label: 'Text color' },
    { key: 'font-size', label: 'Font size' },
    { key: 'font-family', label: 'Font family' },
    { key: 'font-weight', label: 'Font weight' },
    { key: 'text-align', label: 'Text alignment' },
    { key: 'background', label: 'Background' },
    { key: 'border-radius', label: 'Corner radius' },
    { key: 'fill', label: 'Icon fill' },
    { key: 'stroke', label: 'Icon stroke' },
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
  ];
  function serialize() {
    draft.value = '<!doctype html>\n' + parsed.value.documentElement.outerHTML;
  }
  function readStyle(key: string) {
    const node = element.value;
    if (!node) return '';
    const own = node.style.getPropertyValue(key);
    if (own) return own;
    const selector = '#' + node.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const css = Array.from(root.value.querySelectorAll('style'))
      .map((node) => node.textContent)
      .join('\n');
    const rule = new RegExp(selector + '\\s*\\{([^}]+)\\}', 'g');
    let match;
    let value = '';
    while ((match = rule.exec(css))) {
      const declaration = new RegExp('(?:^|;)\\s*' + key + '\\s*:\\s*([^;]+)').exec(match[1]);
      if (declaration) value = declaration[1].trim();
    }
    return value;
  }
  function changeStyle(key: string, value: string | number) {
    const node = element.value;
    if (!node) return;
    const text = String(value).trim();
    if (text) node.style.setProperty(key, text, 'important');
    else node.style.removeProperty(key);
    serialize();
  }
  function updateScript(value: string) {
    const script = scripts.value[scriptIndex.value];
    if (script) {
      script.textContent = value;
      serialize();
    }
  }
  function replaceIcon(value: string) {
    const node = element.value;
    if (!node) return;
    const document = new DOMParser().parseFromString(value, 'image/svg+xml');
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') return;
    const svg = document.documentElement;
    svg.setAttribute('id', node.id);
    node.replaceWith(parsed.value.importNode(svg, true));
    serialize();
  }
</script>
<template>
  <details class="mt-3 border-t border-line-subtle pt-3">
    <summary class="cursor-pointer text-xs font-semibold text-fg">Scene contents &amp; animation</summary>
    <div class="mt-3 flex flex-col gap-3">
      <div class="flex gap-1">
        <Button
          v-for="mode in ['elements', 'animation', 'source'] as const"
          :key="mode"
          size="xs"
          :variant="tab === mode ? 'secondary' : 'ghost'"
          @click="tab = mode"
        >
          {{ mode === 'elements' ? 'Elements' : mode === 'animation' ? 'Animation' : 'Source' }}
        </Button>
      </div>
      <template v-if="tab === 'elements'">
        <label class="flex flex-col gap-1 text-xs text-fg-muted">
          Element
          <select
            v-model="selected"
            aria-label="Scene element"
            class="h-8 w-full rounded-md border border-line bg-surface px-2 text-fg"
          >
            <option value="">Choose an element</option>
            <option v-for="node in elements" :key="node.id" :value="node.id">
              {{ node.localName }} · {{ node.id }}
            </option>
          </select>
        </label>
        <template v-if="element">
          <label v-for="field in fields" :key="field.key" class="flex flex-col gap-1 text-xs text-fg-muted">
            {{ field.label }}
            <Input
              :aria-label="field.label"
              :model-value="readStyle(field.key)"
              @update:model-value="(value) => changeStyle(field.key, value)"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs text-fg-muted">
            Replace icon
            <select
              aria-label="Icon preset"
              class="h-8 rounded-md border border-line bg-surface px-2 text-fg"
              @change="chooseIcon(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Choose an icon</option>
              <option v-for="(_, name) in iconChoices" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs text-fg-muted">
            Replace with SVG icon
            <textarea
              aria-label="SVG icon markup"
              class="min-h-24 w-full rounded-md border border-line bg-surface p-2 font-mono text-[10px] text-fg"
              :value="element.localName === 'svg' ? element.outerHTML : ''"
              @change="replaceIcon(($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </template>
        <p class="text-xs text-fg-subtle">
          Element styling preserves the scene animation. Shapes created by an animation script can be edited in
          Animation or Source.
        </p>
      </template>
      <template v-else-if="tab === 'animation'">
        <label class="flex flex-col gap-1 text-xs text-fg-muted">
          Script easing
          <select
            aria-label="Animation easing"
            class="h-8 rounded-md border border-line bg-surface px-2 text-fg"
            @change="setEase(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Keep authored easing</option>
            <option v-for="ease in easeChoices" :key="ease" :value="ease">{{ ease }}</option>
          </select>
        </label>
        <select
          v-model.number="scriptIndex"
          aria-label="Animation script"
          class="h-8 rounded-md border border-line bg-surface px-2 text-xs text-fg"
        >
          <option v-for="(_, index) in scripts" :key="index" :value="index">Animation script {{ index + 1 }}</option>
        </select>
        <textarea
          aria-label="Animation code"
          spellcheck="false"
          class="h-72 w-full resize-y rounded-md border border-line bg-surface p-2 font-mono text-[10px] text-fg"
          :value="scripts[scriptIndex]?.textContent ?? ''"
          @input="updateScript(($event.target as HTMLTextAreaElement).value)"
        />
        <p class="text-xs text-fg-subtle">
          Edit animation targets, timing, easing, generated shapes and icons. Apply to preview the change.
        </p>
      </template>
      <textarea
        v-else
        v-model="draft"
        aria-label="Composition source"
        spellcheck="false"
        class="h-80 w-full resize-y rounded-md border border-line bg-surface p-2 font-mono text-[10px] text-fg"
      />
      <Button variant="secondary" size="sm" :disabled="busy || draft === source" @click="emit('save', path, draft)">
        Apply composition changes
      </Button>
      <span class="truncate text-[10px] text-fg-subtle">{{ path }}</span>
    </div>
  </details>
</template>
