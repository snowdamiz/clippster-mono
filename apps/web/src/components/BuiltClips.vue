<template>
  <div class="clips-page h-full"><PageLayout title="Built Clips" description="Browse and manage your generated video clips" :show-header="true" :icon="LayoutGrid">
    <template #actions><div class="clips-header-actions">
      <div class="clips-header__search shrink-0"><Search class="clips-header__search-icon" /><input v-model="library.search.value" placeholder="Search clips..." class="clips-header__search-input" /></div>
      <CustomDropdown class="clips-header__filter" v-model="library.status.value" :options="[{value:'all',label:'All Status'},{value:'published',label:'Published'},{value:'unpublished',label:'Unpublished'}]" trigger-class="clips-header__dropdown-trigger" />
      <CustomDropdown class="clips-header__filter" v-model="library.ratio.value" :options="ratioOptions" trigger-class="clips-header__dropdown-trigger" />
      <CustomDropdown class="clips-header__filter clips-header__filter--wide" v-model="library.projectFilter.value" :options="projectOptions" trigger-class="clips-header__dropdown-trigger" />
      <CustomDropdown class="clips-header__sort" v-model="library.sort.value" :options="[{value:'newest',label:'Newest'},{value:'oldest',label:'Oldest'},{value:'name',label:'Name'}]" trigger-class="clips-header__dropdown-trigger" />
      <div class="clips-header__view-toggle"><button title="Folder View" class="clips-header__view-btn" :class="{'clips-header__view-btn--active': library.view.value==='folders'}" @click="library.view.value='folders'; library.folder.value=null"><Folder :size="16" /></button><button title="List View" class="clips-header__view-btn" :class="{'clips-header__view-btn--active': library.view.value==='list'}" @click="library.view.value='list'; library.folder.value=null"><List :size="16" /></button></div>
    </div></template>
    <div class="clips__content"><div class="clips__heading"><h1 class="clips__title">Built Clips</h1><p class="clips__subtitle">Browse and manage your generated video clips</p></div>
      <p v-if="library.error.value" role="alert" class="mb-4 text-red-400">{{ library.error.value }}</p>
      <p v-if="library.loading.value" role="status">Loading built clips…</p>
      <template v-else>
        <div v-if="library.selected.value.length" class="clips__selection-bar"><span>{{ library.selected.value.length }} selected</span><button @click="library.selected.value=[]">Clear</button><button class="clips__selection-delete" @click="deleting=[...library.selected.value]">Delete Selected</button></div>
        <button v-if="library.folder.value" class="mb-4 text-cyan-400" @click="library.folder.value=null">← All folders</button>
        <div v-if="library.view.value==='folders' && !library.folder.value" class="clips__grid">
          <button v-for="group in library.folders.value" :key="group.project.id" :aria-label="group.project.name" class="clips-card relative aspect-video overflow-hidden text-left" @click="library.folder.value=group.project.id">
            <img :src="group.items[0].thumbnail" class="h-full w-full object-cover" alt="" /><div class="clips-card__bottom"><h3 class="text-base font-bold">{{ group.project.name }}</h3><p>{{ group.items.length }} built clips</p></div>
          </button>
        </div>
        <div v-else class="clips__grid"><div v-for="item in library.paginated.value" :key="item.id" class="relative" :data-build-id="item.id">
          <input type="checkbox" class="absolute left-2 top-2 z-20" :aria-label="`Select ${item.clip.name} ${item.build.aspectRatio}`" :checked="library.selected.value.includes(item.id)" @change="library.toggle(item.id)" />
          <BuildCard :build="item.native" :clip-name="item.clip.name" :thumbnail-url="item.thumbnail" :project-name="item.project.name" :file-path="item.download" :display-aspect-ratio="item.build.aspectRatio" @play="playing=item" @save="library.download(item.download)" @delete="deleting=[item.id]" @open-project="$emit('open', item.project.id, item.clip.id)" @publish="publishing=item" />
        </div></div>
        <PaginationFooter v-if="library.view.value==='list' || library.folder.value" mode="static" :current-page="library.page.value" :total-pages="library.totalPages.value" :total-items="library.visible.value.length" item-label="build" @go-to-page="library.page.value=$event" @previous="library.page.value--" @next="library.page.value++" />
        <div v-if="!library.filtered.value.length" class="clips__empty"><LayoutGrid class="clips__empty-icon" /><h2 class="clips__empty-title">{{ library.items.value.length ? 'No matching clips' : 'No Built Clips Yet' }}</h2><p class="clips__empty-description">{{ library.items.value.length ? 'Try changing your search or filters.' : 'Build a clip in your Video Library to see it here.' }}</p></div>
      </template>
    </div>
  </PageLayout>
  <VideoPlayerDialog :video="null" :show-video-player="!!playing" :video-url="playing?.playback" :video-title="playing?.clip.name" @close="playing=null" />
  <ConfirmationModal :show="!!deleting.length" title="Delete Build" message="Delete" :item-name="`${deleting.length} saved build${deleting.length===1?'':'s'}`" suffix="? The exported files will be removed. Your source video and clip settings will remain." confirm-text="Delete Build" variant="destructive" @close="deleting=[]" @confirm="deleteConfirmed" />
  <BuiltClipPublish v-if="publishing" :key="publishing.id" :item="publishing" @close="publishing=null" @published="publishing=null; library.load()" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import { LayoutGrid, Search, Folder, List } from 'lucide-vue-next'
import PageLayout from '@/components/PageLayout.vue'
import CustomDropdown from '@/components/CustomDropdown.vue'
import BuildCard from '@/components/BuildCard.vue'
import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import PaginationFooter from '@/components/PaginationFooter.vue'
import BuiltClipPublish from './BuiltClipPublish.vue'
import { useBuiltClips, type BuiltClipItem } from '../useBuiltClips'
defineEmits<{ open: [projectId: string, clipId: string] }>()
const library = useBuiltClips(), playing = ref<BuiltClipItem | null>(null), publishing = ref<BuiltClipItem | null>(null), deleting = ref<string[]>([])
const ratioOptions = [{value:'all',label:'All Ratios'}, ...['16:9','9:16','1:1','4:5'].map(value=>({value,label:value}))]
const projectOptions = computed(()=>[{value:'all',label:'All Projects'},...library.projects.value.map(project=>({value:project.id,label:project.name}))])
async function deleteConfirmed() { const ids=deleting.value; deleting.value=[]; await library.remove(ids) }
</script>
<style scoped src="@/styles/builtClips.css"></style>
