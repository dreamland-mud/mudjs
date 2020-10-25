import React from 'react';
import ReactDom from 'react-dom';
import { useSelector } from 'react-redux';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';


export default props => {
    return <div class="terminal-wrap">
            <div class="terminal"></div>
          </div>;
};