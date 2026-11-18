<template>
  <Modal
    :open="modelValue"
    title="New project"
    description="Start blank and describe your video in the chat, or bring your own media."
    :icon="Wand2"
    size="md"
    :dismissible="!isCreating"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <Field label="Start with">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Start with">
          <OptionTile
            title="Nothing"
            :icon="Sparkles"
            description="Describe it in the chat. The AI designs every scene."
            :selected="start === 'blank'"
            @select="start = 'blank'"
          />
          <OptionTile
            title="My media"
            :icon="Film"
            description="Your videos, images, an example to copy, or a song."
            :selected="start === 'media'"
            @select="start = 'media'"
          />
        </div>
      </Field>

      <template v-if="start === 'media'">
        <Field label="Videos and images" class="animate-enter">
          <div class="flex flex-col gap-2">
            <div v-if="footage.length" class="flex flex-wrap gap-1.5">
              <ChatChip
                v-for="file in footage"
                :key="file.path"
                :icon="isPhoto(file.path) ? ImageIcon : Film"
                :label="file.name ?? fileName(file.path)"
                removable
                @remove="removeFile(file)"
              />
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" size="sm" @click="uploadFootage">
                <Upload />
                Upload
              </Button>
              <Button variant="secondary" size="sm" @click="picker = 'footage'">
                <Library />
                From library
              </Button>
            </div>
          </div>
        </Field>

        <Field
          label="Example to copy"
          hint="Optional. The AI copies how it's edited, never its footage or music."
          :error="exampleError"
          class="animate-enter"
        >
          <ChatChip
            v-if="exampleFile"
            :icon="Clapperboard"
            :label="fileName(exampleFile)"
            removable
            @remove="exampleFile = null"
          />
          <div v-else class="flex gap-2">
            <Input v-model="exampleUrl" type="url" placeholder="Paste an X or YouTube link" class="min-w-0 flex-1" />
            <Button
              variant="secondary"
              size="icon"
              title="Upload an example"
              aria-label="Upload an example"
              @click="uploadExample"
            >
              <Upload />
            </Button>
          </div>
        </Field>

        <Field label="Music" hint="Optional. Without a song, your clips keep their own sound." class="animate-enter">
          <ChatChip
            v-if="song"
            :icon="Music"
            :label="song.name ?? fileName(song.path)"
            removable
            @remove="removeFile(song)"
          />
          <div v-else class="flex gap-2">
            <Button variant="secondary" size="sm" @click="uploadSong">
              <Upload />
              Upload
            </Button>
            <Button variant="secondary" size="sm" @click="picker = 'music'">
              <Library />
              Audio library
            </Button>
          </div>
        </Field>
      </template>

      <Field label="Project name" for="ai-video-project-name">
        <Input
          id="ai-video-project-name"
          v-model="name"
          maxlength="120"
          placeholder="Named after your video if left blank"
          @keyup.enter="confirm"
        />
      </Field>
      <Field label="Creator" for="ai-video-creator">
        <select
          id="ai-video-creator"
          v-model="creatorProfileId"
          class="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
        >
          <option :value="null">No creator profile</option>
          <option v-for="profile in creatorProfiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
        </select>
      </Field>
      <Field label="Do you want motion graphics?" for="ai-video-motion">
        <select
          id="ai-video-motion"
          v-model="motionGraphics"
          class="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
        >
          <option value="none">No, just edit the footage</option>
          <option value="light">A few simple titles and callouts</option>
          <option value="full">Yes, animated scenes and graphics</option>
        </select>
      </Field>
      <label class="flex items-center gap-2 text-sm text-fg">
        <input v-model="usePlaybook" type="checkbox" class="accent-brand" />
        Use the Creator Edit Playbook for this project
      </label>
      <Button
        v-if="usePlaybook && selectedProfile?.video_playbook"
        variant="link"
        size="sm"
        class="self-start"
        @click="editingPreferences = !editingPreferences"
      >
        {{ editingPreferences ? 'Keep saved preferences' : 'Edit saved creator preferences' }}
      </Button>
      <div
        v-if="usePlaybook && selectedProfile && (!selectedProfile.video_playbook || editingPreferences)"
        class="space-y-3 rounded-lg border border-line p-3"
      >
        <p class="text-sm font-medium text-fg">Set up {{ selectedProfile.name }}'s editing preferences</p>
        <p class="text-xs text-muted">We'll save these to this creator profile. You can change them later.</p>
        <Field label="Who is this creator's audience?" for="ai-video-audience">
          <Input
            id="ai-video-audience"
            v-model="audience"
            placeholder="For example, new listeners interested in tech"
            maxlength="300"
          />
        </Field>
        <Field label="What editing style should we use?" for="ai-video-style">
          <Input
            id="ai-video-style"
            v-model="editingStyle"
            placeholder="For example, calm and conversational"
            maxlength="300"
          />
        </Field>
        <Field label="Any rules the AI must follow?" for="ai-video-rules">
          <Input
            id="ai-video-rules"
            v-model="hardRules"
            placeholder="For example, never cut a speaker mid-sentence"
            maxlength="1000"
          />
        </Field>
        <Field label="Captions" for="ai-video-captions">
          <select
            id="ai-video-captions"
            v-model="captions"
            class="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          >
            <option value="ask">Ask each project</option>
            <option value="yes">Usually on</option>
            <option value="no">Usually off</option>
          </select>
        </Field>
      </div>
      <p v-if="saveError" role="alert" class="text-sm text-red-500">{{ saveError }}</p>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isCreating || saving" @click="close">Cancel</Button>
      <Button variant="primary" :loading="isCreating || saving" :disabled="!canCreate || saving" @click="confirm">
        <Plus v-if="!isCreating && !saving" />
        {{ isCreating || saving ? 'Creating…' : 'Create' }}
      </Button>
    </template>

    <LibraryPicker
      :open="!!picker"
      :title="picker === 'music' ? 'Add a song' : 'Add videos and images'"
      :sources="picker === 'music' ? MUSIC_SOURCES : FOOTAGE_SOURCES"
      :initial="picker === 'music' ? 'audio-library' : 'built-clips'"
      :multiple="picker !== 'music'"
      @close="picker = null"
      @pick="addPicked"
    />
  </Modal>
</template>

<script setup lang="ts">
  /** New AI video project: start blank (chat only) or with videos, images, an example and a song. */
  import { computed, ref, watch } from 'vue';
  import {
    Clapperboard,
    Film,
    Image as ImageIcon,
    Library,
    Music,
    Plus,
    Sparkles,
    Upload,
    Wand2,
  } from 'lucide-vue-next';
  import ChatChip from '@/components/create/chat/ChatChip.vue';
  import OptionTile from '@/components/create/OptionTile.vue';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import {
    AUDIO_EXTENSIONS,
    PHOTO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    type MediaFile,
    fileExtension,
    fileName,
    pickFiles,
  } from '../analysis/media';
  import { isExampleLink } from '../analysis/reference';
  import type { LibrarySource } from '../library';
  import type { StartingSources } from '../startingSources';
  import { apiErrorMessage, listCreatorProfiles, saveCreatorVideoPlaybook, type VideoCreatorProfile } from '../api';
  import type { MotionGraphicsLevel } from '../types';
  import LibraryPicker from './LibraryPicker.vue';

  const FOOTAGE_SOURCES: LibrarySource[] = ['built-clips', 'projects', 'image-library'];
  const MUSIC_SOURCES: LibrarySource[] = ['audio-library'];

  const props = defineProps<{ modelValue: boolean; isCreating?: boolean }>();
  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [
      payload: {
        name: string;
        creatorProfileId: number | null;
        playbookEnabled: boolean;
        motionGraphics: MotionGraphicsLevel;
      } & StartingSources,
    ];
  }>();

  const start = ref<'blank' | 'media'>('blank');
  const files = ref<MediaFile[]>([]);
  const exampleUrl = ref('');
  const exampleFile = ref<string | null>(null);
  const name = ref('');
  const creatorProfileId = ref<number | null>(null);
  const creatorProfiles = ref<VideoCreatorProfile[]>([]);
  const usePlaybook = ref(false);
  const motionGraphics = ref<MotionGraphicsLevel>('light');
  const editingPreferences = ref(false);
  const selectedProfile = computed(() =>
    creatorProfiles.value.find((profile) => profile.id === creatorProfileId.value)
  );
  const audience = ref('');
  const editingStyle = ref('');
  const hardRules = ref('');
  const captions = ref<'ask' | 'yes' | 'no'>('ask');
  const saving = ref(false);
  const saveError = ref('');
  const picker = ref<'footage' | 'music' | null>(null);

  watch(selectedProfile, (profile) => {
    editingPreferences.value = false;
    audience.value = profile?.video_playbook?.audience ?? '';
    editingStyle.value = profile?.video_playbook?.editing_style ?? '';
    hardRules.value = profile?.video_playbook?.hard_rules ?? '';
    captions.value = profile?.video_playbook?.captions ?? 'ask';
  });

  const isAudio = (path: string) => AUDIO_EXTENSIONS.includes(fileExtension(path));
  const isPhoto = (path: string) => PHOTO_EXTENSIONS.includes(fileExtension(path));
  const footage = computed(() => files.value.filter((file) => !isAudio(file.path)));
  const song = computed(() => files.value.find((file) => isAudio(file.path)) ?? null);
  const exampleError = computed(() =>
    exampleUrl.value.trim() && !isExampleLink(exampleUrl.value) ? 'Paste the full link, starting with https://' : null
  );
  const example = computed<StartingSources['example']>(() => {
    if (exampleFile.value) return { kind: 'upload', value: exampleFile.value };
    return isExampleLink(exampleUrl.value) ? { kind: 'url', value: exampleUrl.value.trim() } : null;
  });
  const canCreate = computed(
    () => start.value === 'blank' || (!exampleError.value && (files.value.length > 0 || !!example.value))
  );

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;
      start.value = 'blank';
      files.value = [];
      exampleUrl.value = '';
      exampleFile.value = null;
      name.value = '';
      creatorProfileId.value = null;
      usePlaybook.value = false;
      motionGraphics.value = 'light';
      audience.value = '';
      editingStyle.value = '';
      hardRules.value = '';
      captions.value = 'ask';
      saveError.value = '';
      void listCreatorProfiles()
        .then((profiles) => {
          creatorProfiles.value = profiles;
        })
        .catch(() => {
          creatorProfiles.value = [];
        });
    }
  );

  /** Adds files, skipping ones already picked; a new song replaces the old one. */
  function addFiles(added: MediaFile[]) {
    const known = new Set(files.value.map((file) => file.path));
    const fresh = added.filter((file) => !known.has(file.path));
    const newSong = fresh.filter((file) => isAudio(file.path)).pop();
    files.value = [...files.value, ...fresh].filter(
      (file) => !isAudio(file.path) || file === newSong || (!newSong && file === song.value)
    );
  }

  function removeFile(target: MediaFile) {
    files.value = files.value.filter((file) => file !== target);
  }

  function addPicked(picked: MediaFile[]) {
    picker.value = null;
    addFiles(picked);
  }

  async function uploadFootage() {
    addFiles(
      (await pickFiles([...VIDEO_EXTENSIONS, ...PHOTO_EXTENSIONS], true, 'Videos and images')).map((path) => ({ path }))
    );
  }

  async function uploadSong() {
    addFiles((await pickFiles(AUDIO_EXTENSIONS, false, 'Song')).map((path) => ({ path })));
  }

  async function uploadExample() {
    const [path] = await pickFiles(VIDEO_EXTENSIONS, false, 'Example video');
    if (path) exampleFile.value = path;
  }

  function close() {
    if (props.isCreating) return;
    emit('update:modelValue', false);
  }

  async function confirm() {
    if (!canCreate.value || props.isCreating || saving.value) return;
    if (
      usePlaybook.value &&
      selectedProfile.value &&
      (!selectedProfile.value.video_playbook || editingPreferences.value)
    ) {
      saving.value = true;
      saveError.value = '';
      const playbook = {
        audience: audience.value.trim(),
        editing_style: editingStyle.value.trim(),
        hard_rules: hardRules.value.trim(),
        captions: captions.value,
      };
      try {
        await saveCreatorVideoPlaybook(selectedProfile.value.id, playbook);
        selectedProfile.value.video_playbook = playbook;
      } catch (error) {
        saveError.value = apiErrorMessage(error, 'Could not save creator preferences.');
        saving.value = false;
        return;
      }
      saving.value = false;
    }
    const media = start.value === 'media';
    emit('confirm', {
      name: name.value.trim(),
      creatorProfileId: creatorProfileId.value,
      playbookEnabled: usePlaybook.value,
      motionGraphics: motionGraphics.value,
      files: media ? files.value : [],
      example: media ? example.value : null,
    });
  }
</script>
