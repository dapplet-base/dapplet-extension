import { browser } from 'webextension-polyfill-ts';
import FrameRpc from '../common/frameRpc';
import { Overlay } from './overlay';

const PageNavClass = 'dapplets-overlay-nav';
const TabListClass = 'dapplets-overlay-nav-tab-list';
const ContentListClass = 'dapplets-overlay-nav-content-list';
const TabItemClass = 'dapplets-overlay-nav-tab-item';
const ContentItemClass = 'dapplets-overlay-nav-content-item';
const ActiveTabHeaderClass = 'dapplets-overlay-nav-tab-item-active';
const ActiveTabContentClass = 'dapplets-overlay-nav-content-item-active';
const CloseButtonClass = 'dapplets-overlay-nav-tab-item-close-btn';
const CollapsedOverlayClass = 'dapplets-overlay-collapsed';
const HiddenOverlayClass = 'dapplets-overlay-hidden';
const DappletsOverlayManagerClass = 'dapplets-overlay-manager';
const OverlayOuterClass = 'dapplets-overlay-outer';
const OverlayFrameClass = 'dapplets-overlay-frame';
const OverlayBucketBarClass = 'dapplets-overlay-bucket-bar';
const OverlayToolbarClass = 'dapplets-overlay-toolbar';
const OverlayFrameButtonClass = 'dapplets-overlay-frame-button';
const OverlayFrameButtonSidebarToggleClass = 'dapplets-overlay-frame-button-sidebar-toggle';

export class OverlayManager {
    private _panel: HTMLElement = null;
    private _tabList: HTMLDivElement = null;
    private _contentList: HTMLDivElement = null;
    private _activeOverlay: Overlay = null;

    private _tabsRegistry: {
        overlay: Overlay,
        tabItem: HTMLDivElement,
        contentItem: HTMLDivElement
    }[] = [];

    constructor() {
        // Side panel
        const panel = document.createElement(DappletsOverlayManagerClass);
        panel.classList.add(OverlayFrameClass, OverlayOuterClass, CollapsedOverlayClass, HiddenOverlayClass);
        document.body.appendChild(panel);
        this._panel = panel;

        const bucketBar = document.createElement("div");
        bucketBar.classList.add(OverlayBucketBarClass);
        panel.appendChild(bucketBar);

        const toolBar = document.createElement("div");
        toolBar.classList.add(OverlayToolbarClass);
        panel.appendChild(toolBar);

        const ul = document.createElement('ul');
        toolBar.appendChild(ul);

        const li = document.createElement('li');
        ul.appendChild(li);

        const button = document.createElement('button');
        button.title = "Toggle Overlay";
        button.classList.add(OverlayFrameButtonClass, OverlayFrameButtonSidebarToggleClass);
        button.innerText = '⇄';
        button.onclick = () => this.toggle();
        li.appendChild(button);

        // Tabs
        const nav = document.createElement("div");
        nav.classList.add(PageNavClass);
        panel.appendChild(nav);

        const tabList = document.createElement("div");
        tabList.classList.add(TabListClass);
        nav.appendChild(tabList);
        this._tabList = tabList;

        const contentList = document.createElement("div");
        contentList.classList.add(ContentListClass);
        nav.appendChild(contentList);
        this._contentList = contentList;

        const frame = document.createElement('iframe');
        frame.src = browser.extension.getURL('overlay.html');
        panel.appendChild(frame);

        
        const rpc = new FrameRpc({
            greet: (a) => `Hello, ${a}!`
        }, frame.contentWindow);

        console.log('rpc parent', rpc);
    }

    /**
     * Expands the panel.
     */
    public open() {
        this._panel.classList.remove(CollapsedOverlayClass);
    }

    /**
     * Collapses the panel.
     */
    public close() {
        this._panel.classList.add(CollapsedOverlayClass);
    }

    /**
     * Shows the panel.
     */
    public show() {
        this._panel.classList.remove(HiddenOverlayClass);
    }

    /**
     * Hides the panel.
     */
    public hide() {
        this._panel.classList.add(HiddenOverlayClass);
    }

    public toggle() {
        this._panel.classList.toggle(CollapsedOverlayClass);
    }

    public register(overlay: Overlay) {
        overlay.registered = true;
        if (this._tabsRegistry.filter(t => t.overlay === overlay).length > 0) return;

        const tabItem = document.createElement('div');
        tabItem.classList.add(TabItemClass);

        const titleDiv = document.createElement('div');
        titleDiv.innerText = overlay.title;
        titleDiv.title = overlay.title;
        titleDiv.classList.add('dapplets-overlay-nav-tab-item-title');

        tabItem.appendChild(titleDiv);
        tabItem.addEventListener('click', (ev) => {
            ev.cancelBubble = true;
            ev.stopPropagation();
            this.activate(overlay);
        });
        this._tabList.appendChild(tabItem);

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4 16 16" style="width: 10px;">
                <path d="M0 0h24v24H0z" fill="none"/>
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        `;
        closeBtn.classList.add(CloseButtonClass);
        closeBtn.addEventListener('click', (ev) => {
            ev.cancelBubble = true;
            ev.stopPropagation();
            //this.unregister(overlay);
            overlay.close();
        });
        tabItem.appendChild(closeBtn);

        const contentItem = document.createElement('div');
        contentItem.classList.add(ContentItemClass);
        contentItem.appendChild(overlay.frame);
        this._contentList.appendChild(contentItem);

        this._tabsRegistry.push({ overlay, tabItem, contentItem });

        this.activate(overlay);

        this.show();
    }

    public unregister(overlay: Overlay) {
        overlay.registered = false;
        const tab = this._tabsRegistry.filter(t => t.overlay === overlay)[0];
        if (!tab) return;

        this._tabList.removeChild(tab.tabItem);
        this._contentList.removeChild(tab.contentItem);

        this._tabsRegistry = this._tabsRegistry.filter(t => t.overlay !== overlay);

        if (this._activeOverlay === overlay) {
            this._activeOverlay = null;
            const nextTab = this._tabsRegistry[0];
            nextTab && this.activate(nextTab.overlay);
        }

        if (this._tabsRegistry.length == 0) {
            this.hide();
        }
    }

    public unregisterAll() {
        this._tabsRegistry.forEach(({ overlay }) => this.unregister(overlay));
    }

    public activate(overlay: Overlay) {
        if (this._activeOverlay == overlay) return;

        if (this._activeOverlay) {
            this.deactivate(this._activeOverlay);
        }

        const tab = this._tabsRegistry.filter(t => t.overlay === overlay)[0];
        tab.tabItem.classList.toggle(ActiveTabHeaderClass, true);
        tab.contentItem.classList.toggle(ActiveTabContentClass, true);

        this._activeOverlay = overlay;
    }

    public deactivate(overlay: Overlay) {
        const tab = this._tabsRegistry.filter(t => t.overlay === overlay)[0];
        tab.tabItem.classList.toggle(ActiveTabHeaderClass, false);
        tab.contentItem.classList.toggle(ActiveTabContentClass, false);
    }

    public getOverlays() {
        return this._tabsRegistry.map(x => x.overlay);
    }
}