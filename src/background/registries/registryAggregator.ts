import { gt, compare } from 'semver';
import { Registry } from './registry';
import { DevRegistry } from './devRegistry';
import { TestRegistry } from './testRegistry';
import { EthRegistry } from './ethRegistry';
import GlobalConfigService from '../services/globalConfigService';
import { mergeDedupe, typeOfUri, UriTypes } from '../../common/helpers';

export class RegistryAggregator {
    public isAvailable: boolean = true;
    public registries: Registry[] = [];

    async getVersions(name: string, branch: string): Promise<string[]> {
        await this._initRegistries();

        const versionsWithErrors = await Promise.all(this.registries.map(r => r.getVersions(name, branch).catch(Error)));
        const versionsNoErrors = versionsWithErrors.filter(x => !(x instanceof Error)) as string[][];
        const versionsNotSorted = mergeDedupe(versionsNoErrors);
        const versionsAsc = versionsNotSorted.sort(compare); // ASC sorting by semver

        return versionsAsc;
    }

    async resolveToUri(name: string, branch: string, version: string): Promise<string[]> {
        await this._initRegistries();

        const uriWithErrors = await Promise.all(this.registries.map(r => r.resolveToUri(name, branch, version).catch(Error)));
        const uriNoErrors = uriWithErrors.filter(x => !(x instanceof Error)) as string[][];
        const uris = mergeDedupe(uriNoErrors);

        return uris;
    }

    async getFeatures(hostnames: string[]): Promise<{ [hostname: string]: { [name: string]: string[]; } }> {
        await this._initRegistries();
        const regFeatures = await Promise.all(this.registries.map(r => r.getFeatures(hostnames).catch(Error)));
        const validRegFeatures = regFeatures.filter(result => !(result instanceof Error));
        const merge: { [hostname: string]: { [name: string]: string[]; } } = {};

        // Deep merging of regFeatures
        for (const f of validRegFeatures) {
            for (const hostname in f) {
                if (!merge[hostname]) merge[hostname] = {};
                for (const name in f[hostname]) {
                    if (!merge[hostname][name]) merge[hostname][name] = [];
                    for (const branch of f[hostname][name]) {
                        merge[hostname][name].push(branch);
                    }
                }
            }
        }

        return merge;
    }


    async getFeaturesWithRegistries(hostnames: string[]): Promise<{ [registryUrl: string]: { [hostname: string]: { [name: string]: string[]; } } }> {
        await this._initRegistries();
        const regFeatures = await Promise.all(this.registries.map(r => r.getFeatures(hostnames).then(f => ({ [r.url]: f })).catch(Error)));
        const validRegFeatures = regFeatures.filter(result => !(result instanceof Error));
        const merge: { [registryUrl: string]: { [hostname: string]: { [name: string]: string[]; } } } = {};

        // Deep merging of regFeatures
        for (const f of validRegFeatures) {
            for (const registryUrl in f) {
                if (!merge[registryUrl]) merge[registryUrl] = {};
                for (const hostname in f[registryUrl]) {
                    if (!merge[registryUrl][hostname]) merge[registryUrl][hostname] = {};
                    for (const name in f[registryUrl][hostname]) {
                        if (!merge[registryUrl][hostname][name]) merge[registryUrl][hostname][name] = [];
                        for (const branch of f[registryUrl][hostname][name]) {
                            merge[registryUrl][hostname][name].push(branch);
                        }
                    }
                }
            }
        }

        return merge;
    }

    public async getAllDevModules(): Promise<{ name: string, branch: string, version: string }[]> {
        await this._initRegistries();
        const modules = await Promise.all(this.registries.map(r => r.getAllDevModules().catch((e) => e)));
        const validModules = modules.filter(result => !(result instanceof Error));
        if (!validModules || validModules.length === 0) return [];
        const reduced = validModules.reduce((a, b) => a.concat(b));
        return reduced;
    }

    private async _initRegistries() {
        const globalConfigService = new GlobalConfigService();

        // ToDo: fetch LocalConfig
        const registries = await globalConfigService.getRegistries();

        // ToDo: optimize comparison
        if (registries.length !== this.registries.length) {
            // ToDo: Dev registries are priority
            this.registries = registries.sort((a, b) => (a.isDev === false) ? 1 : -1)
                .map(r => {
                    const uriType = typeOfUri(r.url);

                    if (uriType === UriTypes.Http && r.isDev) return new DevRegistry(r.url);
                    if (uriType === UriTypes.Http && !r.isDev) return new TestRegistry(r.url);
                    if (uriType === UriTypes.Ethereum) return new EthRegistry(r.url);
                });
        }
    }

    public getRegistryByUri(uri: string): Registry {
        return this.registries.find(f => f.url === uri);
    } 
}