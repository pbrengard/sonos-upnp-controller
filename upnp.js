var http = require('http');
var url = require('url');
var parseString = require('xml2js').parseString;


var request = function(url_str, done) {
  var m;
  if (!(m = url_str.match(/^http:\/\/([^\/]+)(.*)/))) {
    throw "Invalid URL";
  }
  http.get(url_str, function(res) {
    var str = '';
    res.on('data', function(c) {
      str += c;
    });
    return res.on('end', function() {
      res.body = str;
      done(res);
    });
  });
};

String.prototype.endsWith = function (s) {
  return this.length >= s.length && this.substr(this.length - s.length) == s;
}

var recurse_xml = function(node, obj) {
    for(var n in node) {
        if(n.endsWith('List')) {
            obj[n] = new Array();
            // xml2js is completely wrong with lists,
            // trying to sort that out
            for(var k in node[n][0]) {
                for(var j in node[n][0][k]) {
                    for(var i in node[n][0][k]) {
                        obj[n][i] = {};
                        obj[n][i][k] = {};
                        recurse_xml(node[n][0][k][i], obj[n][i][k]);
                    }
                }
            }
        } else {
            obj[n] = node[n][0];
        }
    }
}

desc_cache = {};

exports.get_location_description = function(location, usn, next) {
    if(desc_cache[usn]) {
        next(desc_cache[usn]);
    } else {
        request(location, function(res) {
            parseString(res.body, function (err, result) {
                var desc = {}
                recurse_xml(result.root.device[0], desc);
                if( desc.UDN != usn ) {
                    console.error("USN and UDN do not match!");
                }
                desc_cache[usn] = desc;
                next(desc);
            });
        });
    }
};

/*****************************************************************************/
// SOAP related methods
var SOAPEnvelope = function(body) {
    return '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'+body+'</s:Body></s:Envelope>';
}

/*****************************************************************************/
// UPnPService

UPnPService = function(control_point, desc) {
    this.control_point = control_point;
    this.desc = desc;
}

UPnPService.prototype = {
    
    type: function() {
        return this.desc.serviceType;
    },
    controlURL: function() {
        return this.desc.controlURL;
    },
    
    applyAction: function(action, parameters, next) {
        //'<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>{volume}</DesiredVolume></u:SetVolume>'
        var body = '<u:'+action+' xmlns:u="'+this.type()+'">';
        for(var i in parameters) {
            body += '<'+i+'>'+parameters[i]+'</'+i+'>';
        }
        body += '</u:'+action+'>';
        
        var soap_action = this.type() + '#'+action;
        var b = SOAPEnvelope(body);
        
        var headers = {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPACTION': soap_action,
            'Content-Length': b.length,
        }
        var options = {
            //host: this.control_point.host,
            hostname: '192.168.0.16',
            port: 1400,
            method: 'POST',
            path: this.controlURL(),
            headers: headers,
        }
        console.dir(options);
        var req = http.request( options, function(res) {
            res.on('data', function (chunk) {
                console.log('BODY: ' + chunk);
            });
            next(null, true);
        });
        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            next(e, false);
        });
        
        
        req.write(b);
        console.dir(req);
        req.end();
    },
}

exports.UPnPService = UPnPService;

/*****************************************************************************/
// ControlPoint

var control_points = {};

exports.getControlPoint = function(udn) {
    if(control_points[udn]) {
        return control_points[udn]
    }
    return undefined;
}

exports.ControlPointFactory = {};

ControlPoint = function(host, desc) {
    this.desc = desc;
    this.host = host;
    if( desc.UDN ) {
        control_points[desc.UDN] = this;
    }
}

ControlPoint.create = function(host, desc) {
    if( !desc || !desc.UDN ) {
        return null;
    }
    var regex_type = /^urn:schemas-upnp-org:device:([^:]+):/;
    var match_type = regex_type.exec(desc.deviceType);
    var type = match_type[1];
    if(type && exports.ControlPointFactory[type]) {
        return new exports.ControlPointFactory[type](host, desc);
    } else {
        return new ControlPoint(host, desc);
    }
}

ControlPoint.prototype = {
    
    UDN: function() {
        return this.desc.UDN;
    },
    
    modelName: function() {
        return this.desc.modelName;
    },
    
    icon: function() {
        return url.resolve(this.host, this.desc.iconList[0].icon.url)
    },
    
    services: function() {
        var list = [];
        if( this.desc.serviceList ) {
            for(i in this.desc.serviceList) {
                list.push(new UPnPService(this, this.desc.serviceList[i].service));
            }
        }
        return list;
    },
    
    getService: function(service_id) {
        if( this.desc.serviceList ) {
            for(var i in this.desc.serviceList) {
                if( this.desc.serviceList[i].service && this.desc.serviceList[i].service.serviceId ) {
                    var regex_id = /^.*:([^:]+)$/;
                    var match_id = regex_id.exec(this.desc.serviceList[i].service.serviceId);
                    if(match_id[1] && match_id[1] == service_id){
                        return new UPnPService(this, this.desc.serviceList[i].service);
                    }
                }
            }
        }
        return null;
    },
    
    devices: function() {
        var list = []
        if( this.desc.deviceList ) {
            for(var i in this.desc.deviceList) {
                list.push(ControlPoint.create(this.host, this.desc.deviceList[i].device));
            }
        }
        return list;
    },
    
    type: function() {
        var regex_type = /^urn:schemas-upnp-org:device:([^:]+):/;
        var match_type = regex_type.exec(this.desc.deviceType);
        return match_type[1];
    }
}

exports.ControlPoint = ControlPoint;

