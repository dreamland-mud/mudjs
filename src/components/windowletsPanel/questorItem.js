import React from 'react'
import PanelItem from "./panelItem"

// prompt questor quest info 'q' fields: t - remaining time, i - short quest info.
export default function QuestorItem(prompt) {

    return (
        <PanelItem title={<span>{'Задание квестора: '}<span className='fgby'> {prompt.q.t} </span>{' мин'}</span>}>
            <div id="questor-table" data-hint="hint-questor">
                <p className="fgbw">{prompt.q.i}</p>
            </div>
        </PanelItem>
    )
}