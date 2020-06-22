import { initBGFunctions } from "chrome-extension-message-wrapper";
import * as extension from 'extensionizer';

export class AppStorage {
    constructor(private _moduleName: string) { }

    public async get(key: string): Promise<any> {
        const { getUserSettings } = await initBGFunctions(extension);
        return await getUserSettings(this._moduleName, key);
    }

    public async set(key: string, value: any): Promise<void> {
        const { setUserSettings } = await initBGFunctions(extension);
        return await setUserSettings(this._moduleName, key, value);
    }

    public async remove(key: string): Promise<void> {
        const { removeUserSettings } = await initBGFunctions(extension);
        return await removeUserSettings(this._moduleName, key);
    }

    public async clear(): Promise<void> {
        const { clearUserSettings } = await initBGFunctions(extension);
        return await clearUserSettings(this._moduleName);
    }
}