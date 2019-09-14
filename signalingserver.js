var config = {
	'socketURL': '/',
	'dirPath': '',
	'homePage': '/',
	'socketMessageEvent': 'letswatch',
	'socketCustomEvent': 'letswatch',
	'port': 8432,
	'enableLogs': true,
	'isUseHTTPs': false,
	'enableAdmin': false,
	'streamToken': process.env.streamToken || 'correcthorsebatterystaple'
};

var httpServer = require('http');
var RTCMultiConnectionServer = require('rtcmulticonnection-server');
var ioServer = require('socket.io');

var app = httpServer.createServer();
RTCMultiConnectionServer.beforeHttpListen(app, config);
app = app.listen(config['port'], process.env.IP || '0.0.0.0', function(){
	RTCMultiConnectionServer.afterHttpListen(app, config);
});

// --------------------------
// socket.io codes goes below

ioServer(app).on('connection', function (socket){
	const params = socket.handshake.query;

	socket.on('start-broadcasting', (args) => {
		console.log(arguments);
		// Extra checks to only let the electron server stream
		// If there is a streamToken, validate it
		if(params.streamToken){
			// TODO: dynamic stream token (different for each room)
			// This is in case someone gets access to the electron code
			if(params.streamToken !== config.streamToken) socket.disconnect(true);
		}else{ // ok, no streamToken provided, close the socket before RTC takes care of it
			socket.disconnect(true);
		}
		delete socket.handshake.query.streamToken;
		socket.emit('start-broadcasting', args);
	})

	RTCMultiConnectionServer.addSocket(socket, config);

	if(!params.socketCustomEvent){
		params.socketCustomEvent = config.socketCustomEvent;
	}

	socket.on(params.socketCustomEvent, function(message){
		socket.broadcast.emit(params.socketCustomEvent, message);
	});
});