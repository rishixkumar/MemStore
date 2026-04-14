import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

type IconProps = {
  color?: string;
  size?: number;
};

export function GearIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.secondary;
  const center = 12;
  const toothWidth = 2.2;
  const toothHeight = 4;
  const radius = 8.3;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[0, 60, 120, 180, 240, 300].map((rotation) => (
        <Rect
          key={rotation}
          x={center - toothWidth / 2}
          y={center - radius - toothHeight / 2}
          width={toothWidth}
          height={toothHeight}
          rx={1}
          fill={strokeColor}
          transform={`rotate(${rotation} ${center} ${center})`}
        />
      ))}
      <Circle cx={12} cy={12} r={6.5} stroke={strokeColor} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={2.4} stroke={strokeColor} strokeWidth={1.6} />
    </Svg>
  );
}

export function RefreshIcon({
  color,
  size = 16,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.secondary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18.5 8.5V4.8h-3.7"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 9a6.5 6.5 0 1 0 1 6.2"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({
  color,
  size = 16,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.tertiary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={5.5} stroke={strokeColor} strokeWidth={1.8} />
      <Path d="M15.2 15.2L19 19" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function NoteIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Z"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M13.8 4.7 16.3 7.2" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function VoiceIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 1 1-5 0v-4A2.5 2.5 0 0 1 12 4Z"
        stroke={strokeColor}
        strokeWidth={1.8}
      />
      <Path d="M8 10.5a4 4 0 1 0 8 0" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 15v4" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function PlayIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const fillColor = color || theme.colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6.5v11l9-5.5-9-5.5Z" fill={fillColor} />
    </Svg>
  );
}

export function PauseIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const fillColor = color || theme.colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6h3v12H8zM13 6h3v12h-3z" fill={fillColor} />
    </Svg>
  );
}

export function TrashIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.semantic.danger;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 7h12M9 7V5h6v2M9.5 10.5v5M14.5 10.5v5M7.5 7l.7 11.2a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8L16.5 7"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Tab bar: globe + grid meridians, stroke-only to match Timeline / Places icons. */
export function MapTabIcon({
  color,
  size = 28,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx={14} cy={14} r={9} stroke={color} strokeWidth={2} />
      <Path
        d="M14 5c2.2 2.6 3.5 5.8 3.5 9s-1.3 6.4-3.5 9M14 5c-2.2 2.6-3.5 5.8-3.5 9s1.3 6.4 3.5 9"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M5.5 11.5h17M5.5 16.5h17"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M8 7.5c2.2 1.5 4.7 2.3 6 2.3s3.8-.8 6-2.3M8 20.5c2.2-1.5 4.7-2.3 6-2.3s3.8.8 6 2.3"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ArchiveIcon({
  color,
  size = 18,
}: IconProps) {
  const { theme } = useTheme();
  const strokeColor = color || theme.colors.text.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={6} width={14} height={13} rx={2.5} stroke={strokeColor} strokeWidth={1.8} />
      <Path d="M8 4.8h8" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 10.5h6M9 14h6" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
