import * as React from "react";
import { Dropdown, Icon } from 'semantic-ui-react';
import { Bus } from '../../common/bus';



interface Props {

}

interface State {
  collapsed: boolean;
  hidden: boolean;
  tabs: {
    id: string,
    url: string,
    title: string
  }[];
  activeTabId: string;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class Overlay extends React.Component<Props, State> {
  private bus = new Bus();

  constructor(props) {
    super(props);

    this.state = {
      collapsed: true,
      hidden: false,
      tabs: [],
      activeTabId: null
    };

    setTimeout(() => {
      this.createTab("chrome-extension://ogcojbmjgfbdhgoedagklhoginpblbon/pairing.html", 'Wallet');
    }, 1000)

    this.bus.subscribe('createTab', this.createTab.bind(this));    
  }

  toggle = () => this.setState({ collapsed: !this.state.collapsed });
  open = () => this.setState({ collapsed: false });
  close = () => this.setState({ collapsed: true });
  show = () => this.setState({ hidden: false });
  hide = () => this.setState({ hidden: true });
  unregisterAll = () => this.setState({ tabs: [] });

  createTab = (urlString: string, title: string): string => {
    const s = this.state;
    const id = uuidv4();

    // disable cache
    const url = new URL(urlString);
    if (url.protocol !== 'blob:') {
      url.searchParams.set('_dc', Date.now().toString());
    }

    s.tabs.push({ id, url: url.href, title });

    this.setState({
      tabs: s.tabs,
      activeTabId: s.activeTabId ?? id
    });

    return id;
  }

  removeTab = (id: string, e?: any) => {
    if (e) {
      e.cancelBubble = true;
      e.stopPropagation();
    }

    const s = this.state;
    const tabs = s.tabs.filter(x => x.id !== id);
    this.setState({ tabs });

    if (s.activeTabId === id) {
      const newId = tabs.length === 0 ? null : tabs[tabs.length - 1].id;
      this.setActiveTab(newId);
    }
  }

  setActiveTab = (id: string) => {
    this.setState({ activeTabId: id });
  }

  onFrameLoadHandler = (id: string) => {
    /*
      this._isFrameLoaded = true;
      this._queue.forEach(msg => this._send(msg));
      this._queue = [];
    */
  }

  render() {
    const s = this.state;

    return (
      <>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css" />
        {/* <div className={`dapplets-overlay-frame dapplets-overlay-outer ${s.collapsed ? 'dapplets-overlay-collapsed ' : ''} ${s.hidden || s.activeTabId === null ? 'dapplets-overlay-hidden ' : ''}`}>
          <div className="dapplets-overlay-bucket-bar"></div>
          <div className="dapplets-overlay-toolbar">
            <ul>
              <li>
                <button
                  title="Toggle Overlay"
                  className="dapplets-overlay-frame-button dapplets-overlay-frame-button-sidebar-toggle"
                  onClick={() => this.toggle()}
                >⇄</button>
              </li>
            </ul>
          </div> */}
          <div className="dapplets-overlay-nav">
            <div className="dapplets-overlay-nav-tab-list" style={{ display: 'flex' }}>
              <div style={{ flex: 'auto' }}>
                {s.tabs.map(x => <div key={x.id} className={`dapplets-overlay-nav-tab-item ${s.activeTabId === x.id ? 'dapplets-overlay-nav-tab-item-active' : ''}`} onClick={() => this.setActiveTab(x.id)}>
                  <div title={x.title} className="dapplets-overlay-nav-tab-item-title">{x.title}</div>
                  <div className="dapplets-overlay-nav-tab-item-close-btn" onClick={(e) => this.removeTab(x.id, e)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4 16 16" style={{ width: '10px' }}>
                      <path d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
                    </svg>
                  </div>
                </div>)}
              </div>
              <div style={{ width: '65px' }}>
                
                <Dropdown pointing icon={null} trigger={
                  <img style={{ width: '24px', margin: '3px 0' }} src='https://pbs.twimg.com/profile_images/814615689868836864/cyMqCC1B_bigger.jpg'></img>
                }>
                  <Dropdown.Menu>
                    <Dropdown.Item text='Logout' />
                  </Dropdown.Menu>
                </Dropdown>
                <Dropdown pointing icon={null} trigger={
                  <Icon name='bars' size='large'/>
                }>
                  <Dropdown.Menu>
                    <Dropdown.Item text='Dapplets' />
                    <Dropdown.Item text='Events' />
                    <Dropdown.Item text='Wallets' />
                    <Dropdown.Item text='Settings' />
                    <Dropdown.Item text='Developer' />
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>
            <div className="dapplets-overlay-nav-content-list">
              {s.tabs.map(x => <div key={x.id} className={`dapplets-overlay-nav-content-item ${s.activeTabId === x.id ? 'dapplets-overlay-nav-content-item-active' : ''}`}>
                <iframe
                  allow="clipboard-write"
                  allowFullScreen={true}
                  src={x.url}
                  onLoad={() => this.onFrameLoadHandler(x.id)}
                ></iframe>
              </div>)}
            </div>
          </div>
        {/* </div> */}
      </>
    );
  }
};