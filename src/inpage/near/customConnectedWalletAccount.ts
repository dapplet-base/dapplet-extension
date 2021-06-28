import { ConnectedWalletAccount } from 'near-api-js';
import * as nearAPI from 'near-api-js';
import { baseDecode } from 'borsh';
import { browser } from 'webextension-polyfill-ts';
import { generateGuid } from '../../common/helpers';
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { ChainTypes } from '../../common/types';

export class CustomConnectedWalletAccount extends ConnectedWalletAccount {

    accountId: string;

    constructor(walletConnection: nearAPI.WalletConnection, connection: nearAPI.Connection, accountId: string, private _app: string) {
        super(walletConnection, connection, accountId);
    }

    async signAndSendTransaction(receiverId: string, actions: nearAPI.transactions.Action[]): Promise<nearAPI.providers.FinalExecutionOutcome> {
        //if (!this.accountId) {
        const { prepareWalletFor, localStorage_getItem } = await initBGFunctions(browser);
        // ToDo: remove it?
        await prepareWalletFor(this._app, ChainTypes.NEAR, null);

        const authDataKey = 'null_wallet_auth_key';
        let authData = JSON.parse(await localStorage_getItem(authDataKey));
        if (!authData) {
            await prepareWalletFor(this._app, ChainTypes.NEAR, null);
            authData = JSON.parse(await localStorage_getItem(authDataKey));
        }

        if (!authData) {
            throw new Error('Wallet is not connected');
        }

        this.walletConnection._authData = authData;
        this.accountId = authData.accountId;
        //}

        const localKey = await this.connection.signer.getPublicKey(this.accountId, this.connection.networkId);
        let accessKey = await this.accessKeyForTransaction(receiverId, actions, localKey);
        if (!accessKey) {
            throw new Error(`Cannot find matching key for transaction sent to ${receiverId}`);
        }

        if (localKey && localKey.toString() === accessKey.public_key) {
            try {
                return await super.signAndSendTransaction(receiverId, actions);
            } catch (e) {
                if (e.type === 'NotEnoughBalance') {
                    accessKey = await this.accessKeyForTransaction(receiverId, actions);
                } else {
                    throw e;
                }
            }
        }

        const block = await this.connection.provider.block({ finality: 'final' });
        const blockHash = baseDecode(block.header.hash);

        const publicKey = nearAPI.utils.PublicKey.from(accessKey.public_key);
        // TODO: Cache & listen for nonce updates for given access key
        const nonce = accessKey.access_key.nonce + 1;
        const transaction = nearAPI.transactions.createTransaction(this.accountId, publicKey, receiverId, nonce, actions, blockHash);

        const requestId = generateGuid();
        const callbackUrl = browser.extension.getURL(`callback.html?request_id=${requestId}`);
        
        const { waitTab, removeTab, updateTab, queryTab } = await initBGFunctions(browser);
        const [currentTab] = await queryTab({ active: true, currentWindow: true });
        
        let callbackTab = null;
        const waitTabPromise = waitTab(callbackUrl).then(x => callbackTab = x);
        const requestPromise = this.walletConnection.requestSignTransactions([transaction], callbackUrl);

        await Promise.race([waitTabPromise, requestPromise]);

        if (!callbackTab) throw new Error(`User rejected the transaction.`);

        await updateTab(currentTab.id, { active: true });
        await removeTab(callbackTab.id);

        const callbackTabUrlObject = new URL(callbackTab.url);
        const transactionHashes = callbackTabUrlObject.searchParams.get('transactionHashes');
        const txHash = baseDecode(transactionHashes);
        const txStatus = await this.walletConnection._near.connection.provider.txStatus(txHash, this.accountId);

        return txStatus;

        // TODO: Aggregate multiple transaction request with "debounce".
        // TODO: Introduce TrasactionQueue which also can be used to watch for status?
    }
}