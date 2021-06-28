import * as nearAPI from 'near-api-js';
import { serialize } from 'borsh';
import { browser } from "webextension-polyfill-ts";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import { CustomConnectedWalletAccount } from './customConnectedWalletAccount';

const LOGIN_WALLET_URL_SUFFIX = '/login/';
const PENDING_ACCESS_KEY_PREFIX = 'pending_key'; // browser storage key for a pending access key (i.e. key has been generated but we are not sure it was added yet)

interface SignInOptions {
    contractId?: string;
    // TODO: Replace following with single callbackUrl
    successUrl?: string;
    failureUrl?: string;
}

export class BackgroundWalletConnection extends nearAPI.WalletConnection {

    constructor(near: nearAPI.Near, appKeyPrefix: string, private _app: string) {
        super(near, appKeyPrefix);
    }

    async requestSignIn(
        contractIdOrOptions: string | SignInOptions = {},
        title?: string,
        successUrl?: string,
        failureUrl?: string
    ) {
        throw new Error('requestSignIn is not implemented');
    }

    async requestSignTransactions(transactions: nearAPI.transactions.Transaction[], callbackUrl?: string) {
        const currentUrl = new URL(window.location.href);
        const newUrl = new URL('sign', this._walletBaseUrl);

        newUrl.searchParams.set('transactions', transactions
            .map(transaction => serialize(nearAPI.transactions.SCHEMA, transaction))
            .map(serialized => Buffer.from(serialized).toString('base64'))
            .join(','));
        newUrl.searchParams.set('callbackUrl', callbackUrl || currentUrl.href);

        const { createTab, waitClosingTab } = await initBGFunctions(browser);
        const tab = await createTab(newUrl.toString());
        await waitClosingTab(tab.id, tab.windowId);
    }

    async completeSignIn(accountId, publicKey, allKeys) {
        if (accountId) {
            this._authData = {
                accountId,
                allKeys
            };
            window.localStorage.setItem(this._authDataKey, JSON.stringify(this._authData));
            if (publicKey) {
                await this._moveKeyFromTempToPermanent(accountId, publicKey);
            }
        }
    }

    account() {
        if (!this._connectedAccount) {
            this._connectedAccount = new CustomConnectedWalletAccount(this, this._near.connection, this._authData.accountId, this._app);
        }
        return this._connectedAccount;
    }
}