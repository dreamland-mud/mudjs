import React, { useState } from 'react'
import Collapse from '@mui/material/Collapse';

// Persist each panel's collapsed/expanded state across sessions in localStorage, so players
// don't have to re-collapse the same panels on every login. Keyed by an explicit storageKey
// when the panel's title is dynamic (group/quest), otherwise by the stable string title.
const storageKeyFor = props => {
    if (props.storageKey) return 'panel.collapsed.' + props.storageKey;
    if (typeof props.title === 'string') return 'panel.collapsed.' + props.title;
    return null;
};

export default function PanelItem(props) {
    const storeKey = storageKeyFor(props);

    const [collapsed, setCollapsed] = useState(() => {
        if (storeKey != null) {
            const saved = localStorage.getItem(storeKey);
            if (saved != null) return saved === '1';
        }
        return props.collapsed || false;
    });

    const toggle = e => {
        e.preventDefault();
        setCollapsed(prev => {
            const next = !prev;
            if (storeKey != null) localStorage.setItem(storeKey, next ? '1' : '0');
            return next;
        });
    };

    return <div className="table-wrapper">
        <span onClick={toggle} className="dark-panel-title">{props.title}</span>
        <button onClick={toggle} className={`close ${collapsed && 'collapsed'}`} type="button" />
        <Collapse in={!collapsed}>
            { props.children }
        </Collapse>
    </div>;
};
