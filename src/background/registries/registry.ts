import CID from 'cids';

export interface Registry {
    isAvailable: boolean;
    error: string;
    url: string;
    
    getVersions(name: string, branch: string): Promise<string[]>;

    resolveToUri(name: string, branch: string, version: string): Promise<CID[]>;

    // ToDo: add params limit: number, settings: any
    // no more than 100, order
    getFeatures(hostnames: string[]): Promise<{ [hostname: string]: { [name: string]: string[]; } }> // returns name + branches

    getAllDevModules(): Promise<{ name: string, branch: string, version: string }[]>;
    
    addModule(name: string, branch: string, version: string, cid: CID, key?: string): Promise<void>;
}