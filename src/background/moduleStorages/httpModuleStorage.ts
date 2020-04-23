import * as ethers from 'ethers';
import CID from 'cids';
import { Storage as ModuleStorage } from './storage';

export class HttpModuleStorage implements ModuleStorage {
    public async getResource(cid: CID): Promise<ArrayBuffer> {
        const response = await fetch(`https://test.dapplets.org/dapplet-base/storage/${cid.toString()}`, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HttpStorage can't load resource by URI ${cid}`);
        }

        const buffer = await response.arrayBuffer();
        return buffer;
    }
}