'use client';

import { useMemo, type CSSProperties, type Ref } from 'react';
import { AlertTriangle, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/cn';
import { composeBoxShadowCSS, composeFilterCSS, composeTransformCSS } from '@/lib/cssGenerator';
import { describeSanitizeResult, sanitizeSvgMarkup } from '@/lib/sanitizer';
import { isValidCssColor, type KeyframeProperties, type PreviewElementShape } from '@/types/sandbox';

export interface TargetGeometryProps {
  shape: PreviewElementShape;
  properties: KeyframeProperties;
  /** Raw SVG source; only used when `shape` is `custom-svg`. */
  customSvgContent?: string;
  /** Node animated by the Web Animations API engine. */
  ref?: Ref<HTMLDivElement>;
  /** Dim the target while a timeline with no valid keyframes is loaded. */
  dimmed?: boolean;
  className?: string;
}

const CUBE_SIZE = 120;
const SPHERE_SIZE = 132;

function safeColor(value: string, fallback: string): string {
  return isValidCssColor(value) ? value : fallback;
}

/**
 * The animated preview target.
 *
 * All styling is derived from the keyframe's `KeyframeProperties` through the
 * same composers the CSS generator uses, so what the user sees while scrubbing
 * is exactly what the exported stylesheet declares. Custom SVG markup is
 * sanitized before injection and renders an explicit error state when the
 * markup is empty, unparseable, or fully stripped.
 */
export function TargetGeometry({
  shape,
  properties,
  customSvgContent,
  ref,
  dimmed = false,
  className,
}: TargetGeometryProps) {
  const { transform, filter, styles } = properties;

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      transform: composeTransformCSS(transform),
      filter: composeFilterCSS(filter),
      opacity: styles.opacity,
      backgroundColor: safeColor(styles.backgroundColor, '#00f5d4'),
      borderColor: safeColor(styles.borderColor, '#7928ca'),
      borderWidth: `${styles.borderWidth}px`,
      borderStyle: styles.borderWidth > 0 ? 'solid' : 'none',
      borderRadius: `${styles.borderRadius}px`,
      boxShadow: composeBoxShadowCSS(styles),
      transformOrigin: `${styles.transformOriginX}% ${styles.transformOriginY}%`,
      WebkitFilter: composeFilterCSS(filter),
    }),
    [filter, styles, transform],
  );

  const sanitized = useMemo(
    () => (shape === 'custom-svg' ? sanitizeSvgMarkup(customSvgContent ?? '') : null),
    [customSvgContent, shape],
  );

  return (
    <div
      ref={ref}
      data-shape={shape}
      data-dimmed={dimmed || undefined}
      style={{ ...rootStyle, opacity: dimmed ? styles.opacity * 0.35 : styles.opacity }}
      className={cn(
        'relative grid place-items-center',
        'transition-[filter,box-shadow,background-color] duration-150 ease-[var(--ease-studio)]',
        dimmed && 'grayscale',
        className,
      )}
    >
      {renderShape(shape, styles.backgroundColor, styles.borderColor, customSvgContent ?? '', sanitized)}
    </div>
  );
}

function renderShape(
  shape: PreviewElementShape,
  backgroundColor: string,
  borderColor: string,
  customSvgContent: string,
  sanitized: ReturnType<typeof sanitizeSvgMarkup> | null,
): React.ReactNode {
  const background = safeColor(backgroundColor, '#00f5d4');
  const border = safeColor(borderColor, '#7928ca');

  switch (shape) {
    case 'cube':
      return <Cube background={background} border={border} />;
    case 'sphere':
      return <Sphere background={background} />;
    case 'card':
      return (
        <div
          className="flex h-[132px] w-[196px] flex-col justify-between border p-4"
          style={{ background, borderColor: border, boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.18)' }}
        >
          <span className="block h-2.5 w-16 rounded-full bg-white/70" />
          <span className="block h-2 w-full rounded-full bg-white/25" />
          <span className="block h-2 w-3/4 rounded-full bg-white/25" />
          <span className="block h-2 w-1/2 rounded-full bg-white/25" />
        </div>
      );
    case 'badge':
      return (
        <div
          className="grid h-[64px] w-[184px] place-items-center border text-[11px] font-semibold tracking-[0.3em] text-obsidian-950 uppercase"
          style={{ background, borderColor: border }}
        >
          Studio
        </div>
      );
    case 'typography':
      return (
        <div
          className="grid h-[160px] w-[220px] place-items-center border font-mono text-[72px] leading-none font-black text-white/90 select-none"
          style={{ background: 'transparent', borderColor: border, textShadow: `0 0 32px ${background}66` }}
        >
          Aa
        </div>
      );
    case 'custom-svg':
      return <CustomSvg markup={customSvgContent} sanitized={sanitized} />;
    default:
      return null;
  }
}

function Cube({ background, border }: { background: string; border: string }): React.ReactNode {
  const half = CUBE_SIZE / 2;
  const depth = 32;
  const faces: ReadonlyArray<{ transform: string; filter: string }> = [
    { transform: `translateZ(${half}px)`, filter: 'brightness(1.15)' },
    { transform: `rotateY(180deg) translateZ(${half}px)`, filter: 'brightness(0.55)' },
    { transform: `rotateY(90deg) translateZ(${half}px)`, filter: 'brightness(0.8)' },
    { transform: `rotateY(-90deg) translateZ(${half}px)`, filter: 'brightness(0.7)' },
    { transform: `rotateX(90deg) translateZ(${half}px)`, filter: 'brightness(1.3)' },
    { transform: `rotateX(-90deg) translateZ(${half}px)`, filter: 'brightness(0.45)' },
  ];

  return (
    <div
      className="relative"
      style={{ width: CUBE_SIZE, height: CUBE_SIZE, transformStyle: 'preserve-3d', ['--cube-depth' as string]: `${depth}px` }}
    >
      {faces.map((face, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="absolute inset-0 border"
          style={{ background, borderColor: border, transform: face.transform, filter: face.filter }}
        />
      ))}
    </div>
  );
}

function Sphere({ background }: { background: string }): React.ReactNode {
  return (
    <div
      aria-hidden="true"
      className="rounded-full"
      style={{
        width: SPHERE_SIZE,
        height: SPHERE_SIZE,
        background: `radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.55), ${background} 46%, rgb(0 0 0 / 0.85) 100%)`,
        boxShadow: `inset -10px -14px 28px rgb(0 0 0 / 0.55), 0 18px 40px -20px ${background}`,
      }}
    />
  );
}

function CustomSvg({
  markup,
  sanitized,
}: {
  markup: string;
  sanitized: ReturnType<typeof sanitizeSvgMarkup> | null;
}): React.ReactNode {
  if (!sanitized) return null;

  if (sanitized.ok && sanitized.markup.length > 0) {
    return (
      <div
        aria-label="Custom SVG preview"
        className="grid h-[168px] w-[220px] place-items-center [&>svg]:h-full [&>svg]:w-full"
        // Markup is DOMPurify-sanitized with the SVG profile before injection.
        dangerouslySetInnerHTML={{ __html: sanitized.markup }}
      />
    );
  }

  const message = sanitized.reason === 'empty-input' ? 'Paste an SVG to preview it' : describeSanitizeResult(sanitized);

  return (
    <div
      role="status"
      className="empty-grid flex h-[168px] w-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-obsidian-600 p-4 text-center"
    >
      {sanitized.reason === 'empty-input' ? (
        <FileQuestion width={20} height={20} aria-hidden="true" className="text-zinc-500" />
      ) : (
        <AlertTriangle width={20} height={20} aria-hidden="true" className="text-studio-danger" />
      )}
      <p className="text-[11px] leading-snug text-zinc-400">{message}</p>
    </div>
  );
}
