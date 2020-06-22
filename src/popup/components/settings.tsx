import * as React from "react";
import * as extension from 'extensionizer';
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { Popup, Segment, List, Label, Input, Checkbox, Icon, Header, Button } from "semantic-ui-react";

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
    trustedUsers: { account: string }[];
    trustedUserInput: string;
    trustedUserInputError: string;
    userSettingsInput: string;
    userSettingsInputError: string;
    userSettingsLoading: boolean;
    devMode: boolean;
}

class Settings extends React.Component<ISettingsProps, ISettingsState> {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            connected: false,
            registries: [],
            registryInput: '',
            registryInputError: null,
            trustedUsers: [],
            trustedUserInput: '',
            trustedUserInputError: null,
            devMode: props.devMode,
            userSettingsInput: '',
            userSettingsInputError: null,
            userSettingsLoading: false
        };
    }

    async componentDidMount() {
        await Promise.all([this.loadRegistries(), this.loadDevMode(), this.loadTrustedUsers()]);
        this.setState({ isLoading: false });
    }

    async loadRegistries() {
        const { getRegistries } = await initBGFunctions(extension);
        const registries = await getRegistries();

        this.setState({
            registries: registries.filter(r => r.isDev === false)
        });
    }

    async loadTrustedUsers() {
        const { getTrustedUsers } = await initBGFunctions(extension);
        const trustedUsers = await getTrustedUsers();
        this.setState({ trustedUsers });
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

    async addTrustedUser(account: string) {
        const { addTrustedUser } = await initBGFunctions(extension);

        try {
            await addTrustedUser(account);
            this.setState({ trustedUserInput: '' });
        } catch (msg) {
            this.setState({ trustedUserInputError: msg });
        }

        this.loadTrustedUsers();
    }

    async removeTrustedUser(account: string) {
        const { removeTrustedUser } = await initBGFunctions(extension);
        await removeTrustedUser(account);
        this.loadTrustedUsers();
    }

    async loadUserSettings() {
        this.setState({ userSettingsLoading: true });
        const { loadUserSettings } = await initBGFunctions(extension);

        try {
            await loadUserSettings(this.state.userSettingsInput);
            this.setState({ userSettingsInput: '' });
            location.reload();
        } catch (msg) {
            this.setState({ userSettingsInputError: msg });
        } finally {
            this.setState({ userSettingsLoading: false });
        }
    }

    async saveUserSettings() {
        this.setState({ userSettingsLoading: true });
        const { saveUserSettings } = await initBGFunctions(extension);

        try {
            const url = await saveUserSettings();
            this.setState({ userSettingsInput: url });
        } catch (msg) {
            this.setState({ userSettingsInputError: msg });
        } finally {
            this.setState({ userSettingsLoading: false });
        }
    }

    render() {
        const { isLoading, registries, registryInput, registryInputError, trustedUsers, trustedUserInput, trustedUserInputError, devMode } = this.state;

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
                        placeholder='ENS or 0x address...'
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
                                <List.Content><a style={{ color: '#000', lineHeight: '1.4em' }} onClick={() => window.open(`https://rinkeby.etherscan.io/address/${r.url}`, '_blank')}>{r.url}</a></List.Content>
                            </List.Item>
                        ))}
                    </List>


                    <Header as='h4'>Trusted Users</Header>
                    <Input
                        size='mini'
                        icon='ethereum'
                        iconPosition='left'
                        action={{
                            content: 'Add',
                            size: 'mini',
                            onClick: () => this.addTrustedUser(trustedUserInput),
                            disabled: !(isValidUrl(trustedUserInput) && !registries.find(r => r.url === trustedUserInput)),
                            color: 'blue'
                        }}
                        fluid
                        placeholder='ENS or 0x address...'
                        value={trustedUserInput}
                        onChange={(e) => this.setState({ trustedUserInput: e.target.value, trustedUserInputError: null })}
                        error={!!trustedUserInputError}
                    />

                    {(trustedUserInputError) ? <Label basic color='red' pointing>{trustedUserInputError}</Label> : null}

                    <List divided relaxed size='small'>
                        {trustedUsers.map((user, i) => (
                            <List.Item key={i}>
                                <List.Content floated='right'>
                                    <Icon link color='red' name='close' onClick={() => this.removeTrustedUser(user.account)} />
                                </List.Content>
                                <List.Content><a style={{ color: '#000', lineHeight: '1.4em' }} onClick={() => window.open(`https://rinkeby.etherscan.io/address/${user.account}`, '_blank')}>{user.account}</a></List.Content>
                            </List.Item>
                        ))}
                    </List>

                    <Header as='h5'>User Settings</Header>
                    <Input
                        size='mini'
                        fluid
                        placeholder='Swarm Address...'
                        error={!!this.state.userSettingsInputError}
                        action
                        iconPosition='left'
                        loading={this.state.userSettingsLoading}
                    >
                        <Icon name='cog'></Icon>
                        <input
                            value={this.state.userSettingsInput}
                            onChange={(e) => this.setState({ userSettingsInput: e.target.value, userSettingsInputError: null })}
                        />
                        <Button.Group size='mini'>
                            <Button disabled={this.state.userSettingsLoading} onClick={() => this.loadUserSettings()}>Load</Button>
                            <Button disabled={this.state.userSettingsLoading} color='blue' onClick={() => this.saveUserSettings()}>Save</Button>
                        </Button.Group>
                    </Input>

                    <Header as='h4'>Advanced</Header>
                    <Checkbox toggle label='Development Mode' checked={devMode} onChange={() => this.setDevMode(!devMode)} />

                    <Header as='h4'>About</Header>
                    <div>
                        <a href='#' onClick={() => window.open(`https://github.com/dapplets/dapplet-extension/releases/tag/v${EXTENSION_VERSION}`, '_blank')}>v{EXTENSION_VERSION}</a>
                    </div>
                </Segment>

            </React.Fragment>
        );
    }
}

export default Settings;
