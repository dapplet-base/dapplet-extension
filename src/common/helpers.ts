import { browser, Tabs } from "webextension-polyfill-ts";
import { ChainTypes, ModuleId } from "./types";

export function getHostName(url: string): string {
  return new URL(url).hostname;
}

/**
 * Merges and deduplicates arrays of arrays
 * @param input arrays of arrays
 */
export function mergeDedupe<T>(input: T[][]): T[] {
  return [...new Set(mergeArrays(input))];
}

/**
 * Merges arrays of arrays
 * @param input arrays of arrays
 */
export function mergeArrays<T>(input: T[][]): T[] {
  return [].concat(...input);
}

/**
 * Compares name, branch and version of A and B
 * @param a manifest's part A
 * @param a manifest's part B
 */
export function areModulesEqual(
  a: ModuleId,
  b: ModuleId
): boolean {
  return (
    a.name === b.name &&
    a.branch === b.branch &&
    a.version === b.version
  );
}

export enum UriTypes {
  Unknown = 0,
  Http,
  Swarm,
  Ipfs,
  Ethereum,
  Ens,
  Near
}

/**
 * Recognizes a type of URI
 */
export function typeOfUri(uri: string): UriTypes {

  const uriLower = uri.toLowerCase()

  if (uriLower.indexOf('http://') === 0 || uriLower.indexOf('https://') === 0) {
    return UriTypes.Http
  }

  if (uriLower.indexOf('bzz://') === 0) {
    return UriTypes.Swarm
  }

  if (uriLower.indexOf('ipfs://') === 0) {
    return UriTypes.Ipfs
  }

  // ToDo: add Ethereum address validator
  if (uriLower.indexOf('0x') === 0 && uriLower.length === 42) {
    return UriTypes.Ethereum;
  }

  if (uriLower.lastIndexOf('.eth') === uriLower.length - 4) {
    return UriTypes.Ens;
  }

  if (uriLower.lastIndexOf('.near') === uriLower.length - 5 ||
    uriLower.lastIndexOf('.testnet') === uriLower.length - 8 ||
    uriLower.indexOf('dev-') === 0) {
    return UriTypes.Near;
  }

  return UriTypes.Unknown;
}

/**
 * Assert function for filtering of fullfilled Promises with .filter()
 */
export function assertFullfilled<T>(item: PromiseSettledResult<T>): item is PromiseFulfilledResult<T> {
  return item.status === "fulfilled";
}

/**
 * Assert function for filtering of rejected Promises with .filter()
 */
export function assertRejected<T>(item: PromiseSettledResult<T>): item is PromiseRejectedResult {
  return item.status === "rejected";
}

export function allSettled($) {
  'use strict';
  var self = this;
  return self.all(
    $.map(
      function (value) {
        return self.resolve(value).then(this.$, this._);
      },
      {
        $: function (value) {
          return { status: 'fulfilled', value: value };
        },
        _: function (reason) {
          return { status: 'rejected', reason: reason };
        }
      }
    )
  );
};

export function timeoutPromise<T>(ms: number, promise: Promise<T>, timeoutCallback?: Function) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      timeoutCallback?.();
      reject(new Error("promise timeout"));
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timeoutId);
        resolve(res);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      }
    );
  })
}

export async function getCurrentTab(): Promise<Tabs.Tab | null> {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });
    const tab = tabs[0];

    if (!tab) return null;

    const popupUrl = browser.extension.getURL('popup.html');

    if (tab.url.indexOf(popupUrl) !== -1) {
      const params = new URLSearchParams(new URL(tab.url).search); // For automated testing open popup in separated tab with URL /popup.html?tabUrl=https://example.com
      const url = params.get('tabUrl');
      if (url) {
        const [currentTab] = await browser.tabs.query({ url: url });
        return currentTab;
      }
    }

    return tab;
  } catch (_) {
    return null;
  }
}

export function networkName(chainId: number) {
  const map = {
    1: 'mainnet',
    3: 'ropsten',
    4: 'rinkeby',
    42: 'kovan'
  }

  return map[chainId] ?? 'unknown';
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function fetchWithTimeout(resource, options) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);

    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Error('Request timeout exceeded');
    } else {
      throw err;
    }
  }
}

export function generateGuid() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export async function waitTab(url: string) {
  return new Promise<Tabs.Tab>((res, rej) => {
    const handler = async (tabId: number) => {
      const tab = await browser.tabs.get(tabId);
      if (tab.url.indexOf(url) === 0) {
        res(tab);
        browser.tabs.onUpdated.removeListener(handler);
      }
    }
    browser.tabs.onUpdated.addListener(handler);
  });
}

export function chainByUri(t: UriTypes): ChainTypes {
  switch (t) {
    case UriTypes.Ens: return ChainTypes.ETHEREUM;
    case UriTypes.Ethereum: return ChainTypes.ETHEREUM;
    case UriTypes.Near: return ChainTypes.NEAR;
    default: return null;
  }
}

/**
 * Add increment to filename for uniqueness
 * @param name filename
 * @returns 
 */
export function incrementFilename(name: string): string {
  const n = Number.parseInt(/\(([0-9]*)\)$/gm.exec(name)?.[1] ?? '1');
  return (n === 1) ? `${name} (2)` : name.replace(/\(([0-9]*)\)$/gm, `(${n + 1})`);
}

export function joinUrls(base: string, url: string) {
  return (new URL(url, base)).href;
}

export function parseModuleName(str: string): { name: string, branch: string, version: string } | null {
  const regex = /^([a-z0-9\.-]+)(?:#([a-z0-9-]+))?(?:@((?:[0-9]+\.[0-9]+\.[0-9]+)|latest))?$/gm;
  const parsed = regex.exec(str);
  if (!parsed) return null;

  return {
    name: parsed[1] ?? null,
    branch: parsed[2] ?? null,
    version: parsed[3] ?? null
  };
}

export function pick(o: any, ...fields: string[]) {
  return fields.reduce((a, x) => {
    if (o.hasOwnProperty(x)) a[x] = o[x];
    return a;
  }, {});
}

export async function waitClosingTab(tabId: number, windowId: number) {
  return new Promise<void>((res, rej) => {
    const handler = (_tabId, removeInfo) => {
      if (_tabId === tabId && windowId === removeInfo.windowId) {
        res();
        browser.tabs.onRemoved.removeListener(handler);
      }
    }
    browser.tabs.onRemoved.addListener(handler);
  });
}