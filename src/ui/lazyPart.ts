// A part of the app in a file of its own, fetched the first time it is
// wanted (React.lazy). The file may not come: offline in a tab no service
// worker controls yet (a first visit), or after a deploy took it away.
// Vite's preload error, which src/main.tsx answers with the update bar,
// then resolves the import to nothing, and a fetch that fails some other
// way rejects it. Either way the stand-in takes the part's place, and the
// app around it, the game on the board included, stays as it was: a
// missing file never reaches the crash panel.
import type { ComponentType } from 'react';

/** React.lazy's loader for a part, or its stand-in when the part's file cannot be had */
export function partOrStandIn<T extends ComponentType<any>>(
  load: () => Promise<T | undefined>,
  standIn: T
): () => Promise<{ default: T }> {
  return () =>
    load().then(
      (part) => ({ default: part ?? standIn }),
      () => ({ default: standIn })
    );
}
