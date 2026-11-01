// Writing to localStorage, with the reason when it fails: the project and the
// user's presets are the person's work, so a failed write is shown, not
// swallowed (ui/storageNote.ts). Storage is a parameter (tests fake it); the
// getter itself may throw when the browser blocks site data.

export type StorageWrite = 'ok' | 'blocked' | 'full';

export function writeStorage(storage: () => Pick<Storage, 'setItem'>, key: string, value: string): StorageWrite {
  try {
    storage().setItem(key, value);
    return 'ok';
  } catch (error) {
    return isQuotaError(error) ? 'full' : 'blocked';
  }
}

/** The quota is spent: deleting something helps. Firefox has a name of its own. */
function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}
