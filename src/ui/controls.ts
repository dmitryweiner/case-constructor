// The panel's rows: maker-kit's ui/controls with this app's dictionary.
// Every card of the panel is drawn by the same code; a row is data — how to
// read a value and how to write it (maker-kit's docs/ui.md).

import type { Control as KitControl, ControlsHandle } from 'maker-kit/ui/controls';
import { renderControls as renderKitControls } from 'maker-kit/ui/controls';
import type { Key } from '../i18n';
import { t } from '../i18n';

export type Control<T> = KitControl<T, Key>;
export type { ControlsHandle };

/**
 * A change from the panel. `final` false: a frame of a gesture (a drag,
 * typing, −/+ held), shown but not yet an undo step; true or absent: the
 * edit is done, one step (a card's own buttons — add, remove — say nothing).
 */
export type Change<T> = (next: T, final?: boolean) => void;

export function renderControls<T>(
  container: HTMLElement,
  controls: readonly Control<T>[],
  read: () => T,
  change: Change<T>,
  idPrefix: string,
): ControlsHandle<T> {
  return renderKitControls(container, controls, { read, change, idPrefix, t });
}
