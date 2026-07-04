import React from 'react'
import PanelItem from './panelItem'
import { t } from '../../i18n'


// prompt 'group' fields: ln - leader name in genitive case,
// leader - leader stats to display as a first line,
// pc - list of all remaining PCs, npc - all NPCs in the group.
// Each line format: sees - name, level, health - hitpoints percentage, hit_clr - color to display health with
// tnl - exp to next level.
const TeamMate = (stats) => {
     return (
        <tr>
            <td>{stats.sees}</td>
            <td>{stats.level}</td>
            <td className={"fg-ansi-bright-color-" + stats.hit_clr}>{stats.health + "%"}</td>
            <td>{stats.tnl}</td>
        </tr>
    )
}

export default function GroupItem(prompt) {

    return <PanelItem storageKey="group" title={t('grp.title', prompt.lang) + ' ' + prompt.group.ln} collapsed={true} >
            <div id="group-table">
                <table>
                    <thead>
                        <tr>
                            <th>{t('grp.name', prompt.lang)}</th>
                            <th>{t('grp.lvl', prompt.lang)}</th>
                            <th>{t('grp.health', prompt.lang)}</th>
                            <th>{t('grp.exp', prompt.lang)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prompt.group.leader && <TeamMate {...prompt.group.leader}/>}
                        {prompt.group.pc && prompt.group.pc.map((stats, i) => {
                            return (
                                <TeamMate key={i} {...stats} />
                            )
                        })}
                        {prompt.group.npc && prompt.group.npc.map((stats, i) => {
                            return (
                                <TeamMate key={i} {...stats} />
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </PanelItem>
}


