var http = require('http');
var url = require('url');
var parseString = require('xml2js').parseString;
var ssdp = require('./ssdp.js');
var upnp = require('./upnp.js');

/*****************************************************************************/
// ZonePlayer class, derived from upnp.ControlPoint

Inhertance_ZonePlayer = {};

Inhertance_ZonePlayer.extend = function(subClass, baseClass) {
    function inheritance() {}
    inheritance.prototype = baseClass.prototype;
    subClass.prototype = new inheritance();
    subClass.prototype.constructor = subClass;
    subClass.baseConstructor = baseClass;
    subClass.superClass = baseClass.prototype;
}

ZonePlayer = function(host, desc) {
    ZonePlayer.baseConstructor.call(this, host, desc);
}

Inhertance_ZonePlayer.extend(ZonePlayer, upnp.ControlPoint);

upnp.ControlPointFactory['ZonePlayer'] = ZonePlayer;

/*****************************************************************************/
// MediaRenderer class, derived from upnp.ControlPoint

Inhertance_MediaRenderer = {};

Inhertance_MediaRenderer.extend = function(subClass, baseClass) {
    function inheritance() {}
    inheritance.prototype = baseClass.prototype;
    subClass.prototype = new inheritance();
    subClass.prototype.constructor = subClass;
    subClass.baseConstructor = baseClass;
    subClass.superClass = baseClass.prototype;
}

MediaRenderer = function(host, desc) {
    MediaRenderer.baseConstructor.call(this, host, desc);
}

Inhertance_MediaRenderer.extend(MediaRenderer, upnp.ControlPoint);

upnp.ControlPointFactory['MediaRenderer'] = MediaRenderer;

/*****************************************************************************/


exports.discoverMediaRenderer = function (next) {
    ssdp.discover_device( "ZonePlayer", function(ip, location, usn) {
        upnp.get_location_description(location, usn, function(desc) {
            var zp = upnp.getControlPoint(usn);
            if(!zp) {
                var base_url = url.parse(location).host;
                zp = ControlPoint.create(base_url, desc);//new ZonePlayer(base_url, desc);
            }
            var devices = zp.devices();
            var media_renderer;
            for(i in devices) {
                if(devices[i].type() == 'MediaRenderer') {
                    media_renderer = devices[i];
                    break;
                }
            }
            if( !media_renderer ) {
                next(new Error("MediaRenderer not found"));
            } else {
                next(null, media_renderer.UDN(), media_renderer.modelName(), media_renderer.icon());
            }
        });
    });
};
