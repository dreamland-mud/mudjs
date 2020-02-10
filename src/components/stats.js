import React, { useState, useEffect } from 'react';
import Box from '@material-ui/core/Box';
import { usePrompt } from '../react-hooks';

const Stat = ({v, max_v, caption, color}) => {
    if(!max_v)
        return null;

    const style = {
        width: `${100*v/max_v | 0}%`,
        backgroundColor: color,
    };

    return <Box className="progress col-sm-4 position-relative">
        <Box style={style} className="progress-bar" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max_v} />
        <Box component="span" className="justify-content-center d-flex position-absolute w-100">
            {`${caption} ${v}/${max_v}`}
        </Box>
    </Box>
};

export default function Stats(props) {
    const { hit, max_hit, mana, max_mana, move, max_move } = usePrompt();

    // TODO use the theme for colors
    return <div id="stats">
        <div className="row">
            <Stat caption="Здоровье" color="#bb0000" v={hit} max_v={max_hit}/>
            <Stat caption="Мана" color="#3465a4" v={mana} max_v={max_mana}/>
            <Stat caption="Шаги" color="#055705" v={move} max_v={max_move}/>
        </div>
    </div>;
}
