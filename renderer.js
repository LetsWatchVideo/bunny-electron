let io = require('socket.io-client');
let RTCMultiConnection = require('rtcmulticonnection');
let { desktopCapturer } = require('electron');
require('webrtc-adapter');

var connection = new RTCMultiConnection();

connection.iceServers = [{
    'urls': [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.l.google.com:19302?transport=udp',
    ]
}];

connection.enableScalableBroadcast = true;
connection.maxRelayLimitPerUser = 1;
connection.autoCloseEntireSession = true;
//connection.socketURL = 'http://ws.letswatch.video/';
connection.socketURL = 'http://localhost:8432/';
connection.socketMessageEvent = 'letswatch';

connection.socketCustomParameters = '&streamToken='+ config.streamToken + '&extra=' + JSON.stringify(connection.extra);
connection.userid = 'streamer';

connection.mediaConstraints = {
    screen: {
        width: 1920,
        height: 1080,
        frameRate: 30
    },
    video: {
        mandatory: {
            chromeMediaSource: 'desktop',
            maxWidth: 1920,
            maxHeight: 1080
        }
    },
    audio: {
        mandatory: {
          chromeMediaSource: 'desktop'
        },
        echoCancellation: false,
        googEchoCancellation: false,
        googAutoGainControl: false,
        googAutoGainControl2: false,
        googNoiseSuppression: false,
        googHighpassFilter: false
    }
};

connection.onstreamended = function(event){};
connection.onleave = function(event){};

function startBroadcast(broadcastId){
    connection.session = {
        audio: true,
        video: true,
        oneway: true
	};
	connection.extra = {
		broadcastId
	};
    connection.getSocket(function(socket){
        console.log(broadcastId);
        socket.emit('check-broadcast-presence', broadcastId, function(isBroadcastExists){
            console.log('hi3', arguments);
            if(!isBroadcastExists){
				socket.emit('start-broadcasting', {
					broadcastId: connection.extra.broadcastId,
					userid: connection.userid,
					typeOfStreams: connection.session
				});
			}
        });
    });
};
startBroadcast(config.broadcastId);

connection.connectSocket(function(socket){
    console.log('connectSocket');
    socket.on('broadcast-stopped', function(broadcastId){
        console.error('broadcast-stopped', broadcastId);
    });
    // this event is emitted when a broadcast is absent.
    socket.on('start-broadcasting', function(typeOfStreams){
        console.log('start-broadcasting', typeOfStreams);
        // host i.e. sender should always use this!
        connection.sdpConstraints.mandatory = {
            OfferToReceiveVideo: false,
            OfferToReceiveAudio: false
        };
        connection.isInitiator = true;
        console.log(typeOfStreams, config);
        connection.session = typeOfStreams;
        connection.checkPresence(config.broadcastId, function(isRoomExists, roomid, error){
        
            if(isRoomExists === false){
                connection.open(roomid);
                desktopCapturer.getSources({
                        types: ['screen']
                    })
                    .then(async sources => {
                        console.log(sources);
                        navigator.mediaDevices.getUserMedia(config.mediaConstraints)
                            .then(function(stream){
                                console.log('stream', stream);
                                handleStream(stream);
                                connection.addStream(stream);
                            })
                            .catch(console.error);
                    })
                    .catch(console.error);
            }
        });
    });
});

function handleStream(stream){
    const video = document.querySelector('video')
    video.srcObject = stream
    video.muted = true
    video.onloadedmetadata = (e) => video.play()  
 }