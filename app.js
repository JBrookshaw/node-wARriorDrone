var http = require("http"),
    drone = require("dronestream"),
    ws = require("ws"),
    cli = require("ar-drone").createClient();
    //keypress = require("keypress");

//Turns on all nav data
//cli.config('general:navdata_demo', 'FALSE');
cli.config('video:video_channel', 0);
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

var wsServer = new ws.Server({server: server});
wsServer.on('connection', function(conn) {
    function send(msg) {
        conn.send(JSON.stringify(msg));
    }
    var cameraMode = 0;
    conn.on('message', function(msg) {
        try {
            msg = JSON.parse(msg);
        } catch (err) {
            console.log('err: '+err+': '+msg);
        }
        var kind = msg.shift();
        switch (kind) {
            case 'on':
                var event = msg.shift();
                cli.on(event, function(data) {
                    send(['on', event, data]);
                });
                break;
            case 'takeoff':
                cli.takeoff(function() {
                    send(['takeoff']);
                });
                break;
            case 'land':
                cli.land(function() {
                    send(['land']);
                });
                break;
            case 'right':
                cli.right(msg[0]);
                break;
            case 'up':
            cli.up(msg[0]);
            break;
            case 'clockwise':
                cli.clockwise(msg[0]);
                break;
            case 'front':
                cli.front(msg[0]);
                break;
            case 'stop':
                cli.stop();
                break;
            case 'camera':
                if(cameraMode==0) {
                    cli.config('video:video_channel', 3);
                    cameraMode=3;
                } else {
                    cli.config('video:video_channel', 0);
                    cameraMode=0;
                }

                break;
            default:
                console.log('unknown msg: '+kind);
                break;
        }
    });
});
//keypress(process.stdin);
//
//process.stdin.on('keypress', function (ch, key) {
//
//    if (key && key.name == 'space') {
//        console.log('Takeoff!');
//        cli.takeoff();
//    }
//
//    if (key && key.name == 'l') {
//        console.log('Land!');
//        cli.stop(); // stop moving before landing
//        cli.land();
//    }
//
//    if (key && key.ctrl && key.name == 'c') {
//        console.log('Quitting')
//        process.stdin.pause();
//
//        // Land the drone incase it's flying
//        cli.stop();
//        cli.land();
//
//        // close the connection to the drone
//        // stops your process hanging
//        client._udpControl.close();
//    }
//
//});
//
////process.stdin.setRawMode(true);
//process.stdin.resume();

drone.listen(5555);
server.listen(3000);

