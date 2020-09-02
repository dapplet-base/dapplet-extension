declare var google: any;

var actualCode = '(' + function () {

    window['google'] = new Proxy({}, {
        set: function (obj, prop, newval) {
            obj[prop] = typeof newval === 'object' ? new Proxy(newval, {
                set: function (obj, prop, newval) {
                    if (prop === 'Map') {
                        var extend = function (cls) {
                            function foo() {
                                cls.apply(this, arguments);
                                console.log('new Map instanced', this);
                                var marker = new google.maps.Marker({
                                    position: this.getCenter(), 
                                    map: this,
                                    label: 'Hello from Dapplets!'
                                });
                                google.maps.event.addListener(marker, 'click', () => alert('Hello!'));
                            }
                            
                            foo.prototype = Object.create(cls.prototype);
                            return foo;
                        };

                        var newType = extend(newval);
                        obj[prop] = newType;
                    } else {
                        obj[prop] = newval;
                    }

                    return true;
                }
            }) : newval;
            return true;
        }
    });

} + ')();';

var script = document.createElement('script');
script.textContent = actualCode;
(document.head || document.documentElement).appendChild(script);
script.remove();