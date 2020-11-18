export interface Wallet {
    provider: any;
    connect(): void;
    disconnect(): void;
    address: {
        get(): Promise<string>,
        subscribe(callback: (address: string) => void): void
    };
    network: {
        get(): Promise<string>,
        subscribe(callback: (address: string) => void): void
    };
}