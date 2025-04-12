import React, { useState, useEffect } from 'react';
import Collapse from '@mui/material/Collapse';

export default function PanelItem(props) {
  const storageKey = `panel-collapsed-${props.title}`;
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? JSON.parse(saved) : props.collapsed || false;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  const toggle = e => {
    e.preventDefault();
    setCollapsed(prev => !prev);
  };

  return (
    <div className="table-wrapper">
      <span onClick={toggle} className="dark-panel-title">
        {props.title}
      </span>
      <button
        onClick={toggle}
        className={`close ${collapsed && 'collapsed'}`}
        type="button"
      />
      <Collapse in={!collapsed}>{props.children}</Collapse>
    </div>
  );
}
