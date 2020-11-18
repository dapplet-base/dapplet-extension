import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";

import { Container, Header, Button, Image } from 'semantic-ui-react'
import WalletConnectLogo from '../resources/walletconnect.svg';
import WalletLinkLogo from '../resources/walletlink.png';

interface IProps {
}

interface IState {

}

export class SelectWallet extends React.Component<IProps, IState> {

    render() {
        return (
            <Container text>
                <Header as='h2' style={{ marginTop: '1em' }}>Connect a Wallet</Header>
                <p>Get started by connecting one of the wallets bellow</p>

                <div>
                    <Button fluid basic size='big' style={{ marginBottom: '0.5em' }} onClick={() => window.location.hash = '/walletconnect'}>
                        <Image src={WalletConnectLogo} avatar /><span>WalletConnect</span>
                    </Button>

                    <Button fluid basic size='big' style={{ marginBottom: '0.5em' }} onClick={() => window.location.hash = '/walletconnect'}>
                        <Image src={WalletLinkLogo} avatar /><span>Coinbase Wallet</span>
                    </Button>
                </div>
            </Container>
        );
    }
}