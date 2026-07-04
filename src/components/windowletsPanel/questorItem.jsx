import React from 'react'
import PanelItem from "./panelItem"
import { t } from '../../i18n'

// prompt questor quest info 'q' fields: t - remaining time, i - short quest info.
export default function QuestorItem(prompt) {

    return (
        <PanelItem storageKey="questor" title={<span>{t('qst.title', prompt.lang) + ' '}<span className='fgby'> {prompt.q.t} </span>{' ' + t('qst.min', prompt.lang)}</span>}>
            <div id="questor-table" data-hint="hint-questor">
                <p className="fgbw">{prompt.q.i}</p>
            </div>
        </PanelItem>
    )
}
