import React, {useId} from 'react';
import {StyleSheet, View, ViewProps, ViewStyle} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';

export type SurfaceTone =
  | 'raised'
  | 'secondary'
  | 'primary'
  | 'footer'
  | 'danger'
  | 'inset';
export type SurfaceLevel = 'ground' | 'raised';

export type SurfacePaintProps = {
  tone?: SurfaceTone;
  radius?: number;
  accent?: string;
  pressed?: boolean;
  from?: string;
  to?: string;
};

function tint(base: string, accent: string, strength: number): string {
  return `#${[1, 3, 5]
    .map(offset =>
      Math.round(
        parseInt(base.slice(offset, offset + 2), 16) * (1 - strength) +
          parseInt(accent.slice(offset, offset + 2), 16) * strength,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function surfaceStops(
  dark: boolean,
  {tone = 'raised', accent, pressed = false, from, to}: SurfacePaintProps = {},
): readonly [string, string] {
  const colors = palette(dark);
  let start: string;
  let end: string;
  switch (tone) {
    case 'primary':
      start = colors.primary;
      end = colors.primaryDeep;
      break;
    case 'secondary':
      start = colors.surface;
      end = colors.inset;
      break;
    case 'footer':
      start = colors.inset;
      end = colors.surface;
      break;
    case 'danger':
      start = end = colors.dangerSurface;
      break;
    case 'inset':
      start = end = colors.inset;
      break;
    default:
      start = colors.surfaceRaised;
      end = colors.surfaceShade;
  }
  start = from ?? start;
  end = to ?? end;
  if (
    ![start, end, ...(accent === undefined ? [] : [accent])].every(color =>
      /^#[\da-f]{6}$/i.test(color),
    )
  ) {
    throw new Error('Surface colors must be six-digit hex values.');
  }
  if (accent !== undefined) start = tint(start, accent, dark ? 0.015 : 0.06);
  if (pressed) {
    const ink = tone === 'danger' ? colors.danger : colors.text;
    start = tint(start, ink, 0.04);
    end = tint(end, ink, 0.04);
  }
  return [start, end];
}

export function surfaceElevation(
  dark: boolean,
  level: SurfaceLevel,
): ViewStyle {
  return level === 'ground'
    ? {}
    : {
        shadowColor: palette(dark).shadow,
        shadowOpacity: dark ? 0.32 : 0.06,
        shadowRadius: 10,
        shadowOffset: {width: 0, height: 3},
        elevation: 2,
      };
}

/** An opaque, decorative paint layer; it never changes layout or touch targets. */
export const SurfaceFill = React.memo(function SurfacePaint({
  radius = 14,
  ...paint
}: SurfacePaintProps) {
  const {dark} = useTheme();
  const [from, to] = surfaceStops(dark, paint);
  const id = `surface-${useId().replace(/\W/g, '')}`;
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}>
      {/* Resolve SVG percentages against an unpadded viewport, not the control's content box. */}
      <Svg
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          rx={radius}
          ry={radius}
          fill={`url(#${id})`}
        />
      </Svg>
    </View>
  );
});

export default function Surface({
  tone = 'raised',
  level = 'ground',
  radius = 14,
  accent,
  pressed,
  from,
  to,
  style,
  children,
  ...props
}: ViewProps & SurfacePaintProps & {level?: SurfaceLevel}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const paint = {tone, radius, accent, pressed, from, to};
  return (
    <View
      {...props}
      style={[
        styles.bordered,
        tone === 'primary' && styles.borderless,
        {
          backgroundColor: surfaceStops(dark, paint)[0],
          borderRadius: radius,
          borderColor: tone === 'danger' ? colors.danger : colors.surfaceBorder,
        },
        surfaceElevation(dark, level),
        style,
      ]}>
      <SurfaceFill {...paint} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bordered: {borderWidth: StyleSheet.hairlineWidth},
  borderless: {borderWidth: 0},
});
