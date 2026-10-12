<script setup lang="ts">
  /**
   * Promo code row for checkout dialogs, driven by `usePromoCode`:
   *
   *   <PromoCodeField id="subscribe-promo" v-model="promo.code.value" :promo="promo.promo.value"
   *     :validating="promo.validating.value" :error="promo.error.value"
   *     @apply="promo.apply" @clear="promo.clear" />
   *
   * Apply validates the code; once applied the input locks and Remove clears it.
   */
  import { computed } from 'vue';
  import { Check } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import type { ValidatedPromo } from '@/composables/usePromoCode';

  const props = defineProps<{
    id: string;
    promo: ValidatedPromo | null;
    validating: boolean;
    error: string;
    placeholder?: string;
  }>();

  const code = defineModel<string>({ required: true });
  const emit = defineEmits<{ apply: []; clear: [] }>();

  const appliedText = computed(() => {
    const promo = props.promo;
    if (!promo) return '';
    if (promo.promo_type === 'bundle') {
      return `Bundle: ${promo.access_months} months + ${promo.total_credits?.toLocaleString()} credits`;
    }
    return `${promo.percent_off}% discount applied`;
  });
</script>

<template>
  <Field label="Promo code" :for="id" :error="error || null">
    <div class="flex gap-2">
      <Input
        :id="id"
        v-model="code"
        :placeholder="placeholder ?? 'Optional'"
        autocomplete="off"
        :disabled="!!promo || validating"
        @keyup.enter="emit('apply')"
      />
      <Button v-if="promo" variant="ghost" @click="emit('clear')">Remove</Button>
      <Button v-else variant="secondary" :loading="validating" :disabled="!code.trim()" @click="emit('apply')">
        Apply
      </Button>
    </div>
    <p v-if="promo" class="mt-1.5 flex animate-fade-in items-center gap-1.5 text-xs font-medium text-success">
      <Check class="size-3.5 shrink-0" />
      {{ appliedText }}
    </p>
  </Field>
</template>
