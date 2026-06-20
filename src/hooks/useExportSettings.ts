import { useState, useMemo, useCallback } from 'react';
import { ExportPreset, WatermarkAnchor, WatermarkType } from '../components/ui/ExportImportProperties';

export function useExportSettings() {
  const [fileFormat, setFileFormat] = useState('jpeg');
  const [jpegQuality, setJpegQuality] = useState(90);
  const [enableResize, setEnableResize] = useState(false);
  const [resizeMode, setResizeMode] = useState('longEdge');
  const [resizeValue, setResizeValue] = useState(2048);
  const [dontEnlarge, setDontEnlarge] = useState(true);
  const [keepMetadata, setKeepMetadata] = useState(true);
  const [preserveTimestamps, setPreserveTimestamps] = useState(false);
  const [stripGps, setStripGps] = useState(true);
  const [exportMasks, setExportMasks] = useState(false);
  const [preserveFolders, setPreserveFolders] = useState(false);
  const [filenameTemplate, setFilenameTemplate] = useState('{original_filename}_edited');
  const [enableWatermark, setEnableWatermark] = useState(false);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>(WatermarkType.Image);
  const [watermarkPath, setWatermarkPath] = useState<string | null>(null);
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [watermarkFontPath, setWatermarkFontPath] = useState<string | null>(null);
  const [watermarkFontSize, setWatermarkFontSize] = useState(5);
  const [watermarkAnchor, setWatermarkAnchor] = useState<WatermarkAnchor>(WatermarkAnchor.BottomCenter);
  const [watermarkScale, setWatermarkScale] = useState(10);
  const [watermarkSpacing, setWatermarkSpacing] = useState(5);
  const [watermarkOpacity, setWatermarkOpacity] = useState(75);

  const handleApplyPreset = useCallback((preset: ExportPreset) => {
    setFileFormat(preset.fileFormat);
    setJpegQuality(preset.jpegQuality);
    setEnableResize(preset.enableResize);
    setResizeMode(preset.resizeMode);
    setResizeValue(preset.resizeValue);
    setDontEnlarge(preset.dontEnlarge);
    setKeepMetadata(preset.keepMetadata);
    setPreserveTimestamps(preset.preserveTimestamps ?? false);
    setStripGps(preset.stripGps);
    setExportMasks(preset.exportMasks ?? false);
    setPreserveFolders(preset.preserveFolders ?? false);
    setFilenameTemplate(preset.filenameTemplate);
    setEnableWatermark(preset.enableWatermark);
    setWatermarkType(preset.watermarkType ?? WatermarkType.Image);
    setWatermarkPath(preset.watermarkPath);
    setWatermarkText(preset.watermarkText ?? 'Watermark');
    setWatermarkFontPath(preset.watermarkFontPath ?? null);
    setWatermarkFontSize(preset.watermarkFontSize ?? 5);
    setWatermarkAnchor((preset.watermarkAnchor as WatermarkAnchor) ?? WatermarkAnchor.BottomCenter);
    setWatermarkScale(preset.watermarkScale);
    setWatermarkSpacing(preset.watermarkSpacing);
    setWatermarkOpacity(preset.watermarkOpacity);
  }, []);

  const currentSettingsObject = useMemo(
    () => ({
      fileFormat,
      jpegQuality,
      enableResize,
      resizeMode,
      resizeValue,
      dontEnlarge,
      keepMetadata,
      preserveTimestamps,
      stripGps,
      exportMasks,
      preserveFolders,
      filenameTemplate,
      enableWatermark,
      watermarkType,
      watermarkPath,
      watermarkText,
      watermarkFontPath,
      watermarkFontSize,
      watermarkAnchor,
      watermarkScale,
      watermarkSpacing,
      watermarkOpacity,
    }),
    [
      fileFormat,
      jpegQuality,
      enableResize,
      resizeMode,
      resizeValue,
      dontEnlarge,
      keepMetadata,
      preserveTimestamps,
      stripGps,
      exportMasks,
      preserveFolders,
      filenameTemplate,
      enableWatermark,
      watermarkType,
      watermarkPath,
      watermarkText,
      watermarkFontPath,
      watermarkFontSize,
      watermarkAnchor,
      watermarkScale,
      watermarkSpacing,
      watermarkOpacity,
    ]
  );

  return {
    fileFormat,
    setFileFormat,
    jpegQuality,
    setJpegQuality,
    enableResize,
    setEnableResize,
    resizeMode,
    setResizeMode,
    resizeValue,
    setResizeValue,
    dontEnlarge,
    setDontEnlarge,
    keepMetadata,
    setKeepMetadata,
    preserveTimestamps,
    setPreserveTimestamps,
    stripGps,
    setStripGps,
    exportMasks,
    setExportMasks,
    preserveFolders,
    setPreserveFolders,
    filenameTemplate,
    setFilenameTemplate,
    enableWatermark,
    setEnableWatermark,
    watermarkType,
    setWatermarkType,
    watermarkPath,
    setWatermarkPath,
    watermarkText,
    setWatermarkText,
    watermarkFontPath,
    setWatermarkFontPath,
    watermarkFontSize,
    setWatermarkFontSize,
    watermarkAnchor,
    setWatermarkAnchor,
    watermarkScale,
    setWatermarkScale,
    watermarkSpacing,
    setWatermarkSpacing,
    watermarkOpacity,
    setWatermarkOpacity,
    handleApplyPreset,
    currentSettingsObject,
  };
}
