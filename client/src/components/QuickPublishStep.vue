<template>
  <section class="flex flex-col gap-4">
    <!-- Build progress -->
    <Alert v-if="buildState.status === 'building'" variant="info">
      <Loader2 class="animate-spin" />
      <AlertDescription class="flex flex-col gap-2">
        <span class="tabular">Building clip… {{ buildState.progress }}%</span>
        <span class="block h-1 overflow-hidden rounded-full bg-surface-active">
          <span
            class="block h-full rounded-full bg-brand transition-[width]"
            :style="{ width: `${buildState.progress}%` }"
          />
        </span>
      </AlertDescription>
    </Alert>
    <Alert v-else-if="buildState.status === 'error'" variant="destructive">
      <AlertCircle />
      <AlertDescription>Build failed: {{ buildState.error }}</AlertDescription>
    </Alert>

    <!-- Multi-target builds, grouped by aspect ratio -->
    <div v-if="buildTargets.length > 0" class="flex flex-col gap-3">
      <SectionHeader
        title="Built clips"
        :count="buildTargets.length"
        description="Select platforms and accounts for each aspect ratio"
      />
      <div
        v-for="(targets, aspectRatio) in groupedBuildTargets"
        :key="aspectRatio"
        class="flex flex-col gap-3 border-t border-line-subtle pt-3"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" size="md" class="tabular">{{ aspectRatio }}</Badge>
          <Badge v-for="target in targets" :key="`${target.type}-${target.id}`" variant="neutral">
            <Megaphone v-if="target.type === 'campaign'" />
            <Building2 v-else-if="target.type === 'org'" />
            {{ target.name }}
          </Badge>
        </div>

        <Field label="Platforms" required>
          <PublishPlatformPicker
            :platforms="availablePlatforms"
            :selected="getSelectedPlatformsForAspectRatio(aspectRatio)"
            @toggle="(platformId) => togglePlatformForAspectRatio(aspectRatio, platformId)"
          />
        </Field>

        <Field v-if="getSelectedPlatformsForAspectRatio(aspectRatio).length > 0" label="Accounts" required>
          <div class="flex flex-col gap-2">
            <PublishPlatformRow
              v-for="platformId in getSelectedPlatformsForAspectRatio(aspectRatio)"
              :key="platformId"
              :platform="platformId"
              :label="getPlatformLabel(platformId)"
            >
              <PublishAccountSelect
                :model-value="targets[0].selectedPlatforms.get(platformId)"
                :groups="accountGroupsFor(platformId)"
                @update:model-value="(v) => selectAccountForAspectRatio(aspectRatio, platformId, v)"
              />
            </PublishPlatformRow>
          </div>
        </Field>
      </div>
    </div>

    <!-- Single build -->
    <template v-else>
      <Field
        label="Platforms"
        required
        :hint="selectedPublishPlatforms.length === 0 ? 'Select at least one platform' : undefined"
      >
        <PublishPlatformPicker
          :platforms="availablePlatforms"
          :selected="selectedPublishPlatforms"
          @toggle="togglePlatform"
        />
      </Field>

      <Field v-if="selectedPublishPlatforms.length > 0" label="Accounts" required>
        <div class="flex flex-col gap-2">
          <PublishPlatformRow
            v-for="platformId in selectedPublishPlatforms"
            :key="platformId"
            :platform="platformId"
            :label="getPlatformLabel(platformId)"
            :note="selectedRatios.length > 1 ? null : platformConfigs[platformId]?.aspectRatio"
          >
            <SegmentedControl
              v-if="selectedRatios.length > 1"
              :model-value="platformConfigs[platformId]?.aspectRatio ?? ''"
              :options="ratioOptions"
              size="sm"
              class="self-start"
              @update:model-value="(ratio) => selectAspectRatio(platformId, String(ratio))"
            />
            <PublishAccountSelect
              :model-value="platformConfigs[platformId]?.accountId"
              :groups="accountGroupsFor(platformId)"
              @update:model-value="(v) => selectAccount(platformId, v)"
            />
          </PublishPlatformRow>
        </div>
      </Field>
    </template>

    <PublishCaptionField v-model="caption" :maxlength="2200" />
  </section>
</template>
<script lang="ts">
  import { defineComponent } from 'vue';
  import { publishStepPresentation } from '@/lib/sharedViewPresentation';
  import { Megaphone, Loader2, AlertCircle, Building2 } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';

  import { Field } from '@/components/ui/field';

  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';

  import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
  import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';

  import PublishPlatformPicker from '@/components/publish/PublishPlatformPicker.vue';
  import PublishPlatformRow from '@/components/publish/PublishPlatformRow.vue';

  export default defineComponent({
    components: {
      Megaphone,
      Loader2,
      AlertCircle,
      Building2,
      Alert,
      AlertDescription,
      Badge,
      Field,
      SectionHeader,
      SegmentedControl,
      PublishAccountSelect,
      PublishCaptionField,
      PublishPlatformPicker,
      PublishPlatformRow,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, publishStepPresentation(props.model));
    },
  });
</script>
