import * as React from "react";
import * as extension from 'extensionizer';
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { Popup, Segment, List, Label, Input, Checkbox, Icon, Header } from "semantic-ui-react";

import { isValidUrl } from '../helpers';

interface ISettingsProps {
    devMode: boolean;
    updateTabs: () => Promise<void>;
}

interface ISettingsState {
    isLoading: boolean;
    connected: boolean;
    registries: { url: string, isDev: boolean, isAvailable: boolean, error: string }[];
    registryInput: string;
    registryInputError: string;
    devMode: boolean;
}

const OPTIONS = [{
    key: 'https://test.dapplets.org/dapplet-base',
    text: 'https://test.dapplets.org/dapplet-base',
    value: 'https://test.dapplets.org/dapplet-base'
}, {
    key: 'https://localhost:8080/index.json',
    text: 'https://localhost:8080/index.json',
    value: 'https://localhost:8080/index.json'
}];

class Settings extends React.Component<ISettingsProps, ISettingsState> {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            connected: false,
            registries: [],
            registryInput: '',
            registryInputError: null,
            devMode: props.devMode
        };
    }

    async componentDidMount() {
        await Promise.all([this.loadRegistries(), this.loadDevMode()]);
        this.setState({ isLoading: false });
    }

    async loadRegistries() {
        const { getRegistries } = await initBGFunctions(extension);
        const registries = await getRegistries();

        this.setState({
            registries: registries.filter(r => r.isDev === false)
        });
    }

    async loadDevMode() {
        const { getDevMode } = await initBGFunctions(extension);
        const devMode = await getDevMode();
        this.setState({ devMode });
    }

    async setDevMode(isActive: boolean) {
        const { setDevMode } = await initBGFunctions(extension);
        await setDevMode(isActive);
        this.loadDevMode();
        await this.props.updateTabs();
    }

    async addRegistry(url: string) {
        const { addRegistry } = await initBGFunctions(extension);

        try {
            await addRegistry(url, false);
            this.setState({ registryInput: '' });
        } catch (msg) {
            this.setState({ registryInputError: msg });
        }

        this.loadRegistries();
    }

    async removeRegistry(url: string) {
        const { removeRegistry } = await initBGFunctions(extension);
        await removeRegistry(url);
        this.loadRegistries();
    }

    render() {
        const { isLoading, registries, registryInput, registryInputError, devMode } = this.state;

        return (
            <React.Fragment>
                <Segment loading={isLoading} className="internalTabSettings">

                    <Header as='h4'>Public Registries</Header>
                    <Input
                        size='mini'
                        icon='code'
                        iconPosition='left'
                        action={{
                            content: 'Add',
                            size: 'mini',
                            onClick: () => this.addRegistry(registryInput),
                            disabled: !(isValidUrl(registryInput) && !registries.find(r => r.url === registryInput)),
                            color: 'blue'
                        }}
                        fluid
                        placeholder='Public Registry URL...'
                        value={registryInput}
                        onChange={(e) => this.setState({ registryInput: e.target.value, registryInputError: null })}
                        error={!!registryInputError}
                    />

                    {(registryInputError) ? <Label basic color='red' pointing>{registryInputError}</Label> : null}

                    <List divided relaxed size='small'>
                        {registries.map((r, i) => (
                            <List.Item key={i}>
                                <List.Content floated='left'>
                                    <Popup
                                        trigger={<Label size='mini' horizontal color={(r.isAvailable) ? 'green' : 'red'}>{(r.isAvailable) ? 'ONLINE' : (r.error) ? 'ERROR' : 'OFFLINE'}</Label>}
                                        content={r.error || 'Ready'}
                                        size='mini'
                                    />
                                </List.Content>
                                <List.Content floated='right'>
                                    <Icon link color='red' name='close' onClick={() => this.removeRegistry(r.url)} />
                                </List.Content>
                                <List.Content><a style={{color:'#000'}} onClick={() => window.open(r.url, '_blank')}>{r.url}</a></List.Content>
                            </List.Item>
                        ))}
                    </List>

                    <Header as='h4'>Storages</Header>
                    <Input
                        size='mini'
                        icon='code'
                        iconPosition='left'
                        action={{
                            content: 'Add',
                            size: 'mini',
                            onClick: () => this.addRegistry(registryInput),
                            disabled: !(isValidUrl(registryInput) && !registries.find(r => r.url === registryInput)),
                            color: 'blue'
                        }}
                        fluid
                        placeholder='Storage address'
                        value={registryInput}
                        onChange={(e) => this.setState({ registryInput: e.target.value, registryInputError: null })}
                        error={!!registryInputError}
                    />

                    {(registryInputError) ? <Label basic color='red' pointing>{registryInputError}</Label> : null}

                    <List divided relaxed size='small'>
                        {registries.map((r, i) => (
                            <List.Item key={i}>
                                <List.Content floated='left'>
                                    <Popup
                                        trigger={<Label size='mini' horizontal color={(r.isAvailable) ? 'green' : 'red'}>{(r.isAvailable) ? 'ONLINE' : (r.error) ? 'ERROR' : 'OFFLINE'}</Label>}
                                        content={r.error || 'Ready'}
                                        size='mini'
                                    />
                                </List.Content>
                                <List.Content floated='right'>
                                    <Icon link color='red' name='close' onClick={() => this.removeRegistry(r.url)} />
                                </List.Content>
                                <List.Content><a style={{color:'#000'}} onClick={() => window.open(r.url, '_blank')}>{r.url}</a></List.Content>
                            </List.Item>
                        ))}
                    </List>

                    <Header as='h4'>Advanced</Header>
                    <Checkbox toggle label='Development Mode' checked={devMode} onChange={() => this.setDevMode(!devMode)} />
                </Segment>

            </React.Fragment>
        );
    }
}

export default Settings;
