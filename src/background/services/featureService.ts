import ManifestDTO from '../dto/manifestDTO';
import SiteConfigBrowserStorage from '../browserStorages/siteConfigBrowserStorage';
import ModuleManager from '../utils/moduleManager';
import * as extension from 'extensionizer';
import Manifest from '../models/manifest';
import { StorageAggregator } from '../moduleStorages/moduleStorage';
import GlobalConfigService from './globalConfigService';
import { areModulesEqual, typeOfUri, UriTypes } from '../../common/helpers';
import * as ethers from 'ethers';
import { StorageRef } from '../registries/registry';
import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { rcompare } from 'semver';

export default class FeatureService {
    private _siteConfigRepository = new SiteConfigBrowserStorage();
    private _globalConfigService = new GlobalConfigService();
    private _moduleManager = new ModuleManager();
    private _storageAggregator = new StorageAggregator();

    async getFeaturesByHostnames(contextIds: string[]): Promise<ManifestDTO[]> {
        const users = await this._globalConfigService.getTrustedUsers();
        const contextIdsByRegsitries = await this._moduleManager.registryAggregator.getModuleInfoWithRegistries(contextIds, users.map(u => u.account));
        const dtos: ManifestDTO[] = [];

        const configRegistries = await this._globalConfigService.getRegistries();

        let i = 0;

        for (const [registryUrl, moduleInfosByContextId] of Object.entries(contextIdsByRegsitries)) {
            for (const [contextId, moduleInfos] of Object.entries(moduleInfosByContextId)) {
                for (const moduleInfo of moduleInfos) {
                    const dto = dtos.find(d => d.name === moduleInfo.name);
                    if (!dto) {
                        const dto: ManifestDTO = moduleInfo as any;
                        const config = await this._siteConfigRepository.getById(contextId); // ToDo: which contextId should we compare?
                        dto.isActive = config.activeFeatures[dto.name]?.isActive || false;
                        dto.order = i++;
                        dto.sourceRegistry = {
                            url: registryUrl,
                            isDev: configRegistries.find(r => r.url === registryUrl).isDev
                        };
                        if (!dto.hostnames) dto.hostnames = [];
                        dto.hostnames.push(contextId);
                        dtos.push(dto);
                    } else {
                        // ToDo: move this merging logic to aggragator
                        if (!dto.hostnames) dto.hostnames = [];
                        dto.hostnames.push(contextId);
                    }
                }
            }
        }

        return dtos;
    }

    private async _setFeatureActive(name: string, version: string | undefined, hostnames: string[], isActive: boolean, order: number, registryUrl: string) {

        if (!version && isActive) {
            const registry = this._moduleManager.registryAggregator.getRegistryByUri(registryUrl);
            if (!registry) throw new Error("No registry with this url exists in config.");
            const versions = await registry.getVersionNumbers(name, DEFAULT_BRANCH_NAME);
            if (versions.length === 0) throw new Error("This module has no versions.");
            version = versions.sort(rcompare)[0]; // Last version by SemVer
        }

        // ToDo: save registry url of activate module?
        for (const hostname of hostnames) {
            const config = await this._siteConfigRepository.getById(hostname);
            if (!isActive) version = config.activeFeatures[name].version;
            config.activeFeatures[name] = {
                version,
                isActive,
                order
            };

            await this._siteConfigRepository.update(config);

            extension.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                var activeTab = tabs[0];
                extension.tabs.sendMessage(activeTab.id, {
                    type: isActive ? "FEATURE_ACTIVATED" : "FEATURE_DEACTIVATED",
                    payload: [{
                        name,
                        version,
                        branch: DEFAULT_BRANCH_NAME, // ToDo: fix branch
                        order,
                        contextIds: hostnames
                    }]
                });
            });
        }
    }

    async activateFeature(name: string, version: string | undefined, hostnames: string[], order: number, registryUrl: string): Promise<void> {
        return await this._setFeatureActive(name, version, hostnames, true, order, registryUrl);
    }

    async deactivateFeature(name: string, version: string | undefined, hostnames: string[], order: number, registryUrl: string): Promise<void> {
        return await this._setFeatureActive(name, version, hostnames, false, order, registryUrl);
    }

    public async getActiveModulesByHostnames(hostnames: string[]) {
        const configs = await Promise.all(hostnames.map(h => this._siteConfigRepository.getById(h)));
        const modules: { name: string, branch: string, version: string, order: number, hostnames: string[] }[] = [];

        let i = 0;
        for (const config of configs) {
            for (const name in config.activeFeatures) {
                if (config.activeFeatures[name].isActive !== true) continue;

                const branch = 'default';
                const version = config.activeFeatures[name].version;
                const index = modules.findIndex(m => m.name === name && m.branch === branch && m.version === version);

                if (index !== -1) {
                    modules[index].hostnames.push(config.hostname);
                } else {
                    modules.push({
                        name,
                        branch, // ToDo: is it correct?
                        version,
                        order: i++,
                        hostnames: [config.hostname]
                    });
                }
            }
        }

        return modules;
    }

    public async getModulesWithDeps(modules: { name: string, branch: string, version: string }[]) {
        if (modules.length === 0) return [];
        const modulesWithDeps = await this._moduleManager.resolveDependencies(modules);
        const loadedModules = await Promise.all(modulesWithDeps.map(m =>
            this._moduleManager.loadScript(m.manifest.dist)
                .then(s => ({ script: s, manifest: m.manifest }))
        ));
        return loadedModules;
    }

    public async optimizeDependency(name: string, branch: string, version: string) {
        // ToDo: fix this hack
        return await this._moduleManager.optimizeDependency(name, version, branch);
    };

    public async getAllDevModules() {
        return await this._moduleManager.getAllDevModules();
    }

    // ToDo: move to another service?
    public async deployModule(defaultManifest: Manifest, targetStorage: 'swarm' | 'test-registry', targetRegistry: string, registryKey: string): Promise<{ scriptUrl: string }> {
        try {
            // ToDo: check everething before publishing

            // Dist file publishing
            const dist = await this._storageAggregator.getResource(defaultManifest.dist as StorageRef);
            const distBlob = new Blob([dist], { type: "text/javascript" });
            const distUrl = (targetStorage === 'test-registry') ? await saveToTestRegistry(distBlob, targetRegistry) : await saveToSwarm(distBlob);

            // Dist file  hashing
            const distBuffer = await (distBlob as any).arrayBuffer();
            const distHash = ethers.utils.keccak256(new Uint8Array(distBuffer));

            // Manifest editing
            defaultManifest.dist = {
                hash: distHash,
                uris: [distUrl]
            };

            if (defaultManifest.icon) {
                // Icon file publishing
                const icon = await this._storageAggregator.getResource(defaultManifest.dist as StorageRef);
                const iconBlob = new Blob([icon], { type: "text/javascript" });
                const iconUrl = (targetStorage === 'test-registry') ? await saveToTestRegistry(iconBlob, targetRegistry) : await saveToSwarm(iconBlob);

                // Icon file  hashing
                const iconBuffer = await (iconBlob as any).arrayBuffer();
                const iconHash = ethers.utils.keccak256(new Uint8Array(iconBuffer));

                // Manifest editing
                defaultManifest.icon = {
                    hash: iconHash,
                    uris: [iconUrl]
                };
            }

            // Register manifest in Registry
            const registry = this._moduleManager.registryAggregator.getRegistryByUri(targetRegistry);
            if (!registry) throw new Error("No registry with this url exists in config.");
            await registry.addModule(defaultManifest.name, defaultManifest.branch, defaultManifest.version, defaultManifest);

            return {
                scriptUrl: distUrl
            };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getRegistries() {
        const configRegistries = await this._globalConfigService.getRegistries();
        const result = configRegistries.map(c => {
            const reg = this._moduleManager.registryAggregator.getRegistryByUri(c.url);
            return {
                isAvailable: reg?.isAvailable || false,
                error: reg?.error,
                ...c
            }
        });

        return result;
    }

    public async getOwnership(registryUri: string, moduleName: string) {
        const registry = this._moduleManager.registryAggregator.getRegistryByUri(registryUri);
        const owner = await registry.getOwnership(moduleName);
        return owner;
    }

    public async transferOwnership(registryUri: string, moduleName: string, address: string) {
        const registry = this._moduleManager.registryAggregator.getRegistryByUri(registryUri);
        await registry.transferOwnership(moduleName, address);
    }

    public async addLocation(registryUri: string, moduleName: string, location: string) {
        const registry = this._moduleManager.registryAggregator.getRegistryByUri(registryUri);
        await registry.addLocation(moduleName, location);
    }

    public async removeLocation(registryUri: string, moduleName: string, location: string) {
        const registry = this._moduleManager.registryAggregator.getRegistryByUri(registryUri);
        await registry.removeLocation(moduleName, location);
    }
}

async function saveToTestRegistry(blob: Blob, registryUrl: string) {
    var form = new FormData();
    form.append('file', blob);

    const response = await fetch(`${registryUrl}/storage`, {
        method: 'POST',
        body: form
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.message || "Error in saveToStorage");
    const url = `${registryUrl}/storage/${json.data}`;
    return url;
}

async function saveToSwarm(blob: Blob) {
    const response = await fetch("https://swarm-gateways.net/bzz:/", {
        method: 'POST',
        body: blob
    });

    const text = await response.text();
    if (text.length !== 64) throw new Error("Swarm gateway returned invalid hash.");
    const url = "bzz://" + text;
    return url;
}