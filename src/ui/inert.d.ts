// The inert attribute (HTML): an element and all it holds leave the Tab
// order and a screen reader's reach, and take no clicks. React 18 passes
// it on as an attribute when it is given as a string (inert=""), but its
// types do not have it yet; the controls behind the pause card rest this
// way (App.tsx, useResting).
import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: '' | undefined;
  }
}
