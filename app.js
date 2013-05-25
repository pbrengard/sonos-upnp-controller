var express = require('express');

var upnp = require('./upnp.js');
var sonos = require('./sonos.js');

/*
ssdp.discover( function(ip, location) {
    console.log(ip);
    console.log(location);
});
*/


var app = express();



function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}

app.use(errorHandler);

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
    sonos.discoverMediaRenderer( function(err, usn, name, icon) {
        if(err) {
            res.render('no_rendering_control.ejs');
        } else {
            res.render('rendering_control.ejs', {name: name, icon: icon, usn: usn});
        }
    });
});

app.post('/device/:device/service/:service/:action', function(req, res, next) {
    var device = upnp.getControlPoint(req.params.device);
    if( !device) {
        res.send('Device not found');
        return;
    }
    
    var service = device.getService(req.params.service);
    if(!service) {
        res.send('Service not found');
        return;
    }
    
    var result = service.applyAction(req.params.action, req.body, function(error, result){
        if(error || !result){
            res.send("Failed");
        } else {
            res.send("OK");
        }
    });
});

app.listen(8080);
