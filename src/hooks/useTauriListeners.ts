import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Status } from '../components/ui/ExportImportProperties';
import { useProcessStore } from '../store/useProcessStore';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useLibraryStore } from '../store/useLibraryStore';

interface TauriListenerProps {
  refreshAllFolderTrees: () => void;
  handleSelectSubfolder: (path: string, isNewRoot?: boolean, preloadedImages?: any[], expandParents?: boolean) => void;
  refreshImageList: () => void;
  markGenerated: (path: string) => void;
}

export function useTauriListeners({
  refreshAllFolderTrees,
  handleSelectSubfolder,
  refreshImageList,
  markGenerated,
}: TauriListenerProps) {
  const refs = useRef({ refreshAllFolderTrees, handleSelectSubfolder, refreshImageList, markGenerated });

  useEffect(() => {
    refs.current = { refreshAllFolderTrees, handleSelectSubfolder, refreshImageList, markGenerated };
  });

  const thumbnailBuffer = useRef<Record<string, string>>({});
  const mediumThumbnailBuffer = useRef<Record<string, string>>({});
  const ratingBuffer = useRef<Record<string, number>>({});
  const editStatusBuffer = useRef<Record<string, boolean>>({});
  const flushHandle = useRef<number | null>(null);

  useEffect(() => {
    let isEffectActive = true;

    const flushThumbnailBatch = () => {
      flushHandle.current = null;
      if (!isEffectActive) return;

      const pendingThumbs = thumbnailBuffer.current;
      const pendingMediumThumbs = mediumThumbnailBuffer.current;
      const pendingRatings = ratingBuffer.current;
      const pendingEdits = editStatusBuffer.current;

      thumbnailBuffer.current = {};
      mediumThumbnailBuffer.current = {};
      ratingBuffer.current = {};
      editStatusBuffer.current = {};

      if (Object.keys(pendingThumbs).length > 0) {
        useProcessStore.getState().setProcess((state) => ({
          thumbnails: { ...state.thumbnails, ...pendingThumbs },
          mediumThumbnails: { ...state.mediumThumbnails, ...pendingMediumThumbs },
        }));
      }

      if (Object.keys(pendingRatings).length > 0 || Object.keys(pendingEdits).length > 0) {
        useLibraryStore.getState().setLibrary((state) => ({
          imageRatings: { ...state.imageRatings, ...pendingRatings },
          imageList:
            Object.keys(pendingEdits).length > 0
              ? state.imageList.map((img) =>
                  pendingEdits[img.path] !== undefined ? { ...img, is_edited: pendingEdits[img.path] } : img,
                )
              : state.imageList,
        }));
      }
    };

    const scheduleFlush = () => {
      if (flushHandle.current !== null) return;
      flushHandle.current = requestAnimationFrame(flushThumbnailBatch);
    };

    const listeners = [
      listen('preview-update-uncropped', (event: any) => {
        if (isEffectActive) useEditorStore.getState().setEditor({ uncroppedAdjustedPreviewUrl: event.payload });
      }),
      listen('analytics-update', (event: any) => {
        if (isEffectActive && event.payload.path === useEditorStore.getState().selectedImage?.path) {
          const update: { histogram?: any; waveform?: any } = {};
          if (event.payload.histogram != null) update.histogram = event.payload.histogram;
          if (event.payload.waveform != null) update.waveform = event.payload.waveform;
          useEditorStore.getState().setEditor(update);
        }
      }),
      listen('open-with-file', (event: any) => {
        if (isEffectActive) useProcessStore.getState().setProcess({ initialFileToOpen: event.payload as string });
      }),
      listen('external-edit-session', (event: any) => {
        if (isEffectActive) useProcessStore.getState().setProcess({ externalEditSession: event.payload });
      }),
      listen('thumbnail-progress', (event: any) => {
        if (isEffectActive)
          useProcessStore
            .getState()
            .setProcess({ thumbnailProgress: { current: event.payload.current, total: event.payload.total } });
      }),
      listen('thumbnail-generation-complete', () => {
        if (isEffectActive) useProcessStore.getState().setProcess({ thumbnailProgress: { current: 0, total: 0 } });
      }),
      listen('thumbnail-generated', (event: any) => {
        if (!isEffectActive) return;
        const { path, thumbnailPath, previewPath, rating, is_edited, data } = event.payload;

        if (thumbnailPath && previewPath) {
          thumbnailBuffer.current[path] = convertFileSrc(thumbnailPath.replace(/\\/g, '/'));
          mediumThumbnailBuffer.current[path] = convertFileSrc(previewPath.replace(/\\/g, '/'));
          refs.current.markGenerated(path);
        } else if (data) {
          thumbnailBuffer.current[path] = data;
          mediumThumbnailBuffer.current[path] = data;
          refs.current.markGenerated(path);
        }
        if (rating !== undefined) {
          ratingBuffer.current[path] = rating;
        }
        if (is_edited !== undefined) {
          editStatusBuffer.current[path] = is_edited;
        }
        if (thumbnailPath || data || rating !== undefined || is_edited !== undefined) {
          scheduleFlush();
        }
      }),
      listen('image-metadata-loaded', (event: any) => {
        if (!isEffectActive) return;
        const { path, rating, is_edited, tags } = event.payload;

        useLibraryStore.getState().setLibrary((state) => ({
          imageRatings: { ...state.imageRatings, [path]: rating },
          imageList: state.imageList.map((img) =>
            img.path === path ? { ...img, is_edited, tags: tags ?? img.tags } : img,
          ),
        }));
      }),
      listen('ai-model-download-start', (event: any) => {
        if (isEffectActive) {
          const modelName = String(event.payload || 'AI model');
          useProcessStore.getState().setProcess({ aiModelDownloadStatus: modelName });
          useProcessStore.getState().upsertActivityTask({
            id: `ai-model:${modelName}`,
            kind: 'ai',
            title: 'Downloading AI model',
            detail: modelName,
            status: 'running',
          });
        }
      }),
      listen('ai-model-download-finish', (event: any) => {
        if (isEffectActive) {
          const modelName = String(event.payload || useProcessStore.getState().aiModelDownloadStatus || 'AI model');
          useProcessStore.getState().setProcess({ aiModelDownloadStatus: null });
          useProcessStore.getState().completeActivityTask(`ai-model:${modelName}`, 'success', modelName);
        }
      }),
      listen('indexing-started', () => {
        if (isEffectActive) {
          useProcessStore.getState().setProcess({ isIndexing: true, indexingProgress: { current: 0, total: 0 } });
          useProcessStore.getState().upsertActivityTask({
            id: 'library-indexing',
            kind: 'indexing',
            title: 'Indexing library',
            detail: 'Preparing AI tags and metadata',
            status: 'running',
          });
        }
      }),
      listen('indexing-progress', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setProcess({ indexingProgress: event.payload });
          useProcessStore.getState().upsertActivityTask({
            id: 'library-indexing',
            kind: 'indexing',
            title: 'Indexing library',
            current: event.payload?.current,
            total: event.payload?.total,
            status: 'running',
          });
        }
      }),
      listen('indexing-finished', () => {
        if (isEffectActive) {
          useProcessStore.getState().setProcess({ isIndexing: false, indexingProgress: { current: 0, total: 0 } });
          useProcessStore.getState().completeActivityTask('library-indexing', 'success', 'Indexing complete');
          const currentPath = useLibraryStore.getState().currentFolderPath;
          if (currentPath) {
            refs.current.refreshImageList();
          }
        }
      }),
      listen('indexing-error', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setProcess({ isIndexing: false, indexingProgress: { current: 0, total: 0 } });
          useProcessStore.getState().completeActivityTask('library-indexing', 'error', String(event.payload));
        }
      }),
      listen('batch-export-progress', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setExportState({ progress: event.payload });
          useProcessStore.getState().upsertActivityTask({
            id: 'batch-export',
            kind: 'export',
            title: 'Exporting images',
            current: event.payload?.current,
            total: event.payload?.total,
            status: 'running',
          });
        }
      }),
      listen('export-complete', () => {
        if (isEffectActive) {
          useProcessStore.getState().setExportState({ status: Status.Success });
          useProcessStore.getState().completeActivityTask('batch-export', 'success', 'Export complete');
        }
      }),
      listen('export-error', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setExportState({
            status: Status.Error,
            errorMessage: typeof event.payload === 'string' ? event.payload : 'Unknown error',
          });
          useProcessStore
            .getState()
            .completeActivityTask('batch-export', 'error', typeof event.payload === 'string' ? event.payload : 'Export failed');
        }
      }),
      listen('export-cancelling', () => {
        if (isEffectActive) useProcessStore.getState().setExportState({ status: Status.Cancelling });
      }),
      listen('export-cancelled', () => {
        if (isEffectActive) {
          useProcessStore.getState().setExportState({ status: Status.Cancelled });
          useProcessStore.getState().completeActivityTask('batch-export', 'cancelled', 'Export cancelled');
        }
      }),
      listen('import-start', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setImportState({
            errorMessage: '',
            path: '',
            progress: { current: 0, total: event.payload.total },
            status: Status.Importing,
          });
          useProcessStore.getState().upsertActivityTask({
            id: 'import-files',
            kind: 'import',
            title: 'Importing files',
            current: 0,
            total: event.payload?.total,
            status: 'running',
          });
        }
      }),
      listen('import-progress', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setImportState({
            path: event.payload.path,
            progress: { current: event.payload.current, total: event.payload.total },
          });
          useProcessStore.getState().upsertActivityTask({
            id: 'import-files',
            kind: 'import',
            title: 'Importing files',
            detail: event.payload?.path,
            current: event.payload?.current,
            total: event.payload?.total,
            status: 'running',
          });
        }
      }),
      listen('import-complete', () => {
        if (isEffectActive) {
          useProcessStore.getState().setImportState({ status: Status.Success });
          useProcessStore.getState().completeActivityTask('import-files', 'success', 'Import complete');
          refs.current.refreshAllFolderTrees();
          const currentPath = useLibraryStore.getState().currentFolderPath;
          if (currentPath) {
            refs.current.handleSelectSubfolder(currentPath, false);
          }
        }
      }),
      listen('import-error', (event: any) => {
        if (isEffectActive) {
          useProcessStore.getState().setImportState({
            status: Status.Error,
            errorMessage: typeof event.payload === 'string' ? event.payload : 'Unknown error',
          });
          useProcessStore
            .getState()
            .completeActivityTask('import-files', 'error', typeof event.payload === 'string' ? event.payload : 'Import failed');
        }
      }),
      listen('denoise-progress', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            denoiseModalState: { ...state.denoiseModalState, progressMessage: event.payload as string },
          }));
          useProcessStore.getState().upsertActivityTask({
            id: 'denoise',
            kind: 'denoise',
            title: 'Denoising image',
            detail: String(event.payload || ''),
            status: 'running',
          });
        }
      }),
      listen('denoise-complete', (event: any) => {
        if (isEffectActive) {
          const payload = event.payload;
          const isObject = typeof payload === 'object' && payload !== null;
          useUIStore.getState().setUI((state) => ({
            denoiseModalState: {
              ...state.denoiseModalState,
              isProcessing: false,
              previewBase64: isObject ? payload.denoised : payload,
              originalBase64: isObject ? payload.original : null,
              progressMessage: null,
            },
          }));
          useProcessStore.getState().completeActivityTask('denoise', 'success', 'Denoise complete');
        }
      }),
      listen('denoise-error', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            denoiseModalState: {
              ...state.denoiseModalState,
              isProcessing: false,
              error: String(event.payload),
              progressMessage: null,
            },
          }));
          useProcessStore.getState().completeActivityTask('denoise', 'error', String(event.payload));
        }
      }),
      listen('wgpu-frame-ready', (event: any) => {
        if (isEffectActive && event.payload?.path === useEditorStore.getState().selectedImage?.path) {
          useEditorStore.getState().setEditor({ hasRenderedFirstFrame: true });
        }
      }),
      listen('panorama-progress', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => {
            if (state.panoramaModalState.finalImageBase64 || state.panoramaModalState.error) return state;
            return { panoramaModalState: { ...state.panoramaModalState, progressMessage: event.payload } };
          });
        }
      }),
      listen('panorama-complete', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            panoramaModalState: {
              ...state.panoramaModalState,
              error: null,
              finalImageBase64: event.payload.base64,
              isProcessing: false,
              progressMessage: null,
            },
          }));
        }
      }),
      listen('panorama-error', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            panoramaModalState: {
              ...state.panoramaModalState,
              error: String(event.payload),
              finalImageBase64: null,
              isProcessing: false,
              progressMessage: null,
            },
          }));
        }
      }),
      listen('hdr-progress', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            hdrModalState: {
              ...state.hdrModalState,
              error: null,
              finalImageBase64: null,
              isOpen: true,
              progressMessage: event.payload,
            },
          }));
        }
      }),
      listen('hdr-complete', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            hdrModalState: {
              ...state.hdrModalState,
              error: null,
              finalImageBase64: event.payload.base64,
              isProcessing: false,
              progressMessage: 'Hdr Ready',
            },
          }));
        }
      }),
      listen('hdr-error', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            hdrModalState: {
              ...state.hdrModalState,
              error: String(event.payload),
              finalImageBase64: null,
              isProcessing: false,
              progressMessage: 'An error occurred.',
            },
          }));
        }
      }),
      listen('focus-stack-progress', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => {
            if (state.focusStackModalState.finalImageBase64 || state.focusStackModalState.error) return state;
            return { focusStackModalState: { ...state.focusStackModalState, progressMessage: event.payload } };
          });
        }
      }),
      listen('focus-stack-complete', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            focusStackModalState: {
              ...state.focusStackModalState,
              error: null,
              finalImageBase64: event.payload.base64,
              depthMapBase64: event.payload.depthMap,
              isProcessing: false,
              progressMessage: null,
            },
          }));
        }
      }),
      listen('focus-stack-error', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            focusStackModalState: {
              ...state.focusStackModalState,
              error: String(event.payload),
              finalImageBase64: null,
              depthMapBase64: null,
              isProcessing: false,
              progressMessage: null,
            },
          }));
        }
      }),
      listen('culling-start', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            cullingModalState: {
              ...state.cullingModalState,
              isOpen: true,
              progress: { current: 0, total: event.payload, stage: 'Initializing...' },
              suggestions: null,
              error: null,
            },
          }));
          useProcessStore.getState().upsertActivityTask({
            id: 'culling',
            kind: 'culling',
            title: 'Analyzing cull candidates',
            current: 0,
            total: Number(event.payload || 0),
            status: 'running',
          });
        }
      }),
      listen('culling-progress', (event: any) => {
        if (isEffectActive) {
          useUIStore
            .getState()
            .setUI((state) => ({ cullingModalState: { ...state.cullingModalState, progress: event.payload } }));
          useProcessStore.getState().upsertActivityTask({
            id: 'culling',
            kind: 'culling',
            title: 'Analyzing cull candidates',
            detail: event.payload?.stage,
            current: event.payload?.current,
            total: event.payload?.total,
            status: 'running',
          });
        }
      }),
      listen('culling-complete', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            cullingModalState: { ...state.cullingModalState, progress: null, suggestions: event.payload },
          }));
          const similarCount =
            event.payload?.similarGroups?.reduce((count: number, group: any) => count + group.duplicates.length, 0) || 0;
          const blurryCount = event.payload?.blurryImages?.length || 0;
          useProcessStore
            .getState()
            .completeActivityTask('culling', 'success', `Found ${similarCount + blurryCount} review candidates`);
        }
      }),
      listen('culling-error', (event: any) => {
        if (isEffectActive) {
          useUIStore.getState().setUI((state) => ({
            cullingModalState: { ...state.cullingModalState, progress: null, error: String(event.payload) },
          }));
          useProcessStore.getState().completeActivityTask('culling', 'error', String(event.payload));
        }
      }),
    ];

    return () => {
      isEffectActive = false;
      if (flushHandle.current !== null) {
        cancelAnimationFrame(flushHandle.current);
        flushHandle.current = null;
      }
      thumbnailBuffer.current = {};
      ratingBuffer.current = {};
      listeners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, []);
}
