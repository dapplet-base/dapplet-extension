import { initBGFunctions } from "chrome-extension-message-wrapper";
import * as extension from 'extensionizer';

import { Overlay } from "./overlay";
import { Swiper } from "./swiper";
import { AutoProperties, EventDef, Connection } from "./connection";
import { WsJsonRpc } from "./wsJsonRpc";
import { OverlayManager } from "./overlayManager";
import { AppStorage } from "./appStorage";

export default class Core {
    public overlayManager = new OverlayManager();
    private _popupOverlay: Overlay = null;

    constructor() {
        const closeOverlay = () => {
            if (this._popupOverlay == null) {
                this._togglePopupOverlay()
            } else {
                this._popupOverlay.open()
            }
        }

        extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (typeof message === 'string') {
                if (message === "OPEN_PAIRING_OVERLAY") {
                    this.waitPairingOverlay()
                        .then(() => sendResponse([null, 'ready']))
                        .catch(() => sendResponse(['error']));
                    return true; // return true from the event listener to indicate you wish to send a response asynchronously 
                } else if (message === "TOGGLE_OVERLAY") {
                    this._togglePopupOverlay();
                    sendResponse();
                } else if (message === "OPEN_OVERLAY") { // used by pure jslib
                    closeOverlay();
                    sendResponse();
                } else if (message === "CLOSE_OVERLAY") { // used by pure jslib
                    this.overlayManager && this.overlayManager.unregisterAll();
                    sendResponse();
                }
            } else if (typeof message === 'object' && message.type !== undefined) {
                if (message.type === 'OPEN_DEPLOY_OVERLAY') {
                    this.waitDeployOverlay(message.payload).finally(() => sendResponse());
                    return true;
                } else if (message.type === 'APPROVE_SOWA_TRANSACTION') {
                    this._approveSowaTransaction(message.payload.sowaId, message.payload.metadata)
                        .then(() => sendResponse([null, 'approved']))
                        .catch(() => sendResponse(['error']));
                    return true;
                }
            }
        });

        const swiper = new Swiper(document.body);
        swiper.on("left", () => closeOverlay());
        swiper.on("right", () => this.overlayManager.close());
    }

    public waitPairingOverlay(): Promise<void> {
        const me = this;
        return new Promise<void>((resolve, reject) => {
            const pairingUrl = extension.extension.getURL('pairing.html');
            const overlay = new Overlay(this.overlayManager, pairingUrl, 'Wallet');
            overlay.open();
            // ToDo: add timeout?
            overlay.onMessage((topic, message) => {
                if (topic === 'ready') {
                    overlay.close();
                    resolve();
                }

                if (topic === 'error') {
                    reject();
                }
            });
        });
    }

    public waitDeployOverlay(payload: any): Promise<void> {
        const me = this;
        return new Promise<void>((resolve, reject) => {
            const pairingUrl = extension.extension.getURL('deploy.html');
            const overlay = new Overlay(this.overlayManager, pairingUrl, 'Deploy');
            overlay.open(() => overlay.send('data', [payload]));
            // ToDo: add timeout?
            overlay.onMessage((topic, message) => {
                if (topic === 'ready') {
                    overlay.close();
                    resolve();
                }

                if (topic === 'error') {
                    reject();
                }
            });
        });
    }

    public _togglePopupOverlay() {
        if (!this._popupOverlay?.registered) {
            const pairingUrl = extension.extension.getURL('popup.html');
            this._popupOverlay = new Overlay(this.overlayManager, pairingUrl, 'Dapplets');
            this._popupOverlay.open();
        } else {
            this.overlayManager.toggle();
        }
    }

    private async _approveSowaTransaction(sowaId, metadata): Promise<void> {
        const me = this;

        return new Promise<void>((resolve, reject) => {
            const pairingUrl = extension.extension.getURL('sowa.html');
            const overlay = new Overlay(me.overlayManager, pairingUrl, 'SOWA');
            // ToDo: implement multiframe
            overlay.open(() => overlay.send('txmeta', [sowaId, metadata]));
            // ToDo: add timeout?
            overlay.onMessage((topic, message) => {
                if (topic === 'approved') {
                    resolve();
                    overlay.close();
                }

                if (topic === 'error') {
                    reject();
                    overlay.close();
                }
            });
        });
    }

    // ToDo: use sendSowaTransaction method from background
    private async _sendWalletConnectTx(sowaId, metadata, callback: (e: { type: string, data?: any }) => void): Promise<any> {
        const backgroundFunctions = await initBGFunctions(extension);
        const {
            loadSowa,
            loadSowaFrames,
            transactionCreated,
            transactionRejected,
            checkConnection,
            getGlobalConfig,
            sendLegacyTransaction,
            sendCustomRequest
        } = backgroundFunctions;

        const isConnected = await checkConnection();


        if (!isConnected) {
            callback({ type: "pairing" });
            await this.waitPairingOverlay();
            callback({ type: "paired" });
        }

        callback({ type: "pending" });

        let dappletResult = null;

        const { walletInfo } = await getGlobalConfig();

        const compatibleJsonRpc = ['personal_sign', 'eth_accounts', 'eth_sendTransaction'];

        if (compatibleJsonRpc.includes(sowaId)) {
            const result = await sendCustomRequest(sowaId, metadata);
            callback({ type: "result", data: result });
            return result;
        } else {
            if (walletInfo.protocolVersion === "0.2.0") {
                console.log("Wallet is SOWA Frames compatible. Sending SOWA Frames transaction...");
                dappletResult = await loadSowaFrames(sowaId, metadata);
            } else if (walletInfo.protocolVersion === "0.1.0") {
                console.log("Wallet is SOWA compatible. Sending SOWA transaction...");
                dappletResult = await loadSowa(sowaId, metadata);
            } else {
                console.log("Wallet is SOWA incompatible. Showing SOWA view...");
    
                try {
                    await this._approveSowaTransaction(sowaId, metadata);
                    dappletResult = await sendLegacyTransaction(sowaId, metadata);
                } catch (err) {
                }
            }
    
            if (dappletResult) {
                transactionCreated(dappletResult);
                callback({ type: "created", data: dappletResult });
            } else {
                transactionRejected();
                callback({ type: "rejected" });
            }

            return dappletResult;
        }        
    }

    public connect<M>(cfg: { url: string }, eventDef?: EventDef<any>): AutoProperties<M> & Connection {
        const rpc = new WsJsonRpc(cfg.url);
        const conn = Connection.create<M>(rpc, eventDef);
        return conn;
    }

    public wallet<M>(cfg?: {}, eventDef?: EventDef<any>): AutoProperties<M> & Connection {
        const me = this;
        const transport = {
            _txCount: 0,
            _handler: null,
            exec: (sowaId: string, ctx: any) => {
                const id = (++transport._txCount).toString();
                me._sendWalletConnectTx(sowaId, ctx, (e) => transport._handler(id, e));
                return Promise.resolve(id);
            },
            onMessage: (handler: (topic: string, message: any) => void) => {
                transport._handler = handler;
                return {
                    off: () => transport._handler = null
                }
            }
        }

        const conn = Connection.create<M>(transport, eventDef);
        return conn;
    }

    public overlay<M>(cfg: { url: string, title: string }, eventDef?: EventDef<any>): AutoProperties<M> & Connection {
        const _overlay = new Overlay(this.overlayManager, cfg.url, cfg.title);
        const conn = Connection.create<M>(_overlay, eventDef);
        return conn;
    }

    // ToDo: remove it or implement!
    contextStarted(contextIds: any[], parentContext?: string): void { }
    contextFinished(contextIds: any[], parentContext?: string): void { }

    public storage: AppStorage;
}