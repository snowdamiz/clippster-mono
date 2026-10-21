<template><div ref="host" /></template>

<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
  import { mountEmailComposer } from '../../../../packages/email-composer/src/composer';

  const props = defineProps<{ modelValue: string; subject: string; preheader: string; audience: string }>();
  const emit = defineEmits<{ 'update:modelValue': [string]; valid: [boolean] }>();
  const host = ref<HTMLElement>();
  let composer: ReturnType<typeof mountEmailComposer> | undefined;
  const current = () => ({
    body: props.modelValue,
    subject: props.subject,
    preheader: props.preheader,
    audience: props.audience,
  });
  onMounted(() => {
    composer = mountEmailComposer(host.value!, current(), (body, valid) => {
      emit('update:modelValue', body);
      emit('valid', valid);
    });
  });
  watch(
    () => [props.modelValue, props.subject, props.preheader, props.audience],
    () => composer?.update(current())
  );
  onBeforeUnmount(() => composer?.destroy());
</script>
