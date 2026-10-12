import { computed, ref, watch } from 'vue';

/**
 * "Schedule for later" state shared by the single-platform publish dialogs
 * (TikTok, YouTube, X, Instagram). Same rules as before: date + time must
 * resolve to a valid moment at least 5 minutes in the future.
 */
export function usePublishSchedule() {
  const isScheduled = ref(false);
  const scheduleDate = ref('');
  const scheduleTime = ref('');
  const scheduleError = ref<string | null>(null);

  const minDate = computed(() => new Date().toISOString().split('T')[0]);

  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });

  watch([scheduleDate, scheduleTime], () => {
    if (!isScheduled.value || !scheduledDateTime.value) {
      scheduleError.value = null;
      return;
    }
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    scheduleError.value =
      scheduledDateTime.value < minTime ? 'Schedule time must be at least 5 minutes in the future' : null;
  });

  function formatScheduleTime(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    const relative =
      diffMins < 60 ? `in ${diffMins} minutes` : diffHours < 24 ? `in ${diffHours} hours` : `in ${diffDays} days`;
    return `${relative} (${date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})`;
  }

  const scheduleSummary = computed(() =>
    scheduledDateTime.value ? formatScheduleTime(scheduledDateTime.value) : null
  );

  /** True when scheduling is off, or on with a valid future time. */
  const scheduleValid = computed(() => !isScheduled.value || (!!scheduledDateTime.value && !scheduleError.value));

  function resetSchedule() {
    isScheduled.value = false;
    scheduleDate.value = '';
    scheduleTime.value = '';
    scheduleError.value = null;
  }

  return {
    isScheduled,
    scheduleDate,
    scheduleTime,
    scheduleError,
    minDate,
    scheduledDateTime,
    scheduleSummary,
    scheduleValid,
    formatScheduleTime,
    resetSchedule,
  };
}
