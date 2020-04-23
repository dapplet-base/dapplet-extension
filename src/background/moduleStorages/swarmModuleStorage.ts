import * as ethers from 'ethers';
import CID from 'cids';
import multihashing from 'multihashing-async';
import multihashes from 'multihashes';

import { Storage as ModuleStorage } from './storage';

export class SwarmModuleStorage implements ModuleStorage {
    public async getResource(cid: CID): Promise<ArrayBuffer> {
        const multihash = multihashes.decode(cid.multihash);
        const swarmAddress = multihash.digest.toString('hex');
        const response = await fetch(`https://swarm-gateways.net/bzz:/${swarmAddress}`);

        if (!response.ok) {
            throw new Error(`HttpStorage can't load resource by URI ${uri}`);
        }

        const buffer = await response.arrayBuffer();
        const keccak = ethers.utils.keccak256(new Uint8Array(buffer)).substring(2);
        
        // ToDo: move this checking to moduleStorage.ts
        if (!!expectedHash) {
            if (keccak !== expectedHash) {
                console.error(`Hash is not valid. URL: ${uri}, expected: ${expectedHash}, recieved: ${keccak}`);
                throw Error('Hash is not valid.');
            } else {
                console.log(`Successful hash checking. URL: ${uri}, expected: ${expectedHash}, recieved: ${keccak}`);
            }
        } else {
            console.warn(`Skiped hash checking. URL: ${uri}`);
        }

        return buffer;
    }
}