import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'react-toastify';
import clsx from 'clsx';
import { Adjustments, INITIAL_ADJUSTMENTS } from '../../../utils/adjustments';
import { Invokes, SelectedImage } from '../../ui/AppProperties';
import Text from '../../ui/Text';
import { TextColors, TextVariants, TextWeights } from '../../../types/typography';

export interface SmartToneSuggestion {
  id: string;
  name: string;
  description: string;
  confidence: number;
  tags: string[];
  adjustments: Partial<Adjustments>;
}

interface SmartToneSuggestionsProps {
  adjustments: Adjustments;
  selectedImage: SelectedImage | null;
  setAdjustments(adjustments: Partial<Adjustments> | ((prev: Adjustments) => Adjustments)): void;
}

const mergeSuggestion = (prev: Adjustments, suggestion: SmartToneSuggestion): Adjustments => ({
  ...prev,
  ...suggestion.adjustments,
  colorGrading: {
    ...INITIAL_ADJUSTMENTS.colorGrading,
    ...(prev.colorGrading || {}),
    ...(suggestion.adjustments.colorGrading || {}),
  },
  hsl: {
    ...INITIAL_ADJUSTMENTS.hsl,
    ...(prev.hsl || {}),
    ...(suggestion.adjustments.hsl || {}),
  },
  sectionVisibility: {
    ...(prev.sectionVisibility || INITIAL_ADJUSTMENTS.sectionVisibility),
    ...(suggestion.adjustments.sectionVisibility || {}),
  },
});

export default function SmartToneSuggestions({
  adjustments,
  selectedImage,
  setAdjustments,
}: SmartToneSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SmartToneSuggestion[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  const previewUrlsRef = useRef(previewUrls);
  const imagePathRef = useRef(selectedImage?.path || null);

  previewUrlsRef.current = previewUrls;

  const clearPreviews = useCallback(() => {
    Object.values(previewUrlsRef.current).forEach((url) => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    previewUrlsRef.current = {};
    setPreviewUrls({});
  }, []);

  useEffect(() => {
    const nextPath = selectedImage?.path || null;
    if (nextPath !== imagePathRef.current) {
      imagePathRef.current = nextPath;
      clearPreviews();
      setSuggestions([]);
      setSelectedId(null);
    }
  }, [clearPreviews, selectedImage?.path]);

  useEffect(() => clearPreviews, [clearPreviews]);

  const generateSuggestionPreviews = useCallback(
    async (nextSuggestions: SmartToneSuggestion[]) => {
      if (!selectedImage?.isReady || nextSuggestions.length === 0) {
        return;
      }

      setIsGeneratingPreviews(true);
      const pathAtStart = selectedImage.path;

      for (const suggestion of nextSuggestions) {
        if (pathAtStart !== imagePathRef.current) {
          break;
        }

        try {
          const previewAdjustments = mergeSuggestion(adjustments, suggestion);
          const imageData: Uint8Array = await invoke(Invokes.GeneratePresetPreview, {
            jsAdjustments: previewAdjustments,
          });

          if (pathAtStart !== imagePathRef.current) {
            break;
          }

          const blob = new Blob([imageData], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          setPreviewUrls((prev) => {
            const oldUrl = prev[suggestion.id];
            if (oldUrl && oldUrl.startsWith('blob:')) {
              URL.revokeObjectURL(oldUrl);
            }
            return { ...prev, [suggestion.id]: url };
          });
        } catch (err) {
          console.error(`Failed to generate smart preset preview for ${suggestion.name}:`, err);
          setPreviewUrls((prev) => ({ ...prev, [suggestion.id]: null }));
        }
      }

      if (pathAtStart === imagePathRef.current) {
        setIsGeneratingPreviews(false);
      }
    },
    [adjustments, selectedImage?.isReady, selectedImage?.path],
  );

  const analyzeImage = useCallback(async () => {
    if (!selectedImage?.isReady) {
      return;
    }

    setIsAnalyzing(true);
    clearPreviews();
    try {
      const nextSuggestions = await invoke<SmartToneSuggestion[]>(Invokes.CalculateSmartToneSuggestions);
      setSuggestions(nextSuggestions);
      setSelectedId(null);
      await generateSuggestionPreviews(nextSuggestions);
    } catch (err) {
      toast.error(`生成智能预设失败：${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [clearPreviews, generateSuggestionPreviews, selectedImage?.isReady]);

  const applySuggestion = useCallback(
    (suggestion: SmartToneSuggestion) => {
      setSelectedId(suggestion.id);
      setAdjustments((prev: Adjustments) => mergeSuggestion(prev, suggestion));
    },
    [setAdjustments],
  );

  const isBusy = isAnalyzing || isGeneratingPreviews;
  const disabled = !selectedImage?.isReady || isBusy;

  return (
    <div className="shrink-0 bg-surface rounded-lg overflow-hidden" onContextMenu={(event) => event.stopPropagation()}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent shrink-0" />
            <Text variant={TextVariants.title} weight={TextWeights.normal}>
              智能预设
            </Text>
          </div>
          <Text variant={TextVariants.small} color={TextColors.secondary} className="mt-1">
            {suggestions.length > 0 ? `已生成 ${suggestions.length} 个效果` : '分析照片并生成可预览的调色方案'}
          </Text>
        </div>
        <button
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-card-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={disabled}
          onClick={analyzeImage}
          data-tooltip="生成智能预设"
        >
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {suggestions.map((suggestion) => {
            const isSelected = selectedId === suggestion.id;
            const previewUrl = previewUrls[suggestion.id];
            const isPreviewLoading = previewUrl === undefined && isGeneratingPreviews;

            return (
              <button
                key={suggestion.id}
                className={clsx(
                  'overflow-hidden rounded-md border bg-bg-tertiary text-left transition-colors hover:bg-card-active',
                  isSelected ? 'border-accent' : 'border-border-color',
                )}
                onClick={() => applySuggestion(suggestion)}
              >
                <div className="aspect-[4/3] bg-surface flex items-center justify-center overflow-hidden">
                  {previewUrl ? (
                    <img src={previewUrl} alt={`${suggestion.name} 预览`} className="w-full h-full object-cover" />
                  ) : (
                    <Loader2
                      size={18}
                      className={clsx('text-text-secondary', isPreviewLoading && 'animate-spin')}
                    />
                  )}
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Text variant={TextVariants.small} weight={TextWeights.bold} className="truncate">
                      {suggestion.name}
                    </Text>
                    <div className="flex items-center gap-1 shrink-0 text-accent">
                      {isSelected && <Check size={13} />}
                      <Text variant={TextVariants.small}>{Math.round(suggestion.confidence * 100)}%</Text>
                    </div>
                  </div>
                  <Text variant={TextVariants.small} color={TextColors.secondary} className="mt-1 line-clamp-2">
                    {suggestion.description}
                  </Text>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {suggestion.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-sm bg-surface text-[10px] text-text-secondary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
