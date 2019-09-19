var config = {
	'apiURL': process.env.apiURL || 'https://api.letswatch.video',
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
var fetch = require('node-fetch');

var app = httpServer.createServer();
RTCMultiConnectionServer.beforeHttpListen(app, config);
app = app.listen(config['port'], process.env.IP || '0.0.0.0', function(){
	RTCMultiConnectionServer.afterHttpListen(app, config);
});

// WebRTC Signaling Server
let rtc = ioServer(app).of('rtc');
rtc.on('connection', function (socket){
	const params = socket.handshake.query;

	socket.on('start-broadcasting', (args) => {
		console.log('start-broadcasting', args);
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
// Remote server
let remote = ioServer(app).of('remote');
remote.on('connection', function (socket){
	const params = socket.handshake.query;

	socket.use((socket, next) => {
		if(params && params.token){
			try{
				const response = await fetch(
					`${config.apiURL}/room/remote`,
					{
						body: {
							token: params.token
						}
					}
				);
				if(response.status === 200) next();
			}catch(error){
				console.log(error);
				next(new Error('Authentication error'));
			}
			
		}else{
			next(new Error('Authentication error'));
		}
	})
	.on('message', () => {
		// Send message to everyone but ourselves
		socket.broadcast.emit('message', message);
	})
});