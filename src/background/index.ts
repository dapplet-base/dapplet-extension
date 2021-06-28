import { setupMessageListener } from "chrome-extension-message-wrapper";
import { WalletService } from "./services/walletService";
import * as SuspendService from "./services/suspendService";
import * as NotificationService from "./services/notificationService";
import FeatureService from './services/featureService';
import GlobalConfigService from './services/globalConfigService';
import * as EventService from './services/eventService';
import { browser } from "webextension-polyfill-ts";
import EnsService from "./services/ensService";
import { WebSocketProxy } from "../common/chrome-extension-websocket-wrapper";
import ProxyService from "./services/proxyService";
import * as tracing from '../common/tracing';
import { getCurrentTab, waitClosingTab, waitTab } from "../common/helpers";
import GithubService from "./services/githubService";
import DiscordService from "./services/discordService";
import { IdentityService } from "./services/identityService";

// ToDo: Fix duplication of new FeatureService(), new GlobalConfigService() etc.
// ToDo: It looks like facade and requires a refactoring probably.
// ToDo: Think about WalletConnectService, SuspendService etc, which looks like singletons.
tracing.startTracing();

const globalConfigService = new GlobalConfigService();
const githubService = new GithubService(globalConfigService);
const discordService = new DiscordService(globalConfigService);
const walletService = new WalletService(globalConfigService);
const featureService = new FeatureService(globalConfigService, walletService);
const ensService = new EnsService(walletService);
const proxyService = new ProxyService();
const identityService = new IdentityService(globalConfigService, walletService);

browser.runtime.onMessage.addListener(
  setupMessageListener({

    // WalletService
    prepareWalletFor: walletService.prepareWalletFor.bind(walletService),
    connectWallet: walletService.connectWallet.bind(walletService),
    disconnectWallet: walletService.disconnectWallet.bind(walletService),
    getWalletDescriptors: walletService.getWalletDescriptors.bind(walletService),
    pairWalletViaOverlay: walletService.pairWalletViaOverlay.bind(walletService),
    setWalletFor: walletService.setWalletFor.bind(walletService),
    unsetWalletFor: walletService.unsetWalletFor.bind(walletService),
    getAddress: walletService.getAddress.bind(walletService),

    eth_sendTransactionOutHash: walletService.eth_sendTransactionOutHash.bind(walletService),
    eth_sendCustomRequest: walletService.eth_sendCustomRequest.bind(walletService),
    eth_waitTransaction: walletService.eth_waitTransaction.bind(walletService),
    near_sendCustomRequest: walletService.near_sendCustomRequest.bind(walletService),

    // SuspendService
    getSuspendityByHostname: SuspendService.getSuspendityByHostname,
    getSuspendityEverywhere: SuspendService.getSuspendityEverywhere,
    suspendByHostname: SuspendService.suspendByHostname,
    suspendEverywhere: SuspendService.suspendEverywhere,
    resumeByHostname: SuspendService.resumeByHostname,
    resumeEverywhere: SuspendService.resumeEverywhere,

    // NotificationService
    transactionCreated: NotificationService.transactionCreated,
    transactionRejected: NotificationService.transactionRejected,

    // FeatureService
    getFeaturesByHostnames: (hostnames) => featureService.getFeaturesByHostnames(hostnames),
    activateFeature: (name, version, hostnames, order, registry) => featureService.activateFeature(name, version, hostnames, order, registry),
    deactivateFeature: (name, version, hostnames, order, registry) => featureService.deactivateFeature(name, version, hostnames, order, registry),
    reloadFeature: (name, version, hostnames, order, registry) => featureService.reloadFeature(name, version, hostnames, order, registry),
    getActiveModulesByHostnames: (hostnames) => featureService.getActiveModulesByHostnames(hostnames),
    getModulesWithDeps: (modules) => featureService.getModulesWithDeps(modules),
    optimizeDependency: (name, branch, version, contextIds) => featureService.optimizeDependency(name, branch, version, contextIds),
    getAllDevModules: () => featureService.getAllDevModules(),
    deployModule: (mi, vi, targetStorage, targetRegistry) => featureService.deployModule(mi, vi, targetStorage, targetRegistry),
    getRegistries: () => featureService.getRegistries(),
    getOwnership: (registryUri, moduleName) => featureService.getOwnership(registryUri, moduleName),
    getVersionInfo: (registryUri, moduleName, branch, version) => featureService.getVersionInfo(registryUri, moduleName, branch, version),
    getModuleInfoByName: (registryUri, moduleName) => featureService.getModuleInfoByName(registryUri, moduleName),
    transferOwnership: (registryUri, moduleName, address) => featureService.transferOwnership(registryUri, moduleName, address),
    addLocation: (registryUri, moduleName, location) => featureService.addLocation(registryUri, moduleName, location),
    removeLocation: (registryUri, moduleName, location) => featureService.removeLocation(registryUri, moduleName, location),
    getVersions: (registryUri, moduleName) => featureService.getVersions(registryUri, moduleName),
    openSettingsOverlay: (mi) => featureService.openSettingsOverlay(mi),
    openDappletAction: (name, tabId) => featureService.openDappletAction(name, tabId),
    openDappletHome: (name, tabId) => featureService.openDappletHome(name, tabId),
    removeDapplet: (name, hostnames) => featureService.removeDapplet(name, hostnames),

    // GlobalConfigService
    getProfiles: globalConfigService.getProfiles.bind(globalConfigService),
    setActiveProfile: globalConfigService.setActiveProfile.bind(globalConfigService),
    renameProfile: globalConfigService.renameProfile.bind(globalConfigService),
    copyProfile: globalConfigService.copyProfile.bind(globalConfigService),
    deleteProfile: globalConfigService.deleteProfile.bind(globalConfigService),
    importProfile: globalConfigService.importProfile.bind(globalConfigService),
    exportProfile: globalConfigService.exportProfile.bind(globalConfigService),
    createShareLink: globalConfigService.createShareLink.bind(globalConfigService),
    getGlobalConfig: () => globalConfigService.get(),
    setGlobalConfig: (config) => globalConfigService.set(config),
    getDevMode: () => globalConfigService.getDevMode(),
    setDevMode: (isActive) => globalConfigService.setDevMode(isActive),
    getEvents: EventService.getEvents,
    addEvent: EventService.addEvent,
    setRead: EventService.setRead,
    getNewEventsCount: EventService.getNewEventsCount,
    addRegistry: (url, isDev) => globalConfigService.addRegistry(url, isDev),
    removeRegistry: (url) => globalConfigService.removeRegistry(url),
    enableRegistry: (url) => globalConfigService.enableRegistry(url),
    disableRegistry: (url) => globalConfigService.disableRegistry(url),
    getIntro: () => globalConfigService.getIntro(),
    setIntro: (intro) => globalConfigService.setIntro(intro),
    getTrustedUsers: () => globalConfigService.getTrustedUsers(),
    addTrustedUser: (account) => globalConfigService.addTrustedUser(account),
    removeTrustedUser: (account) => globalConfigService.removeTrustedUser(account),
    getAutoBackup: () => globalConfigService.getAutoBackup(),
    setAutoBackup: (isActive) => globalConfigService.setAutoBackup(isActive),
    getErrorReporting: () => globalConfigService.getErrorReporting(),
    setErrorReporting: (isActive) => globalConfigService.setErrorReporting(isActive),
    getIdentityContract: globalConfigService.getIdentityContract.bind(globalConfigService),
    getPopupInOverlay: () => globalConfigService.getPopupInOverlay(),
    setPopupInOverlay: (isActive) => globalConfigService.setPopupInOverlay(isActive),
    getUserAgentId: globalConfigService.getUserAgentId.bind(globalConfigService),
    getUserAgentName: globalConfigService.getUserAgentName.bind(globalConfigService),
    setUserAgentName: globalConfigService.setUserAgentName.bind(globalConfigService),
    getIgnoredUpdate: globalConfigService.getIgnoredUpdate.bind(globalConfigService),
    setIgnoredUpdate: globalConfigService.setIgnoredUpdate.bind(globalConfigService),
    getLastMessageSeenTimestamp: globalConfigService.getLastMessageSeenTimestamp.bind(globalConfigService),
    setLastMessageSeenTimestamp: globalConfigService.setLastMessageSeenTimestamp.bind(globalConfigService),
    getPreferedOverlayStorage: globalConfigService.getPreferedOverlayStorage.bind(globalConfigService),
    setPreferedOverlayStorage: globalConfigService.setPreferedOverlayStorage.bind(globalConfigService),

    // UserSettings (AppStorage)
    getUserSettings: (moduleName, key) => globalConfigService.getUserSettings(moduleName, key),
    setUserSettings: (moduleName, key, value) => globalConfigService.setUserSettings(moduleName, key, value),
    removeUserSettings: (moduleName, key) => globalConfigService.removeUserSettings(moduleName, key),
    clearUserSettings: (moduleName) => globalConfigService.clearUserSettings(moduleName),
    getAllUserSettings: (moduleName) => globalConfigService.getAllUserSettings(moduleName),
    setAllUserSettings: (moduleName, values) => globalConfigService.setAllUserSettings(moduleName, values),
    getEthereumProvider: () => globalConfigService.getEthereumProvider(),
    setEthereumProvider: (url) => globalConfigService.setEthereumProvider(url),
    getSwarmGateway: globalConfigService.getSwarmGateway.bind(globalConfigService),
    setSwarmGateway: globalConfigService.setSwarmGateway.bind(globalConfigService),
    getDynamicAdapter: globalConfigService.getDynamicAdapter.bind(globalConfigService),
    setDynamicAdapter: globalConfigService.setDynamicAdapter.bind(globalConfigService),

    // ENS
    resolveName: (name) => ensService.resolveName(name),

    // Contract Service
    fetchJsonRpc: (method, params) => proxyService.fetchJsonRpc(method, params),

    // Github Service
    getNewExtensionVersion: githubService.getNewExtensionVersion.bind(githubService),
    getDevMessage: githubService.getDevMessage.bind(githubService),
    hideDevMessage: githubService.hideDevMessage.bind(githubService),

    // Discord Service
    getDiscordMessages: discordService.getDiscordMessages.bind(discordService),
    hideDiscordMessages: discordService.hideDiscordMessages.bind(discordService),

    // Identity Service
    getIdentityAccounts: identityService.getAccounts.bind(identityService),
    addIdentityAccount: identityService.addAccount.bind(identityService),

    // LocalStorage
    localStorage_setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
    localStorage_getItem: (key) => Promise.resolve(localStorage.getItem(key)),
    localStorage_removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
    localStorage_clear: () => Promise.resolve(localStorage.clear()),
    localStorage_key: (index) => Promise.resolve(localStorage.key(index)),
    localStorage_length: () => Promise.resolve(localStorage.length),

    // Extension Basic
    createTab: (url) => browser.tabs.create({ url }),
    removeTab: (tabId) => browser.tabs.remove(tabId),
    updateTab: (tabId, updateProperties) => browser.tabs.update(tabId, updateProperties),
    queryTab: (queryInfo) => browser.tabs.query(queryInfo),

    // Helpers
    waitTab: (url) => waitTab(url),
    waitClosingTab: (tabId, windowId) => waitClosingTab(tabId, windowId)
  })
);

// WebSocket proxy
// ToDo: Perhaps a separate class WebSocketProxy is redundant
const wsproxy = new WebSocketProxy();
browser.runtime.onConnect.addListener(wsproxy.createConnectListener());

// ToDo: These lines are repeated many time
SuspendService.changeIcon();
SuspendService.updateContextMenus();

//listen for new tab to be activated
browser.tabs.onActivated.addListener(function (activeInfo) {
  SuspendService.changeIcon();
  SuspendService.updateContextMenus();
});

//listen for current tab to be changed
browser.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  SuspendService.changeIcon();
  SuspendService.updateContextMenus();
});

browser.notifications.onClicked.addListener(function (notificationId) {
  if (
    notificationId &&
    notificationId.length > 2 &&
    notificationId[0] == "0" &&
    notificationId[1] == "x"
  ) {
    // ToDo: it's incorrect to be linked with Ethereum and Rinkeby only.
    var url = "https://rinkeby.etherscan.io/tx/" + notificationId;
    browser.tabs.create({ url: url });
  }
});

browser.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-overlay") {
    return getCurrentTab().then((activeTab) => activeTab && browser.tabs.sendMessage(activeTab.id, "TOGGLE_OVERLAY"));
  }
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || !message.type) return;

  if (message.type === "CONTEXT_STARTED" || message.type === "CONTEXT_FINISHED") {
    return featureService.getActiveModulesByHostnames(message.payload.contextIds).then(manifests => {
      if (manifests.length === 0) return;

      browser.tabs.sendMessage(sender.tab.id, {
        type: message.type === "CONTEXT_STARTED" ? "FEATURE_ACTIVATED" : "FEATURE_DEACTIVATED",
        payload: manifests.map(m => ({
          name: m.name,
          version: m.version,
          branch: m.branch, // ToDo: fix branch
          order: m.order,
          contextIds: m.hostnames  // ToDo: remove this map after renaming of hostnames to contextIds
        }))
      });
    });
  }
});

globalConfigService.getPopupInOverlay().then((popupInOverlay) => {
  browser.browserAction.setPopup({
    popup: (popupInOverlay) ? '' : 'popup.html'
  });
});

browser.browserAction.onClicked.addListener((tab) => {
  return getCurrentTab().then((activeTab) => activeTab && browser.tabs.sendMessage(activeTab.id, { type: "OPEN_POPUP_OVERLAY", payload: { path: 'dapplets' } }));
});

// Set predefined configuration when extension is installed
browser.runtime.onInstalled.addListener(async (details) => {

  // Find predefined config URL in downloads
  if (details.reason !== 'install') return;
  const downloads = await browser.downloads.search({ filenameRegex: 'dapplet-extension' });
  if (downloads.length === 0) return;
  const [downloadItem] = downloads.sort((a, b) => -a.startTime.localeCompare(b.startTime));
  if (!downloadItem || !downloadItem.url) return;
  const url = new URL(downloadItem.url);
  const config = url.searchParams.get('config');
  if (!config) return;

  // Find override parameters in URL
  const customParams = {};
  url.searchParams.forEach((value, key) => {
    if (key !== 'config') customParams[key] = value;
  });

  try {
    const url = new URL(config);
    const resp = await fetch(url.href);
    const json = await resp.json();

    const addCustomParams = (defParamsConfig: any) => {
      Object.entries(customParams).forEach(([name, value]) => {
        let parsedValue: any;
        try {
          parsedValue = JSON.parse(<string>value);
        } catch (e) {
          parsedValue = value;
        }
        defParamsConfig[name] = parsedValue;
      });
    }

    if (Array.isArray(json)) {
      for (const j of json) {
        addCustomParams(j);
        await globalConfigService.set(j);
      }
    } else {
      addCustomParams(json);
      await globalConfigService.set(json);
    }

    console.log(`The predefined configuration was initialized. URL: ${url.href}`);
  } catch (err) {
    console.error("Cannot set predefined configuration.", err);
  }

  // const welcomeUrl = new URL(browser.extension.getURL('welcome.html'));
  // if (config) welcomeUrl.searchParams.set('config', config);
  // await browser.tabs.create({ url: welcomeUrl.href });
});