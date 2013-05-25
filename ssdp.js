var dgram = require('dgram');


exports.discover_device = function(device, next) {
    var s = dgram.createSocket('udp4');
    s.bind(1900, '0.0.0.0', function() {
        s.setMulticastTTL(2);
        // Only one is treated. I have only one ZonePlayer and cannot test with multiple ones.
        s.on("message", function (msg, rinfo) {
            //console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
            var regex_st = new RegExp("ST: urn:schemas-upnp-org:device:"+device+":1")
            if(regex_st.exec(msg)) {
                var regex_loc = /LOCATION: (.+)/;
                var match_loc = regex_loc.exec(msg);
                
                var regex_usn = /USN: (.+)/;
                var match_usn = regex_usn.exec(msg);
                var usn = usn = match_usn[1];
                if( match_usn[1].indexOf('::') != -1 ) {
                    usn = match_usn[1].substring(0, match_usn[1].indexOf('::'));
                }
                s.close();
                
                next(rinfo.address, match_loc[1], usn );
            }
        });
        var player_search = new Buffer(
            "M-SEARCH * HTTP/1.1\r\n" +
            "HOST: 239.255.255.250:reservedSSDPport\r\n" +
            "MAN: ssdp:discover\r\n" +
            "MX: 1\r\n" +
            "ST: urn:schemas-upnp-org:device:"+device+":1\r\n"
        );
        s.send(player_search, 0, player_search.length, 1900, '239.255.255.250');
    });
};
