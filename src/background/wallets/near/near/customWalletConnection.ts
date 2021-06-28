import * as nearAPI from 'near-api-js';
import { serialize } from 'borsh';
import { browser } from 'webextension-polyfill-ts';
import { CustomConnectedWalletAccount } from './customConnectedWalletAccount';
import { waitClosingTab } from '../../../../common/helpers';

const LOGIN_WALLET_URL_SUFFIX = '/login/';
const PENDING_ACCESS_KEY_PREFIX = 'pending_key'; // browser storage key for a pending access key (i.e. key has been generated but we are not sure it was added yet)

interface SignInOptions {
    contractId?: string;
    // TODO: Replace following with single callbackUrl
    successUrl?: string;
    failureUrl?: string;
}

export class CustomWalletConnection extends nearAPI.WalletConnection {
    async requestSignIn(
        contractIdOrOptions: string | SignInOptions = {},
        title?: string,
        successUrl?: string,
        failureUrl?: string
    ) {
        let options: SignInOptions;
        if (typeof contractIdOrOptions === 'string') {
            options = { contractId: contractIdOrOptions, successUrl, failureUrl };
        } else {
            options = contractIdOrOptions as SignInOptions;
        }

        const currentUrl = new URL(window.location.href);
        const newUrl = new URL(this._walletBaseUrl + LOGIN_WALLET_URL_SUFFIX);
        newUrl.searchParams.set('success_url', options.successUrl || currentUrl.href);
        newUrl.searchParams.set('failure_url', options.failureUrl || currentUrl.href);
        if (options.contractId) {
            newUrl.searchParams.set('contract_id', options.contractId);
            const accessKey = nearAPI.utils.KeyPair.fromRandom('ed25519');
            newUrl.searchParams.set('public_key', accessKey.getPublicKey().toString());
            await this._keyStore.setKey(this._networkId, PENDING_ACCESS_KEY_PREFIX + accessKey.getPublicKey(), accessKey);
        }

        const tab = await browser.tabs.create({ url: newUrl.toString() });
        await waitClosingTab(tab.id, tab.windowId);
    }

    async requestSignTransactions(transactions: nearAPI.transactions.Transaction[], callbackUrl?: string) {
        const currentUrl = new URL(window.location.href);
        const newUrl = new URL('sign', this._walletBaseUrl);

        newUrl.searchParams.set('transactions', transactions
            .map(transaction => serialize(nearAPI.transactions.SCHEMA, transaction))
            .map(serialized => Buffer.from(serialized).toString('base64'))
            .join(','));
        newUrl.searchParams.set('callbackUrl', callbackUrl || currentUrl.href);

        const tab = await browser.tabs.create({ url: newUrl.toString() });
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
            this._connectedAccount = new CustomConnectedWalletAccount(this, this._near.connection, this._authData.accountId);
        }
        return this._connectedAccount;
    }
}