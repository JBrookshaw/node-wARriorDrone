
var myApp = angular.module('myApp',[]);

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port:5555});
var videoCanvas = videoDiv.querySelector('canvas');
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
//var detect = detector({maxDiff: 0.7});
var pickedColor = [192,60,60];
var detected;
var client = new WsClient();

var xPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});
var yPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});
var zPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});

var track = document.getElementById('track');
track.width = 640;
track.height = 360;
var ctx = track.getContext("2d");
ctx.fillStyle = "#FF0000";

//options
var maxDiff = 0.20;
var w = videoCanvas.width;
var h = videoCanvas.height;
var b = frameBuffer;
var c = frameBuffer;
var averagePixel;
var count;
var lastCount;

//var testCtx = document.getElementById("test").getContext('2d');
//
//window.onload = function() {
//    var img = document.getElementById("test-img");
//    document.getElementById("test").getContext('2d').drawImage(img, 0, 0, 640,360);
//
//}
var img = document.getElementById('test-img');
var tstctx;
var imageData;
window.onload = function(){

    tstctx = document.getElementById('testCanvas').getContext('2d');
    tstctx.drawImage(img, 0, 0, img.width/2, img.height/2);
    imageData = tstctx.getImageData(0, 0, 640, 360);
    b = imageData.data;

}


myApp.controller('Controller', ['$scope', function($scope) {

    $scope.hi = 0;

    $scope.maxDiff = .1;

    $scope.state;
    setState('ground');



    setInterval(function(){
        ctx.clearRect ( 0 , 0 , w, h);
        $scope.maxDiff = $('#maxDiff').val();
        //b = frameBuffer;
        count = 0;
        var xSum = 0;
        var ySum = 0;
        //ns.getImageData(b);

        //b=.getImageData(0,0,640,360).data
        b = imageData.data;

        averagePixel = {r: 0, g: 0, b:0};
        for(var i =0; i < b.length; i+=4){

            var match = true;
            for (var j = 0; j < pickedColor.length; j++) {

                var diffPercent = Math.abs(b[i+j]-pickedColor[j]) / 255;
                if (diffPercent > $scope.maxDiff) {
                    match = false;
                    break;
                }
            }
            if (match) {
                count++;
                var y = i/(w*4);
                var x = i%(w*4)/4;
                xSum += x;
                ySum += Math.abs(y);
                ctx.fillStyle = "rgb("+b[i]+","+b[i+1]+","+b[i+2]+")";
                ctx.fillRect((x*2),(Math.abs(y)*2),1,1);
                // ctx.fillRect(y,x,1,1);

                //Used for color surfing
                averagePixel.r += b[i];
                averagePixel.g += b[i+1];
                averagePixel.b += b[i+2];
            }
        }
        averagePixel.r = Math.round(averagePixel.r/count);
        averagePixel.g = Math.round(averagePixel.g/count);
        averagePixel.b = Math.round(averagePixel.b/count);
        $scope.hi = averagePixel.r;
        detected = {x: xSum / count, y: ySum /count};
        //if(count > 200){
            if(averagePixel.r > pickedColor[0]){
                pickedColor[0]++;
            }else if(averagePixel.r < pickedColor[0]){ pickedColor[0]--;}
            if(averagePixel.g > pickedColor[1]){
                pickedColor[1]++;
            }else if(averagePixel.g < pickedColor[1]){ pickedColor[1]--;}
            if(averagePixel.b > pickedColor[2]){
                pickedColor[2]++;
            }else if(averagePixel.b < pickedColor[2]){ pickedColor[2]--;}

            lastCount = count;
            $('#pixelCount').html(lastCount);

        $('#rVal').html("r"+pickedColor[0]);
        $('#gVal').html("b"+pickedColor[1]);
        $('#bVal').html("g"+pickedColor[2]);
     //   }


        ctx.beginPath();
        ctx.moveTo(0,(detected.y*2));
        ctx.lineTo(640,(detected.y*2));
        ctx.moveTo((detected.x*2),0);
        ctx.lineTo((detected.x*2),360);
        ctx.strokeStyle = "black";//"rgb(255,255,255)";
        ctx.stroke();
        ctx.closePath();
        var xVal = (detected.x - w / 2)/(w / 2);
        // ctx.fillRect(detected.x,Math.abs(detected.y - h),5,5);
        console.log("|xVal: "+xVal+"|# Detected: "+count+"|X: "+Math.round(detected.x)+ "|Y: "+Math.round(detected.y)+"|AvgPixel: "+averagePixel.r);

    }, 100);

    //setInterval(function(){
    //    ctx.clearRect ( 0 , 0 , w, h);
    //
    //}, 200);

    var flightButton = document.getElementById('flight');
    flightButton.addEventListener('click', function() {

        if (this.textContent === 'Start') {
            setState('takeoff');
            client.takeoff(function() {
                setState('follow');
            });
            this.textContent = 'Stop';
        } else {
            setState('land');
            client.land(function() {
                setState('ground');
            });
            this.textContent = 'Start';
        }
    });

}]);


function PID(options) {
    this._pGain = options.pGain || 0;
    this._iGain = options.iGain || 0;
    this._dGain = options.dGain || 0;
    this._min = options.min || -1;
    this._max = options.max || 1;
    this._zero = options.zero || 0;
    this._p = 0;
    this._i = 0;
    this._d = 0;
    this._sum = 0;
    this._target = 0;
    this._sumErr = 0;
    this._lastErr = 0;
    this._lastTime = null;

}
PID.prototype.target = function(val) {
    if (val === undefined) {
        return this._target;
    }
    this._sumErr = 0;
    this._lastErr = 0;
    this._lastTime = null;
    this._sum = this._p = this._i = this._d = this._zero;
    this._target = val;
    return this._target;
};
PID.prototype.update = function(val) {
    var now = Date.now();
    var dt = 0;
    if (this._lastTime !== null) {
        dt = (now - this._lastTime) / 1000;
    }
    this._lastTime = now;
    var err = this._target - val;
    var dErr = (err - this._lastErr)*dt;
    this._sumErr += err * dt;
    this._lastErr = err;
    this._p = this._pGain*err;
    this._i = this._iGain*this._sumErr;
    this._d = this._dGain*dErr;
    this._sum = this._p+this._i+this._d;
    if (this._sum < this._min) {
        this._sum = this._min;
    } else if (this._sum > this._max) {
        this._sum = this._max;
    }
};
PID.prototype.pid = function() {
    return {p: this._p, i: this._i, d: this._d, sum: this._sum};
};

function setState(val) {
    console.log('new state: '+val);
    this.state = val;
}

function WsClient() {
    this._conn = null;
    this._connected = false;
    this._queue = [];
    this._listeners = {};
    this._takeoffCbs = [];
    this._landCbs = [];

    var self = this;
    self._conn = new WebSocket('ws://'+window.location.host);
    self._conn.onopen = function() {
        self._connected = true;
        self._queue.forEach(function(msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function(msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function(cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function(cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function(cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: '+kind);
            }
        };
    };

}

WsClient.prototype._connect = function() {
    var self = this;
    self._conn = new WebSocket('ws://'+window.location.host);
    self._conn.onopen = function() {
        self._connected = true;
        self._queue.forEach(function(msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function(msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function(cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function(cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function(cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: '+kind);
            }
        };
    };

};

WsClient.prototype._send = function(msg) {
    msg = JSON.stringify(msg);
    if (!this._connected) {
        this._queue.push(msg);
        return;
    }
    this._conn.send(msg);
};

WsClient.prototype.on = function(event, cb) {
    var cbs = this._listeners[event] = this._listeners[event] || [];
    cbs.push(cb);
    if (cbs.length === 1) {
        this._send(['on', event]);
    }
};

WsClient.prototype.takeoff = function(cb) {
    this._send(['takeoff']);
    if (cb) {
        this._takeoffCbs.push(cb);
    }
};

WsClient.prototype.land = function(cb) {
    this._send(['land']);
    if (cb) {
        this._landCbs.push(cb);
    }
};

WsClient.prototype.right = function(val) {
    this._send(['right', val]);
};

WsClient.prototype.stop = function() {
    this._send(['stop']);
};
var tstctx;
//Listeners//


$(function(){

    $('#video').hide();

    $('#testCanvas').mousemove(function(e) { // mouse move handler


        var canvasOffset = {left: 110, top:120};
        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);


        //ctx.readPixels(canvasX, canvasY, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, c);
        //ns.getImageData(c, canvasX, h-canvasY, 1, 1);

        var imageData = tstctx.getImageData((canvasX/2), ((canvasY)/2), 1, 1);
        var c = imageData.data;


        var pixelColor = "rgb("+c[0]+", "+c[1]+", "+c[2]+")";
        // console.log(pixelColor+"   "+canvasX+"   "+canvasY);
        $('#preview').css('background-color', pixelColor);
    });

    $('#testCanvas').click(function(e) { // mouse click handler
        c= frameBuffer;
        var canvasOffset = {left: 110, top:120};
        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);

        //ns.getImageData(c, canvasX, h-canvasY, 1, 1);

        var imageData = tstctx.getImageData((canvasX/2), ((canvasY)/2), 1, 1);
        var c = imageData.data;
        //var pixelColor = "rgba("+c[0]+", "+c[1]+", "+c[2]+", "+c[3]+")";
        pickedColor[0] = c[0];
        pickedColor[1] = c[1];
        pickedColor[2] = c[2];
        // alert(pixelColor);
        var pixelColor = "rgb("+pickedColor[0]+", "+pickedColor[1]+", "+pickedColor[2]+")";
        $('#pickedColor').css('background-color', pixelColor);

        //color info
        $('#rVal').html(c[0]);
        $('#gVal').html(c[1]);
        $('#bVal').html(c[2]);

        $('#rgbVal').val(c[0]+','+c[1]+','+c[2]);
        $('#rgbaVal').val(c[0]+','+c[1]+','+c[2]+','+c[3]);
        var dColor = c[2] + 256 * c[1] + 65536 * c[0];
        $('#hexVal').html( '#' + dColor.toString(16) );
    });

    $('#pickedColor').click(function(e) {

        $('#pixelCount').html(lastCount);


    });
    //g.prototype.getImageData = function (a, b, c, d, e) {
    //    var f = j.gl;
    //    f.readPixels(b || 0, c || 0, d || k, e || l, f.RGBA, f.UNSIGNED_BYTE, a)
    //}

});




