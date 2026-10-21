import React from 'react';
import '../focus-orbit.css';

// The arcane focus orbit (two purple glows circling a focused field), drawn as two
// pre-blurred static layers that only translate -- compositor-only, so a focused
// field never repaints a filter per frame. Drop it as the LAST child of a
// position:relative box that holds the field; it shows while that box has focus.
// The glow is clipped to the outside of the box. `behind` also tucks it under the
// field, for fields that draw their own outer focus ring (login inputs).
export default function FocusOrbit({ behind = false }) {
  return (
    <span className={'focus-orbit' + (behind ? ' focus-orbit--behind' : '')} aria-hidden="true">
      <span className="focus-orbit__a" />
      <span className="focus-orbit__b" />
    </span>
  );
}
