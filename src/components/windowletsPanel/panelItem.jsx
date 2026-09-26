import React, { useState } from 'react'

// onOpen: clicking the widget body opens its help sheet (helpSheet/HelpSheet.jsx).
//
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

    // Bespoke collapse (no MUI): animate grid-template-rows 1fr <-> 0fr. Children stay
    // mounted so live prompt updates keep flowing while collapsed, same as MUI Collapse did.
    return <div className="table-wrapper">
        <span onClick={toggle} className="dark-panel-title">{props.title}</span>
        <button onClick={toggle} className={collapsed ? 'close collapsed' : 'close'} type="button" aria-expanded={!collapsed} />
        <div className={collapsed ? 'rf-collapse is-collapsed' : 'rf-collapse'}>
            <div className={props.onOpen ? 'rf-collapse-inner hs-opener' : 'rf-collapse-inner'}
                onClick={props.onOpen}>{ props.children }</div>
        </div>
    </div>;
};
