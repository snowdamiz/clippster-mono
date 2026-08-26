/** Web-only stub for expo-secure-store (uses localStorage). */

const PREFIX = 'clippster.secure.';

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};
