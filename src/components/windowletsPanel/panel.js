import React from 'react';
import { useSelector } from 'react-redux'
import Box from '@material-ui/core/Box';

import TimeWeatherItem from './timeWeatherItem'
import LocationItem from './locationItem'
import CommandButtons from './commandButtons'
import Help from './panelHelp';
import GroupItem from './groupItem';
import PlayerParamsItem from './playerParamsItem'
import WhoItem from './whoItem'
import QuestorItem from './questorItem'
import AffectsItem from './affectsItem'

export default function Panel() {

    const prompt = useSelector(state => state.prompt)

    const isPrompt = () => {
        if (!prompt) return false
        return true
    }

    const isPromptGroup = () => {
        if (!prompt) return false
        if (prompt.group === undefined) return false
        if (prompt.group === "none") return false
        return true
    }    

    const isPromptAffect = () => {
        if (!prompt) return false
        if ((!prompt.det || prompt.det === "none") && 
        (!prompt.trv || prompt.trv === "none") && 
        (!prompt.enh || prompt.enh === "none") && 
        (!prompt.pro || prompt.pro === "none") && 
        (!prompt.mal || prompt.mal === "none") && 
        (!prompt.cln || prompt.cln === "none")) return false
        return true
    }   

    const isPromptParams = () => {
        if (!prompt) return false
        if (!prompt.p1 && !prompt.p2) return false
        return true
    }    

    const isPromptQuestor = () => {
        if (!prompt) return false
        if (prompt.q === undefined) return false
        if (prompt.q === "none") return false
        return true
    }    

    const isPromptWho = () => {
        if (!prompt) return false
        if (!prompt.who) return false
        return true
    }    

    return (
        <Box id="panel-wrap" flex="1" aria-hidden="true">
            {isPrompt() && <TimeWeatherItem {...prompt} />}
            {isPrompt() && <LocationItem {...prompt} />}
            {isPromptGroup() && <GroupItem {...prompt} />}
            {isPromptAffect() && <AffectsItem {...prompt} />}
            {isPromptParams() && <PlayerParamsItem {...prompt} />}
            {isPromptQuestor() && <QuestorItem {...prompt} />}
            {isPromptWho() && <WhoItem {...prompt} />}
            <Help />
            {isPrompt() && <CommandButtons />}
        </Box>
    )
}
