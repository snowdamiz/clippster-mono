import { ref, watch, type Ref } from 'vue';

/**
 * Base interface for items managed by panels
 */
export interface PanelItem {
  id: string;
}

/**
 * Options for usePanelCRUD
 */
export interface PanelCRUDOptions<T extends PanelItem> {
  /** Reference to the current edit ID */
  editId: Ref<string | null>;
  /** Function to load items from database */
  loadFn: (editId: string) => Promise<T[]>;
  /** Function to create a new item */
  createFn: (editId: string, data: Partial<T>) => Promise<T>;
  /** Function to update an existing item */
  updateFn: (id: string, data: Partial<T>) => Promise<void>;
  /** Function to delete an item */
  deleteFn: (id: string) => Promise<void>;
  /** Optional callback after any operation */
  onUpdate?: () => void;
  /** Whether to auto-load on mount/editId change (default: true) */
  autoLoad?: boolean;
}

/**
 * Return type for usePanelCRUD
 */
export interface PanelCRUDReturn<T extends PanelItem> {
  /** Array of items */
  items: Ref<T[]>;
  /** Whether items are currently loading */
  isLoading: Ref<boolean>;
  /** Currently selected item ID */
  selectedId: Ref<string | null>;
  /** Load items from database */
  load: () => Promise<void>;
  /** Create a new item */
  create: (data: Partial<T>) => Promise<T>;
  /** Update an existing item */
  update: (id: string, data: Partial<T>) => Promise<void>;
  /** Delete an item */
  remove: (id: string) => Promise<void>;
  /** Select an item */
  select: (item: T) => void;
  /** Deselect current item */
  deselect: () => void;
  /** Get item by ID */
  getById: (id: string) => T | undefined;
}

/**
 * usePanelCRUD - Factory for panel CRUD operations
 *
 * Extracts the duplicated CRUD pattern from:
 * - AudioPanel (loadAudioTracks, removeTrack, updateTrack*)
 * - TextPanel (loadTextOverlays, deleteText)
 * - StickersPanel (loadStickers, deleteSticker)
 *
 * This composable provides a consistent interface for:
 * - Loading items
 * - Creating new items
 * - Updating existing items
 * - Deleting items
 * - Selection management
 *
 * Usage:
 * ```ts
 * // In AudioPanel
 * const {
 *   items: audioTracks,
 *   isLoading,
 *   selectedId,
 *   load,
 *   create,
 *   update,
 *   remove,
 *   select
 * } = usePanelCRUD({
 *   editId: toRef(props, 'editId'),
 *   loadFn: getVideoEditorAudioTracksByEditId,
 *   createFn: createVideoEditorAudioTrack,
 *   updateFn: updateVideoEditorAudioTrack,
 *   deleteFn: deleteVideoEditorAudioTrack,
 *   onUpdate: () => emit('tracksUpdated')
 * });
 *
 * // Create new track
 * const newTrack = await create({
 *   file_path: filePath,
 *   name: 'New Track',
 *   start_time: 0,
 *   end_time: duration
 * });
 *
 * // Update track
 * await update(trackId, { volume: 0.5 });
 *
 * // Delete track
 * await remove(trackId);
 * ```
 */
export function usePanelCRUD<T extends PanelItem>(
  options: PanelCRUDOptions<T>
): PanelCRUDReturn<T> {
  const {
    editId,
    loadFn,
    createFn,
    updateFn,
    deleteFn,
    onUpdate,
    autoLoad = true,
  } = options;

  const items = ref<T[]>([]) as Ref<T[]>;
  const isLoading = ref(false);
  const selectedId = ref<string | null>(null);

  /**
   * Load items from database
   */
  async function load(): Promise<void> {
    if (!editId.value) {
      items.value = [];
      return;
    }

    try {
      isLoading.value = true;
      items.value = await loadFn(editId.value);
    } catch (error) {
      console.error('[usePanelCRUD] Failed to load items:', error);
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new item
   */
  async function create(data: Partial<T>): Promise<T> {
    if (!editId.value) {
      throw new Error('No edit ID available');
    }

    try {
      const newItem = await createFn(editId.value, data);
      await load();
      onUpdate?.();
      return newItem;
    } catch (error) {
      console.error('[usePanelCRUD] Failed to create item:', error);
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  async function update(id: string, data: Partial<T>): Promise<void> {
    try {
      await updateFn(id, data);
      // Optionally reload to get updated data
      // await load();
      onUpdate?.();
    } catch (error) {
      console.error('[usePanelCRUD] Failed to update item:', error);
      throw error;
    }
  }

  /**
   * Delete an item
   */
  async function remove(id: string): Promise<void> {
    try {
      await deleteFn(id);

      // Clear selection if deleted item was selected
      if (selectedId.value === id) {
        selectedId.value = null;
      }

      await load();
      onUpdate?.();
    } catch (error) {
      console.error('[usePanelCRUD] Failed to delete item:', error);
      throw error;
    }
  }

  /**
   * Select an item
   */
  function select(item: T): void {
    selectedId.value = item.id;
  }

  /**
   * Deselect current item
   */
  function deselect(): void {
    selectedId.value = null;
  }

  /**
   * Get item by ID
   */
  function getById(id: string): T | undefined {
    return items.value.find((item) => item.id === id);
  }

  // Auto-load when editId changes
  if (autoLoad) {
    watch(
      editId,
      (newEditId) => {
        if (newEditId) {
          load();
        } else {
          items.value = [];
        }
      },
      { immediate: true }
    );
  }

  return {
    items,
    isLoading,
    selectedId,
    load,
    create,
    update,
    remove,
    select,
    deselect,
    getById,
  };
}

/**
 * Create a typed version of usePanelCRUD for audio tracks
 */
export function useAudioTracksCRUD(
  editId: Ref<string | null>,
  onUpdate?: () => void
) {
  // Import dynamically to avoid circular dependencies
  const loadFn = async (id: string) => {
    const { getVideoEditorAudioTracksByEditId } = await import(
      '@/services/database/video-editor-edits'
    );
    return getVideoEditorAudioTracksByEditId(id);
  };

  const createFn = async (id: string, data: any) => {
    const { createVideoEditorAudioTrack } = await import(
      '@/services/database/video-editor-edits'
    );
    return createVideoEditorAudioTrack(id, data);
  };

  const updateFn = async (id: string, data: any) => {
    const { updateVideoEditorAudioTrack } = await import(
      '@/services/database/video-editor-edits'
    );
    return updateVideoEditorAudioTrack(id, data);
  };

  const deleteFn = async (id: string) => {
    const { deleteVideoEditorAudioTrack } = await import(
      '@/services/database/video-editor-edits'
    );
    return deleteVideoEditorAudioTrack(id);
  };

  return usePanelCRUD({
    editId,
    loadFn,
    createFn,
    updateFn,
    deleteFn,
    onUpdate,
  });
}

/**
 * Create a typed version of usePanelCRUD for text overlays
 */
export function useTextOverlaysCRUD(
  editId: Ref<string | null>,
  onUpdate?: () => void
) {
  const loadFn = async (id: string) => {
    const { getVideoEditorTextOverlaysByEditId } = await import(
      '@/services/database/video-editor-edits'
    );
    return getVideoEditorTextOverlaysByEditId(id);
  };

  const createFn = async (id: string, data: any) => {
    const { createVideoEditorTextOverlay } = await import(
      '@/services/database/video-editor-edits'
    );
    return createVideoEditorTextOverlay(id, data);
  };

  const updateFn = async (id: string, data: any) => {
    const { updateVideoEditorTextOverlay } = await import(
      '@/services/database/video-editor-edits'
    );
    return updateVideoEditorTextOverlay(id, data);
  };

  const deleteFn = async (id: string) => {
    const { deleteVideoEditorTextOverlay } = await import(
      '@/services/database/video-editor-edits'
    );
    return deleteVideoEditorTextOverlay(id);
  };

  return usePanelCRUD({
    editId,
    loadFn,
    createFn,
    updateFn,
    deleteFn,
    onUpdate,
  });
}

/**
 * Create a typed version of usePanelCRUD for stickers
 */
export function useStickersCRUD(
  editId: Ref<string | null>,
  onUpdate?: () => void
) {
  const loadFn = async (id: string) => {
    const { getVideoEditorStickersByEditId } = await import(
      '@/services/database/video-editor-edits'
    );
    return getVideoEditorStickersByEditId(id);
  };

  const createFn = async (id: string, data: any) => {
    const { createVideoEditorSticker } = await import(
      '@/services/database/video-editor-edits'
    );
    return createVideoEditorSticker(id, data);
  };

  const updateFn = async (id: string, data: any) => {
    const { updateVideoEditorSticker } = await import(
      '@/services/database/video-editor-edits'
    );
    return updateVideoEditorSticker(id, data);
  };

  const deleteFn = async (id: string) => {
    const { deleteVideoEditorSticker } = await import(
      '@/services/database/video-editor-edits'
    );
    return deleteVideoEditorSticker(id);
  };

  return usePanelCRUD({
    editId,
    loadFn,
    createFn,
    updateFn,
    deleteFn,
    onUpdate,
  });
}

/**
 * Media types supported by the media panel
 */
export type MediaType = 'video' | 'image' | 'audio';

/**
 * Project media item interface (matches ProjectMedia from database)
 */
export interface MediaItem {
  id: string;
  project_id: string;
  media_type: MediaType;
  file_path: string;
  file_name: string;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  is_favorite: boolean;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  user_id: string | null;
}

/**
 * Options for useMediaCRUD
 */
export interface MediaCRUDOptions {
  /** Reference to the current project ID */
  projectId: Ref<string | null>;
  /** Reference to the current edit ID (for adding to timeline) */
  editId: Ref<string | null>;
  /** Optional callback after any operation */
  onUpdate?: () => void;
  /** Optional callback when media is added to timeline */
  onMediaAdded?: (mediaId: string) => void;
}

/**
 * Return type for useMediaCRUD
 */
export interface MediaCRUDReturn {
  /** Array of media items */
  mediaItems: Ref<MediaItem[]>;
  /** Whether items are currently loading */
  isLoading: Ref<boolean>;
  /** Load media items from database */
  load: () => Promise<void>;
  /** Handle file upload dialog and add media */
  handleUploadClick: () => Promise<void>;
  /** Add media item to timeline */
  addToTimeline: (item: MediaItem) => Promise<void>;
  /** Delete a media item */
  deleteMedia: (mediaId: string) => Promise<void>;
  /** Helper to get media type from file extension */
  getMediaTypeFromExtension: (extension: string) => MediaType;
}

/**
 * useMediaCRUD - Extract media panel CRUD operations
 *
 * This composable handles:
 * - Loading media items for a project
 * - File upload dialog and media creation
 * - Adding media to timeline (audio tracks, etc.)
 * - Deleting media items
 *
 * Extracted from MediaPanel.vue:
 * - loadMedia()
 * - handleUploadClick()
 * - addToTimeline()
 * - deleteMedia()
 * - getMediaTypeFromExtension()
 *
 * Usage:
 * ```ts
 * const projectId = ref<string | null>('project-123');
 * const editId = ref<string | null>('edit-456');
 *
 * const {
 *   mediaItems,
 *   isLoading,
 *   load,
 *   handleUploadClick,
 *   addToTimeline,
 *   deleteMedia,
 * } = useMediaCRUD({
 *   projectId,
 *   editId,
 *   onUpdate: () => emit('mediaUpdated'),
 *   onMediaAdded: (id) => emit('mediaAdded', id),
 * });
 * ```
 */
export function useMediaCRUD(options: MediaCRUDOptions): MediaCRUDReturn {
  const { projectId, editId, onUpdate, onMediaAdded } = options;

  const mediaItems = ref<MediaItem[]>([]) as Ref<MediaItem[]>;
  const isLoading = ref(false);

  /**
   * Video file extensions
   */
  const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

  /**
   * Audio file extensions
   */
  const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac'];

  /**
   * Image file extensions
   */
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

  /**
   * All supported media extensions for file dialog
   */
  const ALL_MEDIA_EXTENSIONS = [
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
  ];

  /**
   * Get media type from file extension
   */
  function getMediaTypeFromExtension(extension: string): MediaType {
    const ext = extension.toLowerCase();
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    return 'video'; // Default fallback
  }

  /**
   * Load media items from database
   */
  async function load(): Promise<void> {
    if (!projectId.value) {
      mediaItems.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const { getProjectMedia } = await import('@/services/database/project-media');
      mediaItems.value = await getProjectMedia(projectId.value);
    } catch (error) {
      console.error('[useMediaCRUD] Failed to load media:', error);
      mediaItems.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Handle file upload dialog and add media to project
   */
  async function handleUploadClick(): Promise<void> {
    if (!projectId.value) {
      console.error('[useMediaCRUD] No project ID');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      // Open file dialog for media files
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: ALL_MEDIA_EXTENSIONS,
          },
        ],
      });

      if (!selected) return;

      isLoading.value = true;

      const { addProjectMedia } = await import('@/services/database/project-media');
      const filePaths = Array.isArray(selected) ? selected : [selected];

      for (const filePath of filePaths) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        const mediaType = getMediaTypeFromExtension(extension);

        await addProjectMedia(projectId.value, {
          mediaType,
          filePath,
          fileName,
        });
      }

      await load();
      onUpdate?.();
    } catch (error) {
      console.error('[useMediaCRUD] Failed to upload files:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add media item to timeline
   * For audio: creates audio track with duration
   * For video/image: creates video source (video track)
   */
  async function addToTimeline(item: MediaItem): Promise<void> {
    if (!editId.value || !projectId.value) {
      console.error('[useMediaCRUD] No edit ID or project ID');
      return;
    }

    console.log('[useMediaCRUD] Adding media to timeline:', item);

    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const { updateProjectMedia } = await import('@/services/database/project-media');
      const { getVideoEditorProjectWithSources, updateVideoEditorProject, getVideoEditorSourcesByProjectId, createVideoEditorSource } = await import(
        '@/services/database/video-editor-projects'
      );

      // For audio files, create an audio track
      if (item.media_type === 'audio') {
        // Get actual audio duration from the file using streaming server
        const { invoke } = await import('@tauri-apps/api/core');
        let videoServerPort = 48276; // Default fallback
        try {
          videoServerPort = await invoke<number>('get_video_server_port');
        } catch (error) {
          console.warn('[useMediaCRUD] Failed to get video server port, using default:', error);
        }
        
        // Encode the path as base64 for the streaming server
        const encodedPath = btoa(unescape(encodeURIComponent(item.file_path)));
        const audioUrl = `http://localhost:${videoServerPort}/video/${encodedPath}`;
        
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';

        // Wait for metadata to load to get duration
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => resolve());
          audio.addEventListener('error', (e) => {
            console.error('[useMediaCRUD] Audio load error:', e, audio.error);
            reject(new Error('Failed to load audio'));
          });
          audio.src = audioUrl;
        });

        const audioDuration = audio.duration;
        console.log('[useMediaCRUD] Audio duration:', audioDuration, 'seconds');

        const { createVideoEditorAudioTrack } = await import(
          '@/services/database/video-editor-edits'
        );

        // Update the media item with the actual duration
        await updateProjectMedia(item.id, { duration: audioDuration });

        // Create audio track with full duration
        await createVideoEditorAudioTrack(editId.value, {
          file_path: item.file_path,
          name: item.file_name,
          start_time: 0,
          end_time: audioDuration,
          volume: 1.0,
          pan: 0,
          fade_in: 0,
          fade_out: 0,
          track_order: 0,
          is_muted: 0,
          is_solo: 0,
        });

        // Extend project duration if audio is longer
        const project = await getVideoEditorProjectWithSources(projectId.value);
        if (project && audioDuration > project.total_duration) {
          await updateVideoEditorProject(projectId.value, {
            total_duration: audioDuration,
          });
          console.log('[useMediaCRUD] Extended project duration to', audioDuration, 'seconds');
        }

        onMediaAdded?.(item.id);
        console.log('[useMediaCRUD] Audio track created successfully with duration:', audioDuration);
      } 
      // For video/image files, create a video source (video track)
      else if (item.media_type === 'video' || item.media_type === 'image') {
        let mediaDuration = item.duration;

        // For videos without duration, get it from the file
        if (item.media_type === 'video' && !mediaDuration) {
          const videoUrl = convertFileSrc(item.file_path);
          const video = document.createElement('video');
          video.src = videoUrl;

          // Wait for metadata to load to get duration
          await new Promise<void>((resolve, reject) => {
            video.addEventListener('loadedmetadata', () => resolve());
            video.addEventListener('error', () => reject(new Error('Failed to load video')));
          });

          mediaDuration = video.duration;
          console.log('[useMediaCRUD] Video duration:', mediaDuration, 'seconds');

          // Update the media item with the actual duration
          await updateProjectMedia(item.id, { duration: mediaDuration });
        }

        // For images, use a default duration of 5 seconds
        if (item.media_type === 'image' && !mediaDuration) {
          mediaDuration = 5.0;
          await updateProjectMedia(item.id, { duration: mediaDuration });
        }

        // Get existing sources to determine order_index
        const existingSources = await getVideoEditorSourcesByProjectId(projectId.value);
        const maxOrderIndex = existingSources.reduce((max, source) => Math.max(max, source.order_index), -1);
        const newOrderIndex = maxOrderIndex + 1;

        // Create video source (video track) with the media
        await createVideoEditorSource(projectId.value, {
          sourceType: 'imported',
          sourceId: item.id,
          sourcePath: item.file_path,
          sourceName: item.file_name,
          sourceThumbnail: item.thumbnail_path,
          sourceDuration: mediaDuration,
          startTime: 0,
          endTime: mediaDuration || 5.0,
          trimStart: 0,
          trimEnd: null,
          orderIndex: newOrderIndex,
        });

        // Extend project duration if media is longer
        const project = await getVideoEditorProjectWithSources(projectId.value);
        if (project && mediaDuration && mediaDuration > project.total_duration) {
          await updateVideoEditorProject(projectId.value, {
            total_duration: mediaDuration,
          });
          console.log('[useMediaCRUD] Extended project duration to', mediaDuration, 'seconds');
        }

        onMediaAdded?.(item.id);
        console.log('[useMediaCRUD] Video/Image track created successfully with duration:', mediaDuration);
      }
    } catch (error) {
      console.error('[useMediaCRUD] Failed to add media to timeline:', error);
    }
  }

  /**
   * Delete a media item
   */
  async function deleteMedia(mediaId: string): Promise<void> {
    try {
      const { deleteProjectMedia } = await import('@/services/database/project-media');
      await deleteProjectMedia(mediaId);
      await load();
      onUpdate?.();
    } catch (error) {
      console.error('[useMediaCRUD] Failed to delete media:', error);
    }
  }

  // Auto-load when projectId changes
  watch(
    projectId,
    (newProjectId) => {
      if (newProjectId) {
        load();
      } else {
        mediaItems.value = [];
      }
    },
    { immediate: true }
  );

  return {
    mediaItems,
    isLoading,
    load,
    handleUploadClick,
    addToTimeline,
    deleteMedia,
    getMediaTypeFromExtension,
  };
}
