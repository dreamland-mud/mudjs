import React from 'react';

/* The settings switch: a button with role="switch", so a screen reader says
 * its name and on/off, and the knob shows it on screen. Name it with label
 * (aria-label) or labelledBy (the id of its visible name). Other props
 * (aria-description, title, aria-keyshortcuts) pass through to the button. */
const SwitchButton = React.forwardRef(function SwitchButton({ on, onToggle, label, labelledBy, ...rest }, ref) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={on ? 'cfg-switch cfg-switch-on' : 'cfg-switch'}
      onClick={onToggle}
      ref={ref}
      {...rest}
    >
      <span className="cfg-switch-knob" />
    </button>
  );
});

export default SwitchButton;
