export interface GenericWallet {
    getAddress(): Promise<string>;
    getChainId(): Promise<number>;
    isAvailable(): Promise<boolean>;
    isConnected(): Promise<boolean>;
    connectWallet(): Promise<void>;
    disconnectWallet(): Promise<void>;
    getLastUsage(): string;
    getMeta(): Promise<{
        icon: string;
        name: string;
        description: string;
    } | null>;
}