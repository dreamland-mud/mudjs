import React from 'react'
import PanelItem from "./panelItem"

// prompt area quest info 'aq' fields: t - windowlet title, i - current step info.
export default function AreaQuestItem(prompt) {

    return (
        <PanelItem title={<span>{prompt.aq.t}</span>}>
            <div id="questor-table" data-hint="hint-questor">
                <p className="fgbw">{prompt.aq.i}</p>
            </div>
        </PanelItem>
    )
}
