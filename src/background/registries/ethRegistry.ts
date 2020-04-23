import { Registry } from './registry';
import abi from './ethRegistryAbi';
import * as ethers from "ethers";
import CID from 'cids';
import { WalletConnectSigner } from '../utils/walletConnectSigner';

export class EthRegistry implements Registry {
    public isAvailable: boolean = true;
    public error: string = null;

    private _contract: any = null;

    constructor(public url: string) { // url is a contract address
        // example: https://test.dapplets.org/api/registry/dapplet-base
        if (!url) throw new Error("Endpoint Url is required");

        const signer = new WalletConnectSigner();
        this._contract = new ethers.Contract(url, abi, signer);
    }

    public async getVersions(name: string, branch: string): Promise<string[]> {
        try {
            const versions = await this._contract.getVersions(name, branch);
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
            const rawCids = await this._contract.resolveToUri(name, branch, version);
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
            const modules: string[] = await this._contract.getModules(hostnames[0]);
            const result = {};
            for (const m of modules) {
                result[m] = ['default'];
            }

            const result2 = {
                [hostnames[0]]: result
            };

            this.isAvailable = true;
            this.error = null;
            return result2;
        } catch (err) {
            this.isAvailable = false;
            this.error = err.message;
            throw err;
        }
    }

    public async getAllDevModules(): Promise<{ name: string, branch: string, version: string }[]> {
        return Promise.resolve([]);
    }

    public async addModule(name: string, branch: string, version: string, cid: CID): Promise<void> {
        const tx = await this._contract.addModule(name, branch, version, cid.buffer);

        await new Promise((resolve, reject) => {
            this._contract.on("ModuleAdded", (name, branch, verison, uri, event) => {
                if (event.transactionHash === tx.hash) {
                    resolve();
                }
            });
        });

        // await tx.wait();
    }
}