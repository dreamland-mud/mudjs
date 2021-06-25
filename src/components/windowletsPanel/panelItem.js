import React, { useState } from 'react'
import Collapse from '@material-ui/core/Collapse';


export default function PanelItem(props) {
    const [collapsed, setCollapsed] = useState(props.collapsed || false);
    const toggle = e => {
        e.preventDefault();
        setCollapsed(!collapsed);
    };

    return <div className="table-wrapper">
        <span onClick={toggle} className="dark-panel-title">{props.title}</span>
        <button onClick={toggle} className={`close ${collapsed && 'collapsed'}`} type="button" />
        <Collapse in={!collapsed}>
            { props.children }
        </Collapse>
    </div>;
};