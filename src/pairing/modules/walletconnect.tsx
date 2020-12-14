import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { browser } from "webextension-polyfill-ts";

import { List, Button, Segment } from "semantic-ui-react";
import { Container, Header } from 'semantic-ui-react'
import { svgObject } from "qr-image";
import { Link, Redirect } from "react-router-dom";
import { Bus } from '../../common/bus';
import { WalletInfo } from '../../common/constants';

interface Props {
    bus: Bus;
}

interface State {
    svgPath: string;
    isPaired: boolean;
    error: string;
    wallet?: {
        accounts?: string[],
        chainId?: number,
        peerId?: string,
        peerMeta?: {
            icons?: string[],
            name?: string,
            url?: string
        }
    }
    walletInfo: WalletInfo;
    toBack: boolean;
}

export default class extends React.Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            svgPath: null,
            isPaired: false,
            error: null,
            walletInfo: null,
            toBack: false
        };
    }

    async componentDidMount() {
        // const { generateUri, waitPairing, getGlobalConfig } = await initBGFunctions(browser);
        // var uri = await generateUri();
        // console.log("[DAPPLETS]: New pairing URI generated", uri);
        // const svgPath = svgObject(uri, { type: 'svg' });
        // this.setState({ svgPath: svgPath.path });

        // const result = await waitPairing();

        // if (result) {
        //     const wallet = result.params[0];
        //     if (wallet) {
        //         this.setState({ wallet });
        //     }

        //     const config = await getGlobalConfig();

        //     this.setState({
        //         isPaired: true,
        //         walletInfo: config.walletInfo
        //     });
        //     this.props.bus.publish('paired');
        // } else {
        //     this.setState({
        //         isPaired: true,
        //         error: 'Wallet paring failed'
        //     });
        //     this.props.bus.publish('error');
        // }

        try {
            const { connectWallet } = await initBGFunctions(browser);

            this.props.bus.subscribe('walletconnect', (uri) => {
                const svgPath = svgObject(uri, { type: 'svg' });
                this.setState({ svgPath: svgPath.path });
                this.props.bus.unsubscribe('walletconnect');
            });

            await connectWallet('walletconnect');
            this.setState({ isPaired: true });
        } catch (err) {
            this.setState({ isPaired: true, error: 'Error ' });
        }
    }

    componentWillUnmount() {
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
        const { svgPath, isPaired, error, wallet, walletInfo, toBack } = this.state;

        if (toBack === true) {
            return <Redirect to='/' />
        }

        return (
            <Container text>
                {!isPaired ? (
                    <React.Fragment>
                        <Header as='h2'>WalletConnect Pairing</Header>
                        <p>Scan QR code with a WalletConnect-compatible wallet</p>
                        {svgPath ? (<svg viewBox="1 1 53 53"><path d={svgPath} /></svg>) : null}
                        <Button><Link to="/">Back</Link></Button>
                    </React.Fragment>
                ) : (
                        <React.Fragment>
                            {!error ? (
                                <div>
                                    <Header as='h2'>Wallet connected</Header>
                                    <p>Account: {wallet?.accounts[0]}</p>
                                    <p>Chain ID: {wallet?.chainId}</p>
                                    <p>Peer Name: {wallet?.peerMeta?.name}</p>
                                    <p>Peer URL: {wallet?.peerMeta?.url}</p>
                                    <p>SOWA Compatibility: {walletInfo?.compatible ? "Yes" : "No"}</p>
                                    <p>SOWA Protocol Version: {walletInfo?.protocolVersion || "UNKNOWN"}</p>
                                    <p>SOWA Engine Version: {walletInfo?.engineVersion || "UNKNOWN"}</p>
                                    <p>Device Manufacturer: {walletInfo?.device?.manufacturer || "UNKNOWN"}</p>
                                    <p>Device Model: {walletInfo?.device?.model || "UNKNOWN"}</p>
                                    <Button onClick={() => this.disconnect()}>Disconnect</Button>
                                    <Button primary onClick={() => this.continue()}>Continue</Button>
                                </div>
                            ) : (<p>{error}</p>)}
                        </React.Fragment>
                    )}
            </Container>
        );
    }
}
