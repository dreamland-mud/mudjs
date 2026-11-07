/* Mounts every tool's window. The list of tools itself is a Settings page
 * (Settings, Accessibility, Tools: src/components/settings/ToolsPage.jsx). */
import React, { useEffect, useState } from 'react';
import { views, onViewsChanged } from './views';

export default function ToolsHost() {
  const [, bump] = useState(0);
  useEffect(() => onViewsChanged(() => bump(n => n + 1)), []);
  return (
    <>
      {views().map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </>
  );
}
