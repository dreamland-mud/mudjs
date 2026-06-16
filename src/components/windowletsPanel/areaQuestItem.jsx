import React from 'react'
import PanelItem from "./panelItem"

// prompt area quest info 'aq' fields: t - windowlet title ("Задание в зоне X"),
// i - current step info, which the engine prefixes with the quoted quest title:
//   "Выше стропила, плотники!": <step description>
// Render that quoted title in bright yellow; the step text inherits dark yellow.
export default function AreaQuestItem(prompt) {
    const raw = prompt.aq.i || ''
    const m = raw.match(/^"([^"]*)":\s?([\s\S]*)$/)
    const body = m
        ? (<><span style={{ color: '#fdea56' }}>"{m[1]}"</span>: {m[2]}</>)
        : raw

    return (
        <PanelItem title={<span>{prompt.aq.t}</span>}>
            <div id="questor-table" data-hint="hint-questor">
                <p className="fgbw">{body}</p>
            </div>
        </PanelItem>
    )
}
