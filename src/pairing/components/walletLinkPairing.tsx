import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { browser } from "webextension-polyfill-ts";

import { List, Button, Segment } from "semantic-ui-react";
import { Container, Header } from 'semantic-ui-react'
import { svgObject } from "qr-image";
import { Link, Redirect } from "react-router-dom";
import { Bus } from '../../common/bus';
import { WalletInfo } from '../../common/constants';

interface ISelectWalletProps {
}

interface ISelectWalletState {
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

export class WalletLinkPairing extends React.Component<ISelectWalletProps, ISelectWalletState> {
    private bus: Bus = null;

    constructor(props) {
        super(props);
        this.bus = new Bus();
        this.state = {
            svgPath: null,
            isPaired: false,
            error: null,
            walletInfo: null,
            toBack: false
        };
    }

    async componentDidMount() {
        const backgroundFunctions = await initBGFunctions(browser);
        const { generateUri, waitPairing, getGlobalConfig } = backgroundFunctions;
        var uri = await generateUri();
        console.log("[DAPPLETS]: New pairing URI generated", uri);
        const svgPath = svgObject(uri, { type: 'svg' });
        this.setState({ svgPath: svgPath.path });

        const result = await waitPairing();

        if (result) {
            const wallet = result.params[0];
            if (wallet) {
                this.setState({ wallet });
            }

            const config = await getGlobalConfig();

            this.setState({
                isPaired: true,
                walletInfo: config.walletInfo
            });
            this.bus.publish('paired');
        } else {
            this.setState({
                isPaired: true,
                error: 'Wallet paring failed'
            });
            this.bus.publish('error');
        }

    }

    async disconnect() {
        const { disconnect } = await initBGFunctions(browser);
        await disconnect();
        this.setState({ toBack: true });
    }

    async continue() {
        this.bus.publish('ready');
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
                        <Header as='h2' style={{ marginTop: '1em' }}>WalletLink Pairing</Header>
                        <p>Scan QR code with a WalletLink-compatible wallet</p>
                        {svgPath ? (<svg viewBox="1 1 53 53"><path d={svgPath} /></svg>) : null}
                        <Button onClick={() => window.location.hash = '/'}>Back</Button>
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
                                    <p>SOWA Compatibility: {walletInfo?.compatible ? "Yes": "No"}</p>
                                    <p>SOWA Protocol Version: {walletInfo?.protocolVersion || "UNKNOWN"}</p>
                                    <p>SOWA Engine Version: {walletInfo?.engineVersion || "UNKNOWN"}</p>
                                    <p>Device Manufacturer: {walletInfo?.device?.manufacturer || "UNKNOWN"}</p>
                                    <p>Device Model: {walletInfo?.device?.model || "UNKNOWN"}</p>
                                    <Button onClick={() => this.disconnect()}>Disconnect</Button>
                                    <Button onClick={() => this.continue()}>Continue</Button>
                                </div>
                            ) : (<p>{error}</p>)}
                        </React.Fragment>
                    )}
            </Container>
        );
    }
}
