// The banner under the top bar that says what browser storage failed to keep:
// the current project (for as long as it fails — the work is at stake) and a
// preset that could not be saved or deleted (until dismissed or done). It
// lives outside the build's blockers line, which every rebuild rewrites.

import type { StorageWrite } from 'maker-kit/core/storage';
import type { Key } from '../i18n';
import { t } from '../i18n';

export interface StorageStatus {
  /** The last write of the current project. */
  project: StorageWrite;
  /** The last preset action that failed; null once one succeeds or the note is dismissed. */
  preset: { action: 'save' | 'delete'; result: Exclude<StorageWrite, 'ok'> } | null;
}

export interface StorageNoteLine {
  key: Key;
  /** A preset's failure is an event and may be dismissed; the project's is a state and stays. */
  dismiss: boolean;
}

export function storageNotes(status: StorageStatus): StorageNoteLine[] {
  const lines: StorageNoteLine[] = [];
  if (status.project !== 'ok')
    lines.push({ key: status.project === 'full' ? 'storage.project.full' : 'storage.project.blocked', dismiss: false });
  const preset = status.preset;
  if (preset) {
    const key: Key =
      preset.action === 'delete' ? 'error.presetDelete' : preset.result === 'full' ? 'error.presetSaveFull' : 'error.presetSave';
    lines.push({ key, dismiss: true });
  }
  return lines;
}

export function renderStorageNote(banner: HTMLElement, status: StorageStatus, onDismiss: () => void): void {
  const lines = storageNotes(status);
  banner.replaceChildren(
    ...lines.map((line) => {
      const row = document.createElement('p');
      row.className = 'storage-line';
      const text = document.createElement('span');
      text.textContent = t(line.key);
      row.append(text);
      if (line.dismiss) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'storage-close';
        close.textContent = '✕';
        close.title = t('storage.dismiss');
        close.setAttribute('aria-label', t('storage.dismiss'));
        close.addEventListener('click', onDismiss);
        row.append(close);
      }
      return row;
    }),
  );
  banner.hidden = lines.length === 0;
}
