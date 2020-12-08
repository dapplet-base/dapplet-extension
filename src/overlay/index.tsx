import * as React from 'react';
import * as ReactDOM from 'react-dom';
//import semanticCss from '!!css-loader!semantic-ui-css/semantic.min.css';
import './index.css';
import { Overlay } from './components/Overlay';
import FrameRpc from '../common/frameRpc';

const rpc = new FrameRpc({
    greet2: name => `Hello ${name}!!!!!`
}, window.parent);

console.log('rpc frame', rpc);

ReactDOM.render(<Overlay />, document.querySelector('#app'));

// export default class {
//     private _ref: Overlay;

//     constructor() {
//         const wrapper = document.createElement('dapplets-overlay-manager-2')
//         const shadowRoot = wrapper.attachShadow({ mode: "open" })

//         //const styleContainer = document.createElement("style")
//         const hostStyle = document.createElement("style")
//         const appContainer = document.createElement("div")

//         hostStyle.textContent = css
//         //styleContainer.textContent = semanticCss;

//         //shadowRoot.appendChild(styleContainer)
//         shadowRoot.appendChild(hostStyle)
//         shadowRoot.appendChild(appContainer)

//         document.body.appendChild(wrapper)

//         ReactDOM.render(<Overlay ref={Overlay => { this._ref = Overlay }} />, appContainer);
//         console.log(this);
//     }

//     toggle = () => this._ref.toggle();
//     open = () => this._ref.open();
//     close = () => this._ref.close();
//     show = () => this._ref.show();
//     hide = () => this._ref.hide();
//     unregisterAll = () => this._ref.unregisterAll();

//     createTab = (url: string, title: string) => this._ref.createTab(url, title);
//     removeTab = (id: string) => this._ref.removeTab(id);
// }