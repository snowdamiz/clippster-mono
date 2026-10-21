<template>
  <div class="relative h-full min-h-0 w-full"><PageLayout title="Built Clips" description="Browse and manage your generated video clips" :show-header="true" :icon="LayoutGrid">
    <template #toolbar>
      <SelectionBar v-if="library.selected.value.length" :count="library.selected.value.length" :total="library.paginated.value.length" @clear="library.selected.value=[]" @select-all="library.selected.value=library.paginated.value.map(item => item.id)">
        <Button variant="destructive-soft" size="sm" @click="deleting=[...library.selected.value]">Delete Selected</Button>
      </SelectionBar>
      <div v-else class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <SearchField v-model="library.search.value" placeholder="Search clips..." class="min-w-36 max-w-[260px] flex-1" />
        <CustomDropdown class="w-32" v-model="library.status.value" :options="[{value:'all',label:'All Status'},{value:'published',label:'Published'},{value:'unpublished',label:'Unpublished'}]" />
        <CustomDropdown class="w-28" v-model="library.ratio.value" :options="ratioOptions" />
        <CustomDropdown class="w-40" v-model="library.projectFilter.value" :options="projectOptions" />
        <CustomDropdown class="ml-auto w-36" v-model="library.sort.value" :options="[{value:'newest',label:'Newest'},{value:'oldest',label:'Oldest'},{value:'name',label:'Name'}]" />
        <div class="flex items-center gap-1 rounded-lg border border-line p-0.5">
          <Button title="Folder View" aria-label="Folder View" variant="ghost" size="icon-sm" :aria-pressed="library.view.value==='folders'" @click="library.view.value='folders'; library.folder.value=null"><Folder /></Button>
          <Button title="List View" aria-label="List View" variant="ghost" size="icon-sm" :aria-pressed="library.view.value==='list'" @click="library.view.value='list'; library.folder.value=null"><List /></Button>
        </div>
      </div>
    </template>
    <div class="flex flex-1 flex-col gap-4 px-5 py-4">
      <p v-if="library.error.value" role="alert" class="mb-4 text-red-400">{{ library.error.value }}</p>
      <p v-if="library.loading.value" role="status">Loading built clips…</p>
      <template v-else>
        <Button v-if="library.folder.value" variant="ghost" class="self-start" @click="library.folder.value=null">← All folders</Button>
        <div v-if="library.view.value==='folders' && !library.folder.value" class="card-grid">
          <button v-for="group in library.folders.value" :key="group.project.id" :aria-label="group.project.name" class="overflow-hidden rounded-xl border border-line-subtle bg-surface text-left transition-colors hover:border-line" @click="library.folder.value=group.project.id">
            <img :src="group.items[0].thumbnail" class="aspect-video w-full object-cover" alt="" /><div class="flex flex-col gap-1 px-3 py-2.5"><h3 class="truncate text-sm font-semibold text-fg">{{ group.project.name }}</h3><p class="text-xs text-fg-muted">{{ group.items.length }} built clips</p></div>
          </button>
        </div>
        <div v-else class="card-grid"><div v-for="item in library.paginated.value" :key="item.id" class="relative" :data-build-id="item.id">
          <input type="checkbox" class="absolute left-2 top-2 z-20" :aria-label="`Select ${item.clip.name} ${item.build.aspectRatio}`" :checked="library.selected.value.includes(item.id)" @change="library.toggle(item.id)" />
          <BuildCard :build="item.native" :clip-name="item.clip.name" :thumbnail-url="item.thumbnail" :project-name="item.project.name" :file-path="item.download" :display-aspect-ratio="item.build.aspectRatio" @play="playing=item" @save="library.download(item.download)" @delete="deleting=[item.id]" @open-project="$emit('open', item.project.id, item.clip.id)" @publish="publishing=item" />
        </div></div>
        <PaginationFooter v-if="library.view.value==='list' || library.folder.value" mode="static" :current-page="library.page.value" :total-pages="library.totalPages.value" :total-items="library.visible.value.length" item-label="build" @go-to-page="library.page.value=$event" @previous="library.page.value--" @next="library.page.value++" />
        <EmptyState v-if="!library.filtered.value.length" :icon="LayoutGrid" :title="library.items.value.length ? 'No matching clips' : 'No Built Clips Yet'" :description="library.items.value.length ? 'Try changing your search or filters.' : 'Build a clip in your Video Library to see it here.'" />
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
import { LayoutGrid, Folder, List } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/ui/search-field'
import { SelectionBar } from '@/components/ui/selection-bar'
import { EmptyState } from '@/components/ui/empty-state'
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
