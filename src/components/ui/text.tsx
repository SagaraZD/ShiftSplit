import { cssInterop } from 'nativewind';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { usePreferences } from '@/providers/preferences-provider';

type Style = TextProps['style'];

// Every text-size Tailwind class in this app already resolves to a concrete
// fontSize/lineHeight via NativeWind before it ever reaches this component,
// so scaling the resolved style here rescales the whole app uniformly
// regardless of whether a screen used a className or an inline style.
// RN's StyleProp recursive-array type isn't practically expressible through
// a recursive helper, so this walks the value as `unknown` and casts once
// at the public boundary below.
function scaleStyleValue(style: unknown, scale: number): unknown {
  if (scale === 1 || !style) return style;
  if (Array.isArray(style)) {
    return style.map((entry) => scaleStyleValue(entry, scale));
  }
  if (typeof style === 'object') {
    const next: Record<string, unknown> = { ...(style as Record<string, unknown>) };
    if (typeof next.fontSize === 'number') next.fontSize = next.fontSize * scale;
    if (typeof next.lineHeight === 'number') next.lineHeight = next.lineHeight * scale;
    return next;
  }
  return style;
}

function scaleStyle(style: Style, scale: number): Style {
  return scaleStyleValue(style, scale) as Style;
}

export function Text({ style, ...props }: TextProps) {
  const { fontScale } = usePreferences();
  return <RNText {...props} style={scaleStyle(style, fontScale)} />;
}

cssInterop(Text, { className: 'style' });

export function TextInput({ style, ...props }: TextInputProps) {
  const { fontScale } = usePreferences();
  return <RNTextInput {...props} style={scaleStyle(style, fontScale)} />;
}

cssInterop(TextInput, { className: 'style' });
