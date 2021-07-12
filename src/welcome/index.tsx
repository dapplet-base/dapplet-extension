import { browser, Management } from "webextension-polyfill-ts";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, Form, Message, Image, Card, Modal, Input, Icon, List } from 'semantic-ui-react';
//import 'semantic-ui-css/semantic.min.css';
import NOLOGO_PNG from '../common/resources/no-logo.png';

import './index.scss';
import { Bus } from '../common/bus';
import ModuleInfo from '../background/models/moduleInfo';
import VersionInfo from '../background/models/versionInfo';
import * as tracing from '../common/tracing';
import { ChainTypes, DefaultSigners } from "../common/types";
import { typeOfUri, chainByUri } from "../common/helpers";

tracing.startTracing();

interface IIndexProps { }

interface IIndexState {
    previousExts: Management.ExtensionInfo[];
    isLoading: boolean;
    isUninstalling: boolean;
}

class Index extends React.Component<IIndexProps, IIndexState> {

    constructor(props) {
        super(props);

        this.state = {
            previousExts: [],
            isLoading: true,
            isUninstalling: false
        };
    }

    async componentDidMount() {
        const exts = await browser.management.getAll();
        const currentExtId = browser.runtime.id;
        const previousExts = exts.filter(x => x.name === 'Dapplets' && x.id !== currentExtId);    
        this.setState({ isLoading: false, previousExts });
    }

    private _confirmHandler() {
        this.setState({ isUninstalling: true });
        this.state.previousExts.forEach(x => (browser.management as any).uninstall(x.id, { showConfirmDialog: true }));
        this.setState({ isUninstalling: false });
        window.close();
    }

    private _declineHandler() {
        window.close();
    }

    render() {
        return <div>
            Found {this.state.previousExts.length} another instance(s) of the current extension. Do you want to uninstall it?
            <button onClick={() => this._confirmHandler()}>Yes</button>
            <button onClick={() => this._declineHandler()}>No</button>
            {this.state.previousExts.map((x, i) => <div key={i}>{x.id}</div>)}
        </div>;
    }
}

ReactDOM.render(<Index />, document.querySelector('#app'));