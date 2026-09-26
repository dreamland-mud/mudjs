import React from 'react'
import PanelItem from "./panelItem"
import { openWidgetHelp } from '../helpSheet/HelpSheet'
import { t } from '../../i18n'

// prompt questor quest info 'q' fields: t - remaining time, i - short quest info.
export default function QuestorItem(prompt) {

    return (
        <PanelItem storageKey="questor" title={<span>{t('qst.title', prompt.lang) + ' '}<span className='fgby'> {prompt.q.t} </span>{' ' + t('qst.min', prompt.lang)}</span>}
            onOpen={() => openWidgetHelp({ kind: 'cmd', what: 'quest' })}>
            <div id="questor-table">
                <p className="fgbw">{prompt.q.i}</p>
            </div>
        </PanelItem>
    )
}
