import { Storage as ModuleStorage } from './storage';

export class HttpModuleStorage implements ModuleStorage {
    public async getResource(uri: string): Promise<ArrayBuffer> {
        const response = await fetch(uri, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HttpStorage can't load resource by URI ${uri}`);
        }

        const buffer = await response.arrayBuffer();

        return buffer;
    }

    public async save(blob: Blob, registryUrl: string) {
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
}