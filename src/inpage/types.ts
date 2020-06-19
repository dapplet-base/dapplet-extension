export interface IModule { }

export interface IContentAdapter<IConfig> extends IModule {
    addFeature(config: IConfig, feature?: IFeature): void;
    attachFeature(feature: IFeature): void;
    detachFeature(feature: IFeature): void;
}

export interface IFeature extends IModule {
    contextIds?: string[];
    orderIndex?: number;

    config: any;
    activate?(): void;
    deactivate?(): void;
}

export interface IResolver extends IModule {
    getBranch(): string;
}

export interface IPubSub {
    exec(topic: string, message: any): Promise<any>;
    //notify(topic: string, message: any): void;
    // on(method: string, handler: (params: any | any[]) => any): {
    //     off: () => void;
    // };
    onMessage(handler: (operation: string, message: any) => any): {
        off: () => void
    };
}