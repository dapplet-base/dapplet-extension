import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { browser } from "webextension-polyfill-ts";

import { Button, Segment } from "semantic-ui-react";
import { Header } from 'semantic-ui-react'
import { svgObject } from "qr-image";
import { Redirect } from "react-router-dom";
import { Bus } from '../../common/bus';
import { WalletDescriptor } from "../../common/types";

interface Props {
    bus: Bus;
}

interface State {
    svgPath: string;
    connected: boolean;
    error: string;
    toBack: boolean;
    descriptor: WalletDescriptor | null;
}

export default class extends React.Component<Props, State> {

    private _mounted = true;

    constructor(props) {
        super(props);
        this.state = {
            svgPath: null,
            connected: false,
            error: null,
            toBack: false,
            descriptor: null
        };
    }

    async componentDidMount() {

        this._mounted = true;

        try {
            const { connectWallet, getWalletDescriptors } = await initBGFunctions(browser);

            this.props.bus.subscribe('walletconnect', (uri) => {
                const svgPath = svgObject(uri, { type: 'svg' });
                this.setState({ svgPath: svgPath.path });
                this.props.bus.unsubscribe('walletconnect');
            });

            await connectWallet('walletconnect');
            const descriptors = await getWalletDescriptors();
            const descriptor = descriptors.find(x => x.type === 'walletconnect');
            if (this._mounted) this.setState({ connected: true, descriptor });
        } catch (err) {
            if (this._mounted) this.setState({ connected: true, error: err.message });
        }
    }

    componentWillUnmount() {
        this._mounted = false;
        this.props.bus.unsubscribe('walletconnect');
    }

    async disconnect() {
        const { disconnectWallet } = await initBGFunctions(browser);
        await disconnectWallet('walletconnect');
        this.setState({ toBack: true });
    }

    async continue() {
        this.props.bus.publish('ready');
    }

    render() {
        const s = this.state;

        if (s.toBack === true) {
            return <Redirect to='/' />
        }

        if (s.error) return (
            <>
                <h3>Error</h3>
                <p>{s.error}</p>
                <Button onClick={() => this.setState({ toBack: true })}>Back</Button>
            </>
        );

        if (!s.connected) return (
            <React.Fragment>
                <Header as='h2'>WalletConnect Pairing</Header>
                <p>Scan QR code with a WalletConnect-compatible wallet</p>
                {s.svgPath ? (<svg viewBox="1 1 53 53"><path d={s.svgPath} /></svg>) : null}
                <Button onClick={() => this.setState({ toBack: true })}>Back</Button>
            </React.Fragment>
        );

        if (s.connected) return (<>
            <h3>Connected</h3>
            <p>The wallet is connected</p>
            {(s.descriptor.meta) ? <Segment style={{ textAlign: 'center' }}>
                <img src={s.descriptor.meta.icon} alt={s.descriptor.meta.name} style={{ width: '64px' }} />
                <div style={{ fontWeight: 'bold', fontSize: '1.3em' }}>{s.descriptor.meta.name}</div>
                <div>{s.descriptor.meta.description}</div>
                <div>{s.descriptor.account}</div>
            </Segment> : null}
            <div style={{ marginTop: '15px' }}>
                <Button onClick={() => this.disconnect()}>Disconnect</Button>
                <Button primary onClick={() => this.continue()}>Continue</Button>
            </div>
        </>);
    }
}
