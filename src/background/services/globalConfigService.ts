import GlobalConfigBrowserStorage from '../browserStorages/globalConfigBrowserStorage';
import { GlobalConfig } from '../models/globalConfig';
import { typeOfUri, UriTypes } from '../../common/helpers';
import { WalletConnectSigner } from '../utils/walletConnectSigner';
import { SwarmModuleStorage } from '../moduleStorages/swarmModuleStorage';

export default class GlobalConfigService {
    private _globalConfigRepository = new GlobalConfigBrowserStorage();
    private _configId: string = 'default';

    async get(): Promise<GlobalConfig> {
        let config = await this._globalConfigRepository.getById(this._configId);
        if (!config) await this.resetConfig();
        config = await this._globalConfigRepository.getById(this._configId);

        return config;
    }

    async set(config: GlobalConfig): Promise<void> {
        await this._globalConfigRepository.update(config);
    }

    async resetConfig(): Promise<void> {
        const config = new GlobalConfig();
        config.id = this._configId;
        config.registries = [{
            url: "0x26530612DA7281FacEdcEd7648ad0C159Dfb370d",
            isDev: false
        }];
        config.devMode = false;
        config.trustedUsers = [{
            account: "0x692a4d7b7be2dc1623155e90b197a82d114a74f3"
        }];
        config.userSettings = {};

        await this._globalConfigRepository.deleteById(this._configId);
        await this._globalConfigRepository.create(config);
    }

    async getRegistries() {
        const config = await this.get();
        return config.registries;
    }

    async addRegistry(url: string, isDev: boolean) {
        const config = await this.get();
        if (config.registries.find(r => r.url === url)) return;

        const isEthAddress = typeOfUri(url) === UriTypes.Ethereum;
        const isEnsAddress = typeOfUri(url) === UriTypes.Ens;

        if (isEthAddress || isEnsAddress) {
            if (isEnsAddress) {
                const signer = new WalletConnectSigner();
                const address = await signer.resolveName(url);
                if (!address) throw new Error("Can not resolve the ENS name");
            }

            config.registries.push({ url, isDev });
            await this.set(config);
        } else {
            const response = await fetch(url);
            if (response.ok || !isDev) { // ToDo: check prod registry correctly
                config.registries.push({ url, isDev });
                await this.set(config);
            } else {
                throw Error('The registry is not available.');
            }
        }
    }

    async removeRegistry(url: string) {
        this.updateConfig(c => c.registries = c.registries.filter(r => r.url !== url));
    }

    async getIntro() {
        const config = await this.get();
        return config.intro;
    }

    async setIntro(intro: any) {
        this.updateConfig(c => Object.entries(intro).forEach(([key, value]) => c.intro[key] = value));
    }

    async getDevMode() {
        const config = await this.get();
        return config.devMode;
    }

    async setDevMode(isActive: boolean) {
        this.updateConfig(c => c.devMode = isActive);
    }

    async updateConfig(callback: (config: GlobalConfig) => void) {
        const config = await this.get();
        callback(config);
        await this.set(config);
    }

    async getTrustedUsers() {
        const config = await this.get();
        return config.trustedUsers;
    }

    async addTrustedUser(account: string) {
        const config = await this.get();
        if (config.trustedUsers.find(r => r.account === account)) return;

        const isEthAddress = typeOfUri(account) === UriTypes.Ethereum;
        const isEnsAddress = typeOfUri(account) === UriTypes.Ens;

        if (isEthAddress || isEnsAddress) {
            if (isEnsAddress) {
                const signer = new WalletConnectSigner();
                const address = await signer.resolveName(account);
                if (!address) throw new Error("Can not resolve the ENS name");
            }

            config.trustedUsers.push({ account: account });
            await this.set(config);
        } else {
            throw Error('User account must be valid Ethereum address');
        }
    }

    async removeTrustedUser(account: string) {
        this.updateConfig(c => c.trustedUsers = c.trustedUsers.filter(r => r.account !== account));
    }

    async getUserSettings(moduleName: string, key: string) {
        const config = await this.get();
        if (!config.userSettings[moduleName]) return undefined;
        return config.userSettings[moduleName][key];
    }

    async setUserSettings(moduleName: string, key: string, value: any) {
        const config = await this.get();
        if (!config.userSettings[moduleName]) config.userSettings[moduleName] = {};
        config.userSettings[moduleName][key] = value;
        await this.set(config);
    }

    async removeUserSettings(moduleName: string, key: string) {
        const config = await this.get();
        if (!config.userSettings[moduleName]) return;
        delete config.userSettings[moduleName][key];
        await this.set(config);
    }

    async clearUserSettings(moduleName: string) {
        const config = await this.get();
        if (!config.userSettings[moduleName]) return;
        delete config.userSettings[moduleName];
        await this.set(config);
    }

    async loadUserSettings(url: string) {
        const swarmStorage = new SwarmModuleStorage();
        const data = await swarmStorage.getResource(url);
        const json = new TextDecoder("utf-8").decode(new Uint8Array(data));
        const config = JSON.parse(json);
        await this.set(config);
    }

    async saveUserSettings() {
        const config = await this.get();
        const json = JSON.stringify(config);
        const blob = new Blob([json], { type: "application/json" });
        const swarmStorage = new SwarmModuleStorage();
        const url = await swarmStorage.save(blob);
        return url;
    }
}