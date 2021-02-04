'use strict';

const localVideo = document.querySelector('#localvideo');
const remoteVideo = document.querySelector('#remotevideo');
const shareButton = document.querySelector('#shareButton');
const createButton = document.querySelector('#createButton');
const joinButton = document.querySelector('#joinButton');
const disconnectButton = document.querySelector('#disconnectButton');
const targetRoom = document.querySelector('#targetRoom');
const targetRoomLabel = document.querySelector('#targetRoom-label');
const roomInfo = document.querySelector('#roomInfo');
const noticeInfo = document.querySelector('#noticeInfo');
const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');
const roomSelectionDiv = document.querySelector('#room-selection');
const previewDiv = document.querySelector('#preview-div');
const connectDeviceButton = document.querySelector('#connect-device');
const shareScreenButton = document.querySelector('#share-screen');
const meetNowButton = document.querySelector('#meet-now');

/* for DB */
const db = firebase.firestore();

const configuration = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
                "stun:stun.ekiga.net",
                "stun:stun.ideasip.com",
                "stun:stun.rixtelecom.se",
                "stun:stun.schlund.de",
                "stun:stun.stunprotocol.org:3478",
                "stun:stun.voiparound.com",
                "stun:stun.voipbuster.com",
                "stun:stun.voipstunt.com",
                "stun:stun.voxgratia.org"
            ],
        },
    ],
	iceCandidatePoolSize: 10,
};

let localStream;
let remoteStream;
let peerConnection;
let roomId;

let isCaller = false;

function callee_free(roomRef) {
    roomRef.collection('calleeCandidates').get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        roomRef.update({
            answer: firebase.firestore.FieldValue.delete()
        });
    });
    console.log('callee_free done');
}

function caller_free(roomRef) {
    roomRef.collection('callerCandidates').get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        roomRef.update({
            offer: firebase.firestore.FieldValue.delete()
        });
        roomRef.delete();
    });
    console.log('caller_free done');
}

async function resource_free() {
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnapshot = await roomRef.get();
    if (roomSnapshot.exists) {
        callee_free(roomRef);
        if (isCaller) {
            caller_free(roomRef);
        }
    } else {
        console.log(`room ${roomId} already No exist`);
    }
    console.log('resource_free done');
}

async function hangup() {
    console.log('Ending call');
    const tracks = localVideo.srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    if (remoteStream && remoteStream.getTracks()) {
	console.log("Stop remote tracks. Size: " + remoteStream.getTracks().length);
        remoteStream.getTracks().forEach(track => track.stop());
	remoteStream = new MediaStream(); // TODO: remove
    }
    if (peerConnection) {
        peerConnection.close();
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    shareButton.disabled = false;
    roomInfo.innerHTML = '';
    noticeInfo.innerHTML = '';
    createButton.disabled = false;
    joinButton.disabled = false;
    disconnectButton.disabled = true;

    /* TODO : fix the name and structure */
    resource_free();
    hideMeetingRoom();
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
          `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });
  
    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState == "disconnected") {
            noticeInfo.innerHTML = 'Peer disconnected!! '
        }
    });
  
    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });
  
    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
          `ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

function checkTargetRoom() {
    var roomNumber = targetRoom.value;

    if (roomNumber.length > 0) {
        createButton.disabled = true;

        var re = /^[a-zA-Z0-9]+$/;
        var valid = (roomNumber.length == 20) && re.exec(roomNumber);

        if (valid) {
            joinButton.disabled = false;
            targetRoomLabel.classList.add('hidden');
        } else {
            joinButton.disabled = true;
            targetRoomLabel.classList.remove('hidden');
        }
    } else {
        createButton.disabled = false;
        joinButton.disabled = true;
    }
}

function hideMeetingRoom() {
    meetNowButton.disabled = false;
    show_(loginDiv);
    hide_(videosDiv);
    hide_(previewDiv);
    hide_(activeDiv);
}

function showMeetingRoom() {
    meetNowButton.disabled = true;
    hide_(loginDiv);
    show_(videosDiv);
    show_(previewDiv);
    show_(activeDiv);
}

async function createRoom() {
    isCaller = true;
    createButton.disabled = true;
    joinButton.disabled = true;
    disconnectButton.disabled = false;
    hide_(loginDiv);
    show_(videosDiv);
    show_(previewDiv);
}

async function joinRoom() {
    createButton.disabled = true;
    joinButton.disabled = true;
    disconnectButton.disabled = false;
    hide_(loginDiv);
    show_(videosDiv);
    show_(previewDiv);
}

async function onMeetNow() {
    hide_(previewDiv);
    if (isCaller) {
        const roomRef = await db.collection('rooms').doc();
        peerConnection = new RTCPeerConnection(configuration);
        registerPeerConnectionListeners();
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        const callerCandidatesCollection = roomRef.collection('callerCandidates');
        peerConnection.addEventListener('icecandidate', event => {
            if (!event.candidate) {
                console.log('Got final candidate!');
                return;
            }
            console.log('Got candidate: ', event.candidate);
            callerCandidatesCollection.add(event.candidate.toJSON());
        });
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Created offer: ', offer);
        const roomWithOffer = {
            'offer': {
                type: offer.type,
                sdp: offer.sdp,
            },
        };
        await roomRef.set(roomWithOffer);
        roomId = roomRef.id;
        console.log(`New room created with SDP offer. ROom ID: ${roomRef.id}`);
        roomInfo.innerHTML = `Current room is ${roomRef.id}. You are a Host!`;
        noticeInfo.innerHTML = "Press [Disconnect] button at first, and then exit the app";
        peerConnection.addEventListener('track', event=>{
            console.log('Got remote track:', event.streams[0]);
            event.streams[0].getTracks().forEach(track => {
                console.log('Add a track to the remoteStream:', track);
		// TODO: remove ---
		remoteVideo.srcObject = remoteStream;
		// --- Test
                remoteStream.addTrack(track);
            });
        });
        roomRef.onSnapshot(async snapshot => {
            const data = snapshot.data();
            if (!peerConnection.currentRemoteDescription && data && data.answer) {
                console.log('Got remote description: ', data.answer);
                const rtcSessionDescription = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(rtcSessionDescription);
            }
        });
        roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type == 'added') {
                    let data = change.doc.data();
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
        showMeetingRoom();
    } else {
        roomId = targetRoom.value;
        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnapshot = await roomRef.get();
        console.log('Got room:', roomSnapshot.exists);

         if (roomSnapshot.exists) {
            roomInfo.innerHTML = `You joined this room ${roomId} - You are an Attendee!`;
            noticeInfo.innerHTML += "Press [Disconnect] button at first, and then exit the app";
            console.log('Create PeerConnection with configuration: ', configuration);
            peerConnection = new RTCPeerConnection(configuration);
            registerPeerConnectionListeners();
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
            peerConnection.addEventListener('icecandidate', event => {
                if (!event.candidate) {
                    console.log('Got final candidate!');
                    return;
                }
                console.log('Got candidate: ', event.candidate);
                calleeCandidatesCollection.add(event.candidate.toJSON());
            });
            peerConnection.addEventListener('track', event => {
                console.log('Got remote track:', event.streams[0]);
                event.streams[0].getTracks().forEach(track => {
                    console.log('Add a track to the remoteStream:', track);
		    // TODO: remove ---
		    remoteVideo.srcObject = remoteStream;
		    // --- Test
                    remoteStream.addTrack(track);
                });
            });
            const offer = roomSnapshot.data().offer;
            console.log('Got offer:', offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            console.log('Created answer:', answer);
            await peerConnection.setLocalDescription(answer);
            const roomWithAnswer = {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp,
                },
            };
            await roomRef.update(roomWithAnswer);
            roomRef.collection('callerCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        let data = change.doc.data();
                        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                    }
                });
            });
            showMeetingRoom();
        } else {
            roomInfo.innerHTML = `You cannot join this room ${roomId} - It's not exists`;
        }
    }
}



function gotDisplayMediaStream(streams) {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    shareButton.disabled = true;
    createButton.disabled = false;
    joinButton.disabled = false;
    localStream = streams; // make stream available to console
    localVideo.srcObject = streams;
    remoteVideo.srcObject = remoteStream;
    localStream.getVideoTracks()[0].addEventListener('ended', () => {
        shareButton.disabled = false;
        onConnectDevice();
    });
}

function onShareScreen() {
    navigator.mediaDevices.getDisplayMedia({video: true})
    .then(gotDisplayMediaStream, (error) => {
        console.log("[Error] failed to share screen, name: " + error.name + ", message: " + error.message);
    });
}

function gotUserMediaStream(streams) {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    createButton.disabled = false;
    joinButton.disabled = false;
    localStream = streams; // make stream available to console
    localVideo.srcObject = streams;
    remoteVideo.srcObject = remoteStream;
}

function onConnectDevice() {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    const constraints = {
        video: true,
        audio: true
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(gotUserMediaStream).catch((error) => {
            console.log("[Error] failed to get media, name: " + error.name + ", message: " + error.message);
        });
}

function hide_(element) {
    element.classList.add('hidden');
};

function show_(element) {
    element.classList.remove('hidden');
}

function onVisibilityChange() {
    if (document.visibilityState === 'prerender') {
        return;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    init();
}

function init() {
    if (document.visibilityState === 'prerender') {
        document.addEventListener('visibilitychange', onVisibilityChange);
        return;
    }
    show_(roomSelectionDiv);
    remoteStream = new MediaStream();
    createButton.addEventListener('click', createRoom);
    targetRoom.addEventListener('input', checkTargetRoom);
    joinButton.addEventListener('click', joinRoom);
    disconnectButton.addEventListener('click', hangup);
    connectDeviceButton.addEventListener('click', onConnectDevice);
    shareScreenButton.addEventListener('click', onShareScreen);
    meetNowButton.addEventListener('click', onMeetNow);
}

init();
