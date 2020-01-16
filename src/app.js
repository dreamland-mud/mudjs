
import React from 'react';
import ReactDom from 'react-dom';

import Terminal from './components/terminal';
import Panel from './components/panel'

import SplitPane from 'react-split-pane';

export default props => {
    const hide = { display: 'none' };
    return <div id="page" className="flexcontainer-column">
            <div className="main-content flexcontainer-row flex-grow-shrink-auto">
                <Terminal />
                <Panel />
            </div>
            <button id="reconnect" type="button" className="btn btn-primary">Reconnect</button>
            <form id="input">
                <input type="text"></input>
            </form>
            <div id="stats">
                <div className="row">
                    <div className="progress col-sm-4 position-relative">
                        <div id="hits" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                        <span className="justify-content-center d-flex position-absolute w-100"></span>
                    </div>
                    <div className="progress col-sm-4 position-relative">
                        <div id="mana" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                        <span className="justify-content-center d-flex position-absolute w-100"></span>
                    </div>
                    <div className="progress col-sm-4 position-relative">
                        <div id="moves" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                        <span className="justify-content-center d-flex position-absolute w-100"></span>
                    </div>
                </div>
            </div>
        </div>;
};
