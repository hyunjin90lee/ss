'use strict';

const localVideo = document.querySelector('#localvideo');
const remoteVideo = document.querySelector('#remotevideo');
const shareButton = document.querySelector('#shareButton');
const createButton = document.querySelector('#createButton');
const joinButton = document.querySelector('#joinButton');
const disconnectButton = document.querySelector('#disconnectButton');
const targetRoom = document.querySelector('#targetRoom');
const roomInfo = document.querySelector('#roomInfo');
const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');

const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
	iceCandidatePoolSize: 10,
};

let localStream;
let remoteStream;
let peerConnection;
let roomId;

function hangup() {
    console.log('Ending call');
    const tracks = localVideo.srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    shareButton.disabled = false;
    roomInfo.innerHTML = '';
    createButton.disabled = false;
    joinButton.disabled = false;
    disconnectButton.disabled = true;
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
          `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });
  
    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });
  
    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });
  
    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
          `ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

async function checkTargetRoom() {
    if (targetRoom.value.length > 0) {
        createButton.disabled = true;
        joinButton.disabled = false;
    } else {
        createButton.disabled = false;
        joinButton.disabled = true;
    }
}

async function createRoom() {
    createButton.disabled = true;
    joinButton.disabled = true;
    disconnectButton.disabled = false;
    const db = firebase.firestore();
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
    roomInfo.innerHTML = `Current room is ${roomRef.id} - You are a Host!`;
    peerConnection.addEventListener('track', event=>{
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
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

    loginDiv.classList.add('hidden');
    activeDiv.classList.remove('hidden');
    videosDiv.classList.remove('hidden');
}

async function joinRoom() {
    createButton.disabled = true;
    joinButton.disabled = true;
    disconnectButton.disabled = false;
    const db = firebase.firestore();
    roomId = targetRoom.value;
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);
    roomInfo.innerHTML = `You joined this room ${roomId} - You are an Attendee!`;
    if (roomSnapshot.exists) {
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
    }

    loginDiv.classList.add('hidden');
    activeDiv.classList.remove('hidden');
    videosDiv.classList.remove('hidden');
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
        start();
    });
}

function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({video: true})
    .then(gotDisplayMediaStream, (error) => {
        console.log("[Error] failed to share screen: ", error);
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

function start() {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    const constraints = {
        video: true,
        audio: true
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(gotUserMediaStream).catch((error) => {
            console.log("[Error] failed to get media: ", error);
        });
}

function init() {
    start();
    remoteStream = new MediaStream();
    shareButton.addEventListener('click', shareScreen);
    createButton.addEventListener('click', createRoom);
    targetRoom.addEventListener('input', checkTargetRoom);
    joinButton.addEventListener('click', joinRoom);
    disconnectButton.addEventListener('click', hangup);
}

init();
