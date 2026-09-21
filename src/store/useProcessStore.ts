import { create } from 'zustand';
import { Progress } from '../components/ui/AppProperties';
import { ExportState, ImportState, Status } from '../components/ui/ExportImportProperties';

export type ActivityTaskStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface ActivityTask {
  current?: number;
  detail?: string;
  id: string;
  kind: 'ai' | 'culling' | 'denoise' | 'export' | 'import' | 'indexing' | 'thumbnail' | 'other';
  status: ActivityTaskStatus;
  title: string;
  total?: number;
  updatedAt: number;
}

export interface ExternalEditSession {
  source: string;
  output: string;
  format: string;
  jpegQuality: number;
}

interface ProcessState {
  exportState: ExportState;
  importState: ImportState;
  activityTasks: Record<string, ActivityTask>;
  isIndexing: boolean;
  indexingProgress: Progress;
  thumbnails: Record<string, string>;
  mediumThumbnails: Record<string, string>;
  thumbnailProgress: Progress;
  previews: Record<string, { url: string; thumbKey: string; timestamp: number }>;
  aiModelDownloadStatus: string | null;
  copiedFilePaths: Array<string>;
  isCopied: boolean;
  isPasted: boolean;
  initialFileToOpen: string | null;
  externalEditSession: ExternalEditSession | null;

  setProcess: (state: Partial<ProcessState> | ((state: ProcessState) => Partial<ProcessState>)) => void;
  setExportState: (updater: Partial<ExportState> | ((state: ExportState) => Partial<ExportState>)) => void;
  setImportState: (updater: Partial<ImportState> | ((state: ImportState) => Partial<ImportState>)) => void;
  upsertActivityTask: (task: Omit<ActivityTask, 'updatedAt'> & { updatedAt?: number }) => void;
  completeActivityTask: (
    id: string,
    status?: Exclude<ActivityTaskStatus, 'running'>,
    detail?: string,
  ) => void;
  dismissActivityTask: (id: string) => void;
  clearFinishedActivityTasks: () => void;
  setPreview: (path: string, url: string, thumbKey: string) => void;
  clearPreviews: () => void;
}

let exportTimeout: ReturnType<typeof setTimeout>;
let importTimeout: ReturnType<typeof setTimeout>;
let copyTimeout: ReturnType<typeof setTimeout>;
let pasteTimeout: ReturnType<typeof setTimeout>;

const MAX_PREVIEW_CACHE_SIZE = 10;

export const useProcessStore = create<ProcessState>((set, get) => ({
  exportState: { errorMessage: '', progress: { current: 0, total: 0 }, status: Status.Idle },
  importState: { errorMessage: '', path: '', progress: { current: 0, total: 0 }, status: Status.Idle },
  activityTasks: {},
  isIndexing: false,
  indexingProgress: { current: 0, total: 0 },
  thumbnails: {},
  mediumThumbnails: {},
  thumbnailProgress: { current: 0, total: 0 },
  previews: {},
  aiModelDownloadStatus: null,
  copiedFilePaths: [],
  isCopied: false,
  isPasted: false,
  initialFileToOpen: null,
  externalEditSession: null,

  setProcess: (updater) => {
    set((prev) => {
      const nextState = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...nextState };
    });

    const state = get();
    if (state.isCopied) {
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => set({ isCopied: false }), 1000);
    }
    if (state.isPasted) {
      clearTimeout(pasteTimeout);
      pasteTimeout = setTimeout(() => set({ isPasted: false }), 1000);
    }
  },

  setExportState: (updater) => {
    set((prev) => ({
      exportState: { ...prev.exportState, ...(typeof updater === 'function' ? updater(prev.exportState) : updater) },
    }));

    const status = get().exportState.status;

    clearTimeout(exportTimeout);

    if ([Status.Success, Status.Error, Status.Cancelled].includes(status)) {
      exportTimeout = setTimeout(() => {
        set((prev) => ({
          exportState: {
            ...prev.exportState,
            status: Status.Idle,
            errorMessage: '',
            progress: { current: 0, total: 0 },
          },
        }));
      }, 5000);
    }
  },

  setImportState: (updater) => {
    set((prev) => ({
      importState: { ...prev.importState, ...(typeof updater === 'function' ? updater(prev.importState) : updater) },
    }));

    const status = get().importState.status;

    clearTimeout(importTimeout);

    if ([Status.Success, Status.Error, Status.Cancelled].includes(status)) {
      importTimeout = setTimeout(() => {
        set((prev) => ({
          importState: {
            ...prev.importState,
            status: Status.Idle,
            errorMessage: '',
            progress: { current: 0, total: 0 },
          },
        }));
      }, 5000);
    }
  },

  upsertActivityTask: (task) =>
    set((state) => ({
      activityTasks: {
        ...state.activityTasks,
        [task.id]: {
          ...(state.activityTasks[task.id] || {}),
          ...task,
          updatedAt: task.updatedAt ?? Date.now(),
        },
      },
    })),

  completeActivityTask: (id, status = 'success', detail) =>
    set((state) => {
      const existing = state.activityTasks[id];
      if (!existing) return state;
      return {
        activityTasks: {
          ...state.activityTasks,
          [id]: {
            ...existing,
            detail: detail ?? existing.detail,
            status,
            updatedAt: Date.now(),
          },
        },
      };
    }),

  dismissActivityTask: (id) =>
    set((state) => {
      const { [id]: _dismissed, ...rest } = state.activityTasks;
      return { activityTasks: rest };
    }),

  clearFinishedActivityTasks: () =>
    set((state) => ({
      activityTasks: Object.fromEntries(
        Object.entries(state.activityTasks).filter(([, task]) => task.status === 'running'),
      ),
    })),

  setPreview: (path, url, thumbKey) => {
    set((state) => {
      const newPreviews = { ...state.previews };

      if (newPreviews[path] && newPreviews[path].url !== url) {
        URL.revokeObjectURL(newPreviews[path].url);
      }

      newPreviews[path] = { url, thumbKey, timestamp: Date.now() };

      const keys = Object.keys(newPreviews);
      if (keys.length > MAX_PREVIEW_CACHE_SIZE) {
        let oldestPath = keys[0];
        let oldestTime = newPreviews[oldestPath].timestamp;

        for (let i = 1; i < keys.length; i++) {
          const key = keys[i];
          if (newPreviews[key].timestamp < oldestTime) {
            oldestTime = newPreviews[key].timestamp;
            oldestPath = key;
          }
        }

        if (oldestPath !== path) {
          URL.revokeObjectURL(newPreviews[oldestPath].url);
          delete newPreviews[oldestPath];
        }
      }

      return { previews: newPreviews };
    });
  },

  clearPreviews: () => {
    set((state) => {
      Object.values(state.previews).forEach((p) => URL.revokeObjectURL(p.url));
      return { previews: {} };
    });
  },
}));
