
import React from 'react';
import ReactDom from 'react-dom';

import Terminal from './components/terminal';
import Panel from './components/panel'

import SplitterLayout from 'react-splitter-layout';

import 'react-splitter-layout/lib/index.css';

export default class App extends React.Component {
    state = { panel: true };

    toggle = e => {
        console.log('Toggle!');
        e.preventDefault();
        this.setState({ panel: !this.state.panel });
    };

    render() {
        const hamburger = {
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            zIndex: '999'
        };

        return <div id="page" className="flexcontainer-column">
                <div className="flex-grow-shrink-auto main-content">
                    <div style={ hamburger }><button onClick={this.toggle}>Show/hide</button></div>
                    <SplitterLayout secondaryInitialSize={270}>
                        <Terminal />
                        { this.state.panel ? <Panel /> : [] }
                    </SplitterLayout>
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
    }
}
