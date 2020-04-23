import CID from 'cids';
import { Registry } from './registry';

export class TestRegistry implements Registry {
    public isAvailable: boolean = true;
    public error: string = null;

    constructor(public url: string) {
        // example: https://test.dapplets.org/api/registry/dapplet-base
        if (!url) throw new Error("Endpoint Url is required");
    }

    public async getVersions(name: string, branch: string): Promise<string[]> {
        try {
            const response = await fetch(`${this.url}/registry/get-versions?name=${name}&branch=${branch}`);
            if (!response.ok) throw Error(response.statusText);
            const json = await response.json();
            const versions = json.data;
            this.isAvailable = true;
            this.error = null;
            return versions;
        } catch (err) {
            this.isAvailable = false;
            this.error = err.message;
            throw err;
        }
    }

    public async resolveToUri(name: string, branch: string, version: string): Promise<CID[]> {
        try {
            const response = await fetch(`${this.url}/registry/resolve-to-uri?name=${name}&branch=${branch}&version=${version}`);
            if (!response.ok) throw Error(response.statusText);
            const json = await response.json();
            const rawCids = json.data;
            this.isAvailable = true;
            this.error = null;
            return rawCids.map(rawCid => new CID(rawCid));
        } catch (err) {
            this.isAvailable = false;
            this.error = err.message;
            throw err;
        }
    }

    public async getFeatures(hostnames: string[]): Promise<{ [hostname: string]: { [name: string]: string[]; } }> {
        try {
            const response = await fetch(`${this.url}/registry/get-features?${hostnames.map(h => `hostname=${h}`).join('&')}`);
            if (!response.ok) throw Error(response.statusText);
            const json = await response.json();
            const features = json.data;
            this.isAvailable = true;
            this.error = null;
            return features;
        } catch (err) {
            this.isAvailable = false;
            this.error = err.message;
            throw err;
        }
    }

    public async getAllDevModules(): Promise<{ name: string, branch: string, version: string }[]> {
        return Promise.resolve([]);
    }

    // ToDo: remove key parameter
    public async addModule(name: string, branch: string, version: string, cid: CID, key: string): Promise<void> {
        const response = await fetch(`${this.url}/registry/add-module?uri=${encodeURIComponent(cid.toString())}&key=${key}`, {
            method: 'POST'
        });

        const json = await response.json();
        if (!json.success) throw new Error(json.message || "Error in addModuleToRegistry");
    }
}