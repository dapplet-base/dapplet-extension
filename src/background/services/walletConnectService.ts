import WalletConnect from "@walletconnect/client";
import { SowaTemplate } from "../types/sowaTemplate";
import { getTxBuilder } from "../../common/sowa";
import { promiseTimeout } from "../utils/promiseTimeout";
import GlobalConfigService from "./globalConfigService";
import { WalletInfo } from '../../common/constants';
import { browser } from "webextension-polyfill-ts";
import { transactionCreated, transactionRejected } from "./notificationService";
import * as logger from '../../common/logger';
import { getCurrentTab } from "../../common/helpers";
import { WalletLink } from "walletlink"

export const walletLink = new WalletLink({
    appName: "My Awesome DApp",
    appLogoUrl: "https://example.com/logo.png",
    darkMode: false
})

export const ethereum = walletLink.makeWeb3Provider(
    "https://rinkeby.infura.io/v3/eda881d858ae4a25b2dfbbd0b4629992", 4
)

console.log('ethereum', ethereum)


const bridge = "https://bridge.walletconnect.org";

var _walletConnector: WalletConnect;
const _globalConfigService = new GlobalConfigService();

const sendCustomRequest = async (method: string, params: any) => {
    const walletConnector = getConnector();
    const result = await walletConnector.sendCustomRequest({
        jsonrpc: "2.0",
        method: method,
        params: params
    });

    return result;
};

/**
 * Runs SOWA tx inside paired wallet and returns transaction result
 * @async
 * @param {string} sowaId SOWA Template ID
 * @param {object} txMeta Metadata
 * @returns {Promise<object>} Promise represents transaction result
 */
const loadSowa = async (sowaId, txMeta) => {
    const request = {
        jsonrpc: "2.0",
        method: "wallet_loadDapplet",
        params: [
            sowaId,
            txMeta
        ]
    };

    const walletConnector = getConnector();
    const result = await walletConnector.sendCustomRequest(request);
    return result;
};

const loadSowaFrames = async (sowaId, txMeta) => {
    const request = {
        jsonrpc: "2.0",
        method: "wallet_loadDappletFrames",
        params: [
            [sowaId, txMeta],
            ["2"]
        ]
    };
    const walletConnector = getConnector();

    const result = await walletConnector.sendCustomRequest(request);
    return result;
};

const sendLegacyTransaction = async (sowaId: string, txMeta: any) => {
    const sowaTemplate = await getSowaTemplate(sowaId);

    for (const txName in sowaTemplate.transactions) {
        if (txName) {
            const tx = sowaTemplate.transactions[txName];
            const builder = getTxBuilder(tx["@type"]);
            if (builder) {
                const builtTx = builder(tx, txMeta);
                console.log("[DAPPLETS]: Sending classic transaction...");
                const walletConnector = getConnector();
                const result = await walletConnector.sendTransaction({
                    from: walletConnector.accounts[0],
                    to: builtTx.to,
                    data: builtTx.data,
                    value: builtTx.value
                });
                return result;
            }
        }
    }
}

const _getWalletInfo = async (): Promise<WalletInfo> => {
    const requests = [{
        method: "wallet_checkDappletFramesCompatibility",
        transform: (data): WalletInfo => ({
            compatible: true,
            protocolVersion: data?.protocolVersion || "0.2.0",
            engineVersion: data?.protocolVersion || "0.2.0",
            device: data?.device
        })
    }, {
        method: "wallet_checkDappletCompatibility",
        transform: (data): WalletInfo => ({
            compatible: true,
            protocolVersion: data?.protocolVersion || "0.1.0",
            engineVersion: data?.protocolVersion || "0.1.0",
            device: data?.device
        })
    }];

    for (const request of requests) {
        try {
            const walletConnector = getConnector();
            const result = await promiseTimeout(1000, walletConnector.sendCustomRequest({
                jsonrpc: "2.0",
                method: request.method
            }));

            if (!result) continue;

            return request.transform(result);
        } catch { }
    }

    return {
        compatible: false,
        protocolVersion: null,
        engineVersion: null,
        device: null
    }
}

const getConnector = () => {
    if (!_walletConnector) {
        _walletConnector = new WalletConnect({
            bridge
        });
        _walletConnector.on("disconnect", (error, payload) => {
            if (error) {
                throw error;
            }

            localStorage.clear();
            console.log("[DAPPLETS]: wallet disconnected, localstorage cleaned"); // tslint:disable-line
        });
    }
    return _walletConnector;
}

const disconnect = () => {
    if (_walletConnector && _walletConnector.connected) {
        _walletConnector.killSession();
        localStorage.clear();
        _walletConnector = null;
    }
    // ToDo: clear globalconfig.dappletCompatibility
};

/**
 * Returns URI of WalletConnect's session
 * @async
 * @returns {Promise<string>} Promise represents session URI
 */
const generateUri = async () => {
    disconnect();
    const walletConnector = getConnector();
    await walletConnector.createSession();
    const uri = walletConnector.uri;
    return uri;
};

/**
 * Returns connection status of WalletConnect
 * @returns {boolean} Is connected?
 */
const checkConnection = () => {
    const walletConnector = getConnector();
    return walletConnector.connected;
};

/**
 * Returns pairing result.
 * @async
 * @returns {Promise<object>} Promise object represents the result of WalletConnect pairing
 */
const waitPairing = async () => {
    const result: any = await _waitWCPairing();

    if (result) {
        const config = await _globalConfigService.get();
        config.walletInfo = await _getWalletInfo();
        await _globalConfigService.set(config);
    }

    return result;
};

const _waitWCPairing = () => {
    var promise = new Promise(function (resolve, reject) {
        const walletConnector = getConnector();
        walletConnector.on("connect", (error, payload) => {
            if (error) {
                reject(error);
            }

            resolve(payload);
        });
    });

    return promise;
};

const getAccounts = () => {
    const walletConnector = getConnector();
    return walletConnector.accounts;
};

const getChainId = () => {
    const walletConnector = getConnector();
    return walletConnector.chainId;
};

const getSowaTemplate = async (sowaId: string) => {
    const response = await fetch(`https://dapplets.github.io/dapplet-examples/${sowaId}.json`);
    const dappletConfig: SowaTemplate = await response.json();
    return dappletConfig;
}

const sendTransaction = async (tx: any): Promise<any> => {
    const isConnected = checkConnection();
    if (!isConnected) {
        await pairWalletViaOverlay();
    }
    const walletConnector = getConnector();
    return walletConnector.sendTransaction(tx);
}

const pairWalletViaOverlay = async (): Promise<void> => {
    const activeTab = await getCurrentTab();
    const [error, result] = await browser.tabs.sendMessage(activeTab.id, "OPEN_PAIRING_OVERLAY");
    // ToDo: use native throw in error
    if (error) throw new Error(error);
    return result;
}

const sendSowaTransaction = async (sowaId, metadata, callback: (e: { type: string, data?: any }) => void): Promise<any> => {
    const isConnected = checkConnection();

    if (!isConnected) {
        callback({ type: "pairing" });
        await pairWalletViaOverlay();
        callback({ type: "paired" });
    }

    callback({ type: "pending" });

    let dappletResult = null;

    const { walletInfo } = await _globalConfigService.get();

    if (walletInfo.protocolVersion === "0.2.0") {
        console.log("[DAPPLETS]: Wallet is SOWA Frames compatible. Sending SOWA Frames transaction...");
        dappletResult = await loadSowaFrames(sowaId, metadata);
    } else if (walletInfo.protocolVersion === "0.1.0") {
        console.log("[DAPPLETS]: Wallet is SOWA compatible. Sending SOWA transaction...");
        dappletResult = await loadSowa(sowaId, metadata);
    } else {
        console.log("[DAPPLETS]: Wallet is SOWA incompatible. Showing SOWA view...");

        try {
            await approveSowaTxViaOverlay();
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

const approveSowaTxViaOverlay = async (): Promise<void> => {
    const activeTab = await getCurrentTab();
    return browser.tabs.sendMessage(activeTab.id, "APPROVE_SOWA_TRANSACTION");
}

export {
    loadSowa,
    loadSowaFrames,
    generateUri,
    checkConnection,
    waitPairing,
    disconnect,
    getAccounts,
    getChainId,
    pairWalletViaOverlay,
    sendLegacyTransaction,
    getSowaTemplate,
    sendTransaction,
    getConnector,
    sendSowaTransaction,
    sendCustomRequest
};