var http = require("http"),
    drone = require("dronestream");

var staticDir = 'src',
    check = new RegExp('^/' + staticDir, 'i'),
    check2 = new RegExp('^/bower_components', 'i'),
    check3 = new RegExp('^/node_modules', 'i'),
    dist = ".";

var server = http.createServer(function(req, res) {
    require("fs").createReadStream(__dirname + "/index.html").pipe(res);
});

oldHandlers = server.listeners('request').splice(0);
server.removeAllListeners('request');

server.on('request', function (req, res) {
    var i = 0;
    if (handler(req, res)) {
        return;
    }

    for (; i < oldHandlers.length; ++i) {
        oldHandlers[i].call(server, req, res);
    }
});

function handler(req, res, next) {
    var path, read;
    if (!check.test(req.url) && !check2.test(req.url) && !check3.test(req.url)) {
        return false;
    }
    path = dist + req.url;
    console.log('checking static path: %s', path);
    read = require('fs').createReadStream(path);
    read.pipe(res);
    read.on('error', function (e) {
        console.log('Stream error: %s', e.message);
    });

    return true;
}


drone.listen(server);
server.listen(5555);

