import * as Crypto from 'expo-crypto';

import type { EditorIdFactory } from './ids';

export const createNativeEditorId: EditorIdFactory = (prefix) => `${prefix}_${Crypto.randomUUID()}`;
