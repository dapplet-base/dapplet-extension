export default class {
    constructor(private methods: { [key: string]: Function }, private target: Window) {

        window.addEventListener('message', this._onMessage.bind(this));

        return new Proxy(this, {
            get: function (target, prop: string, receiver) {
                return (...args) => target._call(prop, args);
            }
        });
    }

    private _call(method: string, params: any[]) {
        return new Promise((res, rej) => {
            const id = this._generateUuid();
            const request = JSON.stringify({
                "jsonrpc": "2.0",
                "method": method,
                "params": params,
                "id": id
            });
            const listener = (e: MessageEvent<any>) => {
                if (e.source !== this.target) return; // Recieve response only from target
                try {
                    const json = JSON.parse(e.data);
                    if (typeof json === 'object' && json.id === id) {
                        if (json.error) {
                            rej(json.error.message);
                        } else {
                            res(json.result);
                        }
                        this.target.removeEventListener('message', listener);
                    }

                } catch (_) { }
            }
            window.addEventListener('message', listener);
            this.target.postMessage(request, '*');
        });
    }

    private async _onMessage(e: MessageEvent<any>) {
        try {
            const json = JSON.parse(e.data);
            if (typeof json === 'object' && json.id && json.method) {
                try {
                    if (this.methods[json.method] === undefined) {
                        const response = JSON.stringify({
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32601,
                                "message": "Method not found"
                            },
                            "id": json.id
                        });
                        this.target.postMessage(response, '*');
                        return;
                    }

                    const result = await Promise.resolve(this.methods[json.method].call({}, ...json.params));
                    const response = JSON.stringify({
                        "jsonrpc": "2.0",
                        "result": result,
                        "id": json.id
                    });
                    this.target.postMessage(response, '*');
                } catch (err) {
                    const response = JSON.stringify({
                        "jsonrpc": "2.0",
                        "error": {
                            "code": 0,
                            "message": err.message
                        },
                        "id": json.id
                    });
                    this.target.postMessage(response, '*');
                }

            }
        } catch (_) { }
    }

    private _generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}