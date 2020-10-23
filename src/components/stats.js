import React from 'react';
import { usePrompt } from '../react-hooks';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
    progress: {
        position: 'relative',
        flex: '1 1 auto',
        height: '4px',
        color: 'white', // TODO: use the theme

        [theme.breakpoints.up('sm')]: {
            height: '1rem',
        }
    },
    root: {
        display: 'block',

        [theme.breakpoints.up('sm')]: {
            display: 'flex',
            flexDirection: 'row',
        }
    }
}));


const Stat = ({v, max_v, caption, color}) => {
    const big = useMediaQuery(theme => theme.breakpoints.up('sm'));
    const classes = useStyles();

    if(!max_v)
        return null;

    const style = {
        width: `${100*v/max_v | 0}%`,
        backgroundColor: color,
    };

    const span = big && 
        <Box component="span" className="justify-content-center d-flex position-absolute w-100">
            {`${caption} ${v}/${max_v}`}
        </Box>;

    // Uses the Bootstrap progress bar styling.
    return <Box className={`progress ${classes.progress}`}>
        <Box style={style} className="progress-bar" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max_v} />
        { span }
    </Box>
};

// Return Stats component declared in a functional style. This is the same as render() method.
// Will be called every time a setState is invoked from any of the use* or props, e.g. after rpc-prompt event.
export default function Stats(props) {
    const classes = useStyles();
    const { hit, max_hit, mana, max_mana, move, max_move } = usePrompt();

    // TODO use the theme for colors
    return <Box className={classes.root}>
        <Stat caption="Здоровье" color="#bb0000" v={hit} max_v={max_hit}/>
        <Stat caption="Мана" color="#3465a4" v={mana} max_v={max_mana}/>
        <Stat caption="Шаги" color="#055705" v={move} max_v={max_move}/>
    </Box>;
}
