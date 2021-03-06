import { Storage as ModuleStorage } from './storage';
import { timeoutPromise, joinUrls } from '../../common/helpers';

export class SwarmModuleStorage implements ModuleStorage {

    private _gateway: string;
    public timeout = 5000;

    constructor(config: { swarmGatewayUrl: string }) {
        this._gateway = config.swarmGatewayUrl;
    }
    
    public async getResource(uri: string, fetchController: AbortController = new AbortController()): Promise<ArrayBuffer> {

        const response = await timeoutPromise(
            this.timeout,
            fetch(joinUrls(this._gateway, "files/" + this._extractReference(uri)), { signal: fetchController.signal }),
            () => fetchController.abort()
        );

        if (!response.ok) {
            throw new Error(`HttpStorage can't load resource by URI ${uri}`);
        }

        const buffer = await response.arrayBuffer();

        return buffer;
    }

    private _extractReference(uri: string) {
        const result = uri.match(/[0-9a-fA-F]{64}/gm);
        if (!result || result.length === 0) throw new Error("Invalid Swarm URI");
        return result[0];
    }

    public async save(blob: Blob) {
        const response = await fetch(joinUrls(this._gateway, 'files'), {
            method: 'POST',
            body: blob
        });
    
        const json = await response.json();
        if (!json.reference) throw new Error("Cannot upload file to Swarm."); // ToDo: show message
        const url = "bzz://" + json.reference;
        return url;
    }
    
    public async saveDir(tarBlob: Blob): Promise<string> {
        const response = await fetch(joinUrls(this._gateway, 'dirs'), {
            method: 'POST',
            body: tarBlob,
            headers: {
                'swarm-index-document': 'index.html'
            }
        });
    
        const json = await response.json();
        if (!json.reference) throw new Error("Cannot upload file to Swarm."); // ToDo: show message
        const url = "bzz://" + json.reference;
        return url;
    }
}