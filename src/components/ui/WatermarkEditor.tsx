import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useMemo, useState } from 'react';
import { Check, Maximize2, X } from 'lucide-react';
import Dropdown from './Dropdown';
import ImagePicker from './ImagePicker';
import Input from './Input';
import Slider from './Slider';
import Text from './Text';
import { TextVariants } from '../../types/typography';
import { WatermarkAnchor, WatermarkType } from './ExportImportProperties';

const DEFAULT_FONT_NAME = 'Bradley Hand ITC';
const DEFAULT_FONT_URL = new URL('../../../Bradley Hand ITC.TTF', import.meta.url).href;

interface WatermarkEditorProps {
  anchor: WatermarkAnchor;
  fontPath: string | null;
  fontSize: number;
  imageAspectRatio: number;
  imagePath: string | null;
  isExporting: boolean;
  opacity: number;
  previewImageUrl?: string | null;
  scale: number;
  setAnchor: (value: WatermarkAnchor) => void;
  setFontPath: (value: string | null) => void;
  setFontSize: (value: number) => void;
  setImagePath: (value: string | null) => void;
  setOpacity: (value: number) => void;
  setScale: (value: number) => void;
  setSpacing: (value: number) => void;
  setText: (value: string) => void;
  setType: (value: WatermarkType) => void;
  spacing: number;
  text: string;
  type: WatermarkType;
  watermarkImageAspectRatio: number;
}

const typeOptions = [
  { label: 'Image Watermark', value: WatermarkType.Image },
  { label: 'Text Watermark', value: WatermarkType.Text },
];

const anchorOptions = [
  { label: 'Top Left', value: WatermarkAnchor.TopLeft },
  { label: 'Top Center', value: WatermarkAnchor.TopCenter },
  { label: 'Top Right', value: WatermarkAnchor.TopRight },
  { label: 'Center Left', value: WatermarkAnchor.CenterLeft },
  { label: 'Center', value: WatermarkAnchor.Center },
  { label: 'Center Right', value: WatermarkAnchor.CenterRight },
  { label: 'Bottom Left', value: WatermarkAnchor.BottomLeft },
  { label: 'Bottom Center', value: WatermarkAnchor.BottomCenter },
  { label: 'Bottom Right', value: WatermarkAnchor.BottomRight },
];

function getFileName(path: string | null) {
  return path ? path.split(/[\\/]/).pop() || path : null;
}

function escapeCssUrl(url: string) {
  return url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getFontFamilyId(path: string | null) {
  if (!path) return 'watermark-preview-default';
  let hash = 0;
  for (let i = 0; i < path.length; i += 1) {
    hash = (hash * 31 + path.charCodeAt(i)) >>> 0;
  }
  return `watermark-preview-${hash.toString(36)}`;
}

function WatermarkPreview({
  anchor,
  fontPath,
  fontSize,
  isLarge = false,
  imageAspectRatio,
  imageUrl,
  opacity,
  scale,
  spacing,
  text,
  type,
  watermarkImageAspectRatio,
}: {
  anchor: WatermarkAnchor;
  fontPath: string | null;
  fontSize: number;
  isLarge?: boolean;
  imageAspectRatio: number;
  imageUrl?: string | null;
  opacity: number;
  scale: number;
  spacing: number;
  text: string;
  type: WatermarkType;
  watermarkImageAspectRatio: number;
}) {
  const fontFamily = useMemo(() => getFontFamilyId(fontPath), [fontPath]);
  const fontUrl = useMemo(() => (fontPath ? convertFileSrc(fontPath) : DEFAULT_FONT_URL), [fontPath]);
  const minDimPercent = imageAspectRatio > 1 ? 100 / imageAspectRatio : 100;
  const spacingPercent = minDimPercent * (spacing / 100);

  const getPositionStyles = () => {
    const styles: React.CSSProperties = {
      opacity: opacity / 100,
      position: 'absolute',
    };

    if (type === WatermarkType.Image) {
      styles.width = `${minDimPercent * (scale / 100)}%`;
    } else {
      styles.maxWidth = '90%';
      styles.fontSize = isLarge
        ? `clamp(12px, ${fontSize * 0.8}vmin, 180px)`
        : `${Math.max(9, Math.min(30, fontSize * 2.3))}px`;
      styles.lineHeight = 1;
      styles.whiteSpace = 'nowrap';
    }

    const spacingString = `${spacingPercent}%`;

    switch (anchor) {
      case WatermarkAnchor.TopLeft:
        styles.top = spacingString;
        styles.left = spacingString;
        break;
      case WatermarkAnchor.TopCenter:
        styles.top = spacingString;
        styles.left = '50%';
        styles.transform = 'translateX(-50%)';
        break;
      case WatermarkAnchor.TopRight:
        styles.top = spacingString;
        styles.right = spacingString;
        break;
      case WatermarkAnchor.CenterLeft:
        styles.top = '50%';
        styles.left = spacingString;
        styles.transform = 'translateY(-50%)';
        break;
      case WatermarkAnchor.Center:
        styles.top = '50%';
        styles.left = '50%';
        styles.transform = 'translate(-50%, -50%)';
        break;
      case WatermarkAnchor.CenterRight:
        styles.top = '50%';
        styles.right = spacingString;
        styles.transform = 'translateY(-50%)';
        break;
      case WatermarkAnchor.BottomLeft:
        styles.bottom = spacingString;
        styles.left = spacingString;
        break;
      case WatermarkAnchor.BottomCenter:
        styles.bottom = spacingString;
        styles.left = '50%';
        styles.transform = 'translateX(-50%)';
        break;
      case WatermarkAnchor.BottomRight:
        styles.bottom = spacingString;
        styles.right = spacingString;
        break;
    }
    return styles;
  };

  return (
    <div
      className={`w-full bg-surface relative overflow-hidden border border-surface ${isLarge ? 'rounded-none shadow-2xl' : 'rounded-md'}`}
      style={{ aspectRatio: imageAspectRatio }}
    >
      {imageUrl ? (
        <img alt="" className="absolute inset-0 h-full w-full object-cover" src={imageUrl} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Text variant={TextVariants.label}>{isLarge ? 'No preview image' : 'Preview'}</Text>
        </div>
      )}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      {type === WatermarkType.Text && (
        <style>{`
          @font-face {
            font-family: "${fontFamily}";
            src: url("${escapeCssUrl(fontUrl)}");
            font-display: swap;
          }
        `}</style>
      )}
      <div style={getPositionStyles()}>
        {type === WatermarkType.Image ? (
          <div
            className="w-full bg-accent/50 border-2 border-dashed border-accent rounded-xs flex items-center justify-center"
            style={{ aspectRatio: watermarkImageAspectRatio }}
          >
            <span className="text-white text-[8px] font-bold">Logo</span>
          </div>
        ) : (
          <span
            className="block truncate text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
            style={{ fontFamily: `"${fontFamily}", var(--font-family), sans-serif` }}
          >
            {text.trim() || 'Watermark'}
          </span>
        )}
      </div>
    </div>
  );
}

interface TextWatermarkControlsProps {
  anchor: WatermarkAnchor;
  fontPath: string | null;
  fontSize: number;
  isExporting: boolean;
  opacity: number;
  setAnchor: (value: WatermarkAnchor) => void;
  setFontPath: (value: string | null) => void;
  setFontSize: (value: number) => void;
  setOpacity: (value: number) => void;
  setSpacing: (value: number) => void;
  setText: (value: string) => void;
  spacing: number;
  text: string;
  onSelectFont: () => void;
}

function TextWatermarkControls({
  anchor,
  fontPath,
  fontSize,
  isExporting,
  opacity,
  setAnchor,
  setFontPath,
  setFontSize,
  setOpacity,
  setSpacing,
  setText,
  spacing,
  text,
  onSelectFont,
}: TextWatermarkControlsProps) {
  return (
    <>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Watermark text" disabled={isExporting} />
      <div className="flex justify-between items-center">
        <Text variant={TextVariants.label} className="select-none">
          Font
        </Text>
        <div className="group flex items-center">
          <button
            onClick={onSelectFont}
            className="text-sm text-text-primary text-right select-none cursor-pointer truncate max-w-[150px] hover:text-accent transition-colors"
            data-tooltip={fontPath || DEFAULT_FONT_NAME}
            disabled={isExporting}
            type="button"
          >
            {getFileName(fontPath) || DEFAULT_FONT_NAME}
          </button>
          {fontPath && (
            <button
              onClick={() => setFontPath(null)}
              className="flex items-center justify-center p-0.5 rounded-full bg-bg-tertiary hover:bg-surface w-0 ml-0 opacity-0 group-hover:w-6 group-hover:ml-0 group-hover:opacity-100 overflow-hidden pointer-events-none group-hover:pointer-events-auto transition-all duration-200 ease-in-out"
              data-tooltip="Clear Font"
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <Dropdown options={anchorOptions} value={anchor} onChange={setAnchor} disabled={isExporting} className="w-full" />
      <div>
        <Slider
          label="Font Size"
          min={1}
          max={20}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(String(e.target.value)))}
          defaultValue={5}
          suffix="%"
        />
        <Slider
          label="Spacing"
          min={0}
          max={25}
          step={1}
          value={spacing}
          onChange={(e) => setSpacing(parseInt(String(e.target.value)))}
          defaultValue={5}
          suffix="%"
        />
        <Slider
          label="Opacity"
          min={0}
          max={100}
          step={1}
          value={opacity}
          onChange={(e) => setOpacity(parseInt(String(e.target.value)))}
          defaultValue={75}
          suffix="%"
        />
      </div>
    </>
  );
}

interface WatermarkEditPageProps extends TextWatermarkControlsProps {
  imageAspectRatio: number;
  onClose: () => void;
  previewImageUrl?: string | null;
  scale: number;
  type: WatermarkType;
  watermarkImageAspectRatio: number;
}

function WatermarkEditPage({
  anchor,
  fontPath,
  fontSize,
  imageAspectRatio,
  isExporting,
  onClose,
  opacity,
  previewImageUrl,
  scale,
  setAnchor,
  setFontPath,
  setFontSize,
  setOpacity,
  setSpacing,
  setText,
  spacing,
  text,
  type,
  watermarkImageAspectRatio,
  onSelectFont,
}: WatermarkEditPageProps) {
  return (
    <div className="fixed inset-0 z-50 bg-bg-primary text-text-primary flex flex-col">
      <div className="h-14 shrink-0 border-b border-border-color flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Text variant={TextVariants.heading}>Watermark Editor</Text>
          <Text variant={TextVariants.small} className="text-text-secondary truncate max-w-[42vw]">
            {previewImageUrl ? 'Photo Preview' : 'No preview image'}
          </Text>
        </div>
        <button
          onClick={onClose}
          className="h-9 px-3 rounded-md bg-accent text-button-text flex items-center gap-2 hover:bg-accent/90"
          type="button"
        >
          <Check size={16} />
          <span className="text-sm font-semibold">Done</span>
        </button>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 bg-black flex items-center justify-center p-6 overflow-hidden">
          <div
            className="max-h-full max-w-full w-full"
            style={{ maxWidth: `min(100%, calc((100vh - 104px) * ${imageAspectRatio}))` }}
          >
            <WatermarkPreview
              imageAspectRatio={imageAspectRatio}
              imageUrl={previewImageUrl}
              watermarkImageAspectRatio={watermarkImageAspectRatio}
              anchor={anchor}
              scale={scale}
              spacing={spacing}
              opacity={opacity}
              type={type}
              text={text}
              fontSize={fontSize}
              fontPath={fontPath}
              isLarge
            />
          </div>
        </div>
        <div className="w-[360px] shrink-0 border-l border-border-color bg-bg-secondary p-4 overflow-y-auto">
          <div className="space-y-4">
            <TextWatermarkControls
              anchor={anchor}
              fontPath={fontPath}
              fontSize={fontSize}
              isExporting={isExporting}
              opacity={opacity}
              setAnchor={setAnchor}
              setFontPath={setFontPath}
              setFontSize={setFontSize}
              setOpacity={setOpacity}
              setSpacing={setSpacing}
              setText={setText}
              spacing={spacing}
              text={text}
              onSelectFont={onSelectFont}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WatermarkEditor({
  anchor,
  fontPath,
  fontSize,
  imageAspectRatio,
  imagePath,
  isExporting,
  opacity,
  previewImageUrl,
  scale,
  setAnchor,
  setFontPath,
  setFontSize,
  setImagePath,
  setOpacity,
  setScale,
  setSpacing,
  setText,
  setType,
  spacing,
  text,
  type,
  watermarkImageAspectRatio,
}: WatermarkEditorProps) {
  const [isEditPageOpen, setIsEditPageOpen] = useState(false);

  const handleSelectFont = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Font Files',
            extensions: ['ttf', 'otf', 'ttc'],
          },
        ],
      });
      if (typeof selected === 'string') {
        setFontPath(selected);
      }
    } catch (err) {
      console.error('Failed to open font file dialog:', err);
    }
  };

  const handleTypeChange = (nextType: WatermarkType) => {
    setType(nextType);
    if (nextType === WatermarkType.Text) {
      setAnchor(WatermarkAnchor.BottomCenter);
    }
  };

  return (
    <div className="space-y-4 pl-2 border-l-2 border-surface">
      <Dropdown options={typeOptions} value={type} onChange={handleTypeChange} disabled={isExporting} className="w-full" />

      {type === WatermarkType.Image ? (
        <>
          <ImagePicker
            label="Watermark Image"
            imageName={getFileName(imagePath)}
            onImageSelect={setImagePath}
            onClear={() => setImagePath(null)}
          />
          {imagePath && (
            <>
              <Dropdown options={anchorOptions} value={anchor} onChange={setAnchor} disabled={isExporting} className="w-full" />
              <div>
                <Slider
                  label="Scale"
                  min={1}
                  max={50}
                  step={1}
                  value={scale}
                  onChange={(e) => setScale(parseInt(String(e.target.value)))}
                  defaultValue={10}
                />
                <Slider
                  label="Spacing"
                  min={0}
                  max={25}
                  step={1}
                  value={spacing}
                  onChange={(e) => setSpacing(parseInt(String(e.target.value)))}
                  defaultValue={5}
                  suffix="%"
                />
                <Slider
                  label="Opacity"
                  min={0}
                  max={100}
                  step={1}
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(String(e.target.value)))}
                  defaultValue={75}
                  suffix="%"
                />
              </div>
              <WatermarkPreview
                imageAspectRatio={imageAspectRatio}
                watermarkImageAspectRatio={watermarkImageAspectRatio}
                anchor={anchor}
                scale={scale}
                spacing={spacing}
                opacity={opacity}
                type={type}
                text={text}
                fontSize={fontSize}
                fontPath={fontPath}
                imageUrl={previewImageUrl}
              />
            </>
          )}
        </>
      ) : (
        <>
          <TextWatermarkControls
            anchor={anchor}
            fontPath={fontPath}
            fontSize={fontSize}
            isExporting={isExporting}
            opacity={opacity}
            setAnchor={setAnchor}
            setFontPath={setFontPath}
            setFontSize={setFontSize}
            setOpacity={setOpacity}
            setSpacing={setSpacing}
            setText={setText}
            spacing={spacing}
            text={text}
            onSelectFont={handleSelectFont}
          />
          <button
            onClick={() => setIsEditPageOpen(true)}
            className="w-full rounded-md bg-accent/15 text-accent border border-accent/30 px-3 py-2 flex items-center justify-center gap-2 hover:bg-accent/20 transition-colors"
            type="button"
          >
            <Maximize2 size={16} />
            <span className="text-sm font-semibold">Edit on Photo</span>
          </button>
          <WatermarkPreview
            imageAspectRatio={imageAspectRatio}
            imageUrl={previewImageUrl}
            watermarkImageAspectRatio={watermarkImageAspectRatio}
            anchor={anchor}
            scale={scale}
            spacing={spacing}
            opacity={opacity}
            type={type}
            text={text}
            fontSize={fontSize}
            fontPath={fontPath}
          />
          {isEditPageOpen && (
            <WatermarkEditPage
              anchor={anchor}
              fontPath={fontPath}
              fontSize={fontSize}
              imageAspectRatio={imageAspectRatio}
              isExporting={isExporting}
              onClose={() => setIsEditPageOpen(false)}
              opacity={opacity}
              previewImageUrl={previewImageUrl}
              scale={scale}
              setAnchor={setAnchor}
              setFontPath={setFontPath}
              setFontSize={setFontSize}
              setOpacity={setOpacity}
              setSpacing={setSpacing}
              setText={setText}
              spacing={spacing}
              text={text}
              type={type}
              watermarkImageAspectRatio={watermarkImageAspectRatio}
              onSelectFont={handleSelectFont}
            />
          )}
        </>
      )}
    </div>
  );
}
