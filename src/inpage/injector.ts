import { initBGFunctions } from "chrome-extension-message-wrapper";
import Core from './core';
import { maxSatisfying, valid } from 'semver';
import { SubscribeOptions } from './overlay';
import { ModuleTypes, DEFAULT_BRANCH_NAME } from '../common/constants';
import * as extension from 'extensionizer';
import { IResolver, IContentAdapter, IFeature } from './types';
import { areModulesEqual } from "../common/helpers";
import VersionInfo from "../background/models/versionInfo";

export class Injector {
    public availableContextIds: string[] = [];

    private registry: {
        manifest: VersionInfo,
        clazz: any,
        instance?: any,
        order: number,
        contextIds: string[],
        adapters: IContentAdapter[];
    }[] = [];

    constructor(public core: Core) {
        this._setContextActivivty([window.location.hostname], undefined, true);
        window.exports = {}; // for CommonJS modules compatibility
    }

    public async loadModules(modules: { name: string, branch: string, version: string, order: number, contextIds: string[] }[]) {
        if (!modules || !modules.length) return;
        const { getModulesWithDeps } = await initBGFunctions(extension);
        const loadedModules: { manifest: VersionInfo, script: string }[] = await getModulesWithDeps(modules);
        const orderedModules = loadedModules.map((l) => {
            const m = modules.find(m => areModulesEqual(m, l.manifest));
            return ({
                ...l,
                order: m?.order,
                contextIds: m?.contextIds || [window.location.hostname]
            })
        });

        await this._processModules(orderedModules);

        // module initialization
        for (let i = 0; i < this.registry.length; i++) {
            if (this.registry[i].instance) continue;
            this.registry[i].instance = new this.registry[i].clazz();
            const m = this.registry[i];
            console.log(`The module ${m.manifest.name}#${m.manifest.branch}@${m.manifest.version} was loaded.`);
        }

        // feature attaching
        for (let i = 0; i < this.registry.length; i++) {
            const isFeature = this.registry[i].manifest.type === ModuleTypes.Feature;
            const isNeedToActivate = !!modules.find(m => areModulesEqual(m, this.registry[i].manifest));

            if (isFeature && isNeedToActivate) {
                const featureModule = this.registry[i];
                const featureInstance: IFeature = featureModule.instance;
                featureInstance.orderIndex = featureModule.order;
                // ToDo: fix context ids adding
                featureInstance.contextIds = featureModule.contextIds.map(id => {
                    const [headContextId, ...tailContextId] = id.split('/'); // ToDo: check head?
                    return tailContextId.join('/');
                }).filter(id => !!id);
                featureModule.adapters.forEach(a => a.attachFeature(featureInstance));
            }
        }
    }

    public async unloadModules(modules: { name: string, branch: string, version: string }[]) {
        modules.map(m => this.registry.find(r => areModulesEqual(m, r.manifest))).forEach(m => {
            if (!m) return;
            m.adapters.forEach(a => a.detachFeature(m.instance));
            console.log(`The module ${m.manifest.name}#${m.manifest.branch}@${m.manifest.version} was unloaded.`);
            this.registry = this.registry.filter(r => r !== m);
        });
    }

    private async _processModules(modules: { manifest: VersionInfo, script: string, order: number, contextIds: string[] }[]) {
        const { optimizeDependency, getModulesWithDeps, addEvent } = await initBGFunctions(extension);
        const { core } = this;

        for (const md of modules) {
            // Module is loaded already
            const registeredModule = this.registry.find(m => areModulesEqual(m.manifest, md.manifest));
            if (registeredModule) {
                if (md.contextIds) {
                    if (registeredModule.contextIds) {
                        registeredModule.contextIds.push(...md.contextIds);
                    } else {
                        registeredModule.contextIds = [...md.contextIds];
                    }
                }
                continue;
            }

            // ToDo: elemenate the boilerplate
            const coreWrapper = {
                overlayManager: core.overlayManager,
                waitPairingOverlay: core.waitPairingOverlay,
                contextStarted: (contextIds: any[], parentContext: string) => this._setContextActivivty(contextIds, window.location.hostname + (parentContext ? `/${parentContext}` : ""), true),
                contextFinished: (contextIds: any[], parentContext: string) => this._setContextActivivty(contextIds, window.location.hostname + (parentContext ? `/${parentContext}` : ""), false),
                connect: core.connect.bind(core),
                overlay: core.overlay.bind(core),
                wallet: core.wallet.bind(core)
            };

            const execScript = new Function('Core', 'SubscribeOptions', 'Inject', 'Injectable', md.script);
            let newBranch: string = null;

            // ToDo: describe it
            const injectableDecorator = (constructor) => {
                if (constructor.prototype.getBranch) {
                    const resolver: IResolver = new constructor();
                    newBranch = resolver.getBranch();
                } else if (!this.registry.find(m => areModulesEqual(m.manifest, md.manifest))) {
                    this.registry.push({
                        manifest: md.manifest,
                        clazz: constructor,
                        instance: null,
                        order: md.order,
                        contextIds: md.contextIds,
                        adapters: []
                    });
                }
            };

            // ToDo: describe it
            const injectDecorator = (name: string) => (target, propertyKey: string, descriptor: PropertyDescriptor) => {
                descriptor = descriptor || {};
                descriptor.get = () => {
                    const dependency = md.manifest.dependencies[name];

                    if (dependency === undefined) {
                        console.error(`Module "${name}" doesn't exist in the manifest of "${md.manifest.name}"`);
                        return null;
                    }

                    if (valid(dependency as string) === null) {
                        console.error(`Invalid semver version (${dependency}) of module "${name}" in the manifest of "${md.manifest.name}"`);
                        return null;
                    }

                    // if the module can not be found by the name, then trying to find its implementation by interface name
                    let modules = this.registry.filter(m => m.manifest.name == name);
                    if (modules.length === 0) {
                        modules = this.registry.filter(m => m.manifest.interfaces?.[name] !== undefined);
                        if (modules.length === 0) {
                            console.error(`Can not find neither the module, nor an implementation of the interface "${name}".`);
                            return null;
                        }
                    }

                    // ToDo: Should be moved to the background? 
                    // ToDo: Fetch prefix from global settings.
                    // ToDo: Replace '>=' to '^'
                    const prefix = '>='; // https://devhints.io/semver
                    const range = prefix + (typeof dependency === "string" ? dependency : dependency[DEFAULT_BRANCH_NAME]);
                    const maxVer = maxSatisfying(modules.map(m => m.manifest.version), range);

                    const module = modules.find(m => m.manifest.version == maxVer);
                    if (md.manifest.type === ModuleTypes.Feature && module.manifest.type === ModuleTypes.Adapter) {
                        const featureModule = this.registry.find(m => areModulesEqual(m.manifest, md.manifest));
                        if (!featureModule.adapters) featureModule.adapters = [];
                        featureModule.adapters.push(module.instance);
                    }
                    return module.instance;
                }
                return descriptor;
            };

            execScript(coreWrapper, SubscribeOptions, injectDecorator, injectableDecorator);

            if (newBranch) {
                addEvent('Branch resolving', `Resolver of "${md.manifest.name}" defined the "${newBranch}" branch`);
                const optimizedBranch = await optimizeDependency(md.manifest.name, newBranch, md.manifest.version, md.contextIds);
                const missingDependencies = await getModulesWithDeps([{...optimizedBranch, contextIds: md.contextIds }]);
                await this._processModules(missingDependencies);
            }
        }
    }

    private async _setContextActivivty(contextIds: any[], parentContext: string, isActive: boolean) {
        contextIds = parentContext ? contextIds.map(({ id }) => parentContext + '/' + id) : contextIds;

        if (isActive) {
            contextIds.forEach(id => {
                if (this.availableContextIds.indexOf(id) === -1) {
                    this.availableContextIds.push(id);
                }
            });
        } else {
            contextIds.forEach(id => {
                const index = this.availableContextIds.indexOf(id);
                if (index > -1) this.availableContextIds.splice(index, 1);
            });
        }

        extension.runtime.sendMessage({
            type: isActive ? "CONTEXT_STARTED" : "CONTEXT_FINISHED",
            payload: { contextIds }
        });
    }
}