import { requireNativeViewManager } from 'expo-modules-core';
import { createElement, type ComponentType } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

export type ClippsterEditorPreviewProps = {
  documentJson: string;
  playing?: boolean;
  playheadSeconds?: number;
  quality?: string;
  style?: StyleProp<ViewStyle>;
  onSurfaceReady?: () => void;
  onFramePresented?: (event: { nativeEvent: { timeSeconds?: number } }) => void;
};

type PreviewView = ComponentType<ClippsterEditorPreviewProps>;

let NativePreview: PreviewView | null = null;

try {
  if (Platform.OS !== 'web') {
    NativePreview = requireNativeViewManager('ClippsterEditorNative') as PreviewView;
  }
} catch {
  NativePreview = null;
}

export function ClippsterEditorPreview(props: ClippsterEditorPreviewProps) {
  if (!NativePreview) return null;
  return createElement(NativePreview, props);
}

export function isNativePreviewAvailable(): boolean {
  return NativePreview != null;
}
