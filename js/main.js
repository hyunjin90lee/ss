'use strict';

const localVideo = document.querySelector('#localvideo');
const remoteVideo = document.querySelector('#remotevideo');
const shareButton = document.querySelector('#shareButton');
const createButton = document.querySelector('#createButton');
const joinButton = document.querySelector('#joinButton');
const disconnectButton = document.querySelector('#disconnectButton');
const roomId = document.querySelector('#roomId');
const roomInfo = document.querySelector('#roomInfo');

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

function errorMsg(msg, error) {
    const errorElement = document.querySelector('#errorMsg');
    errorElement.innerHTML += `<p>${msg}</p>`;
    if (typeof error !== 'undefined') {
        console.error(error);
    }
}

function handleError(error) {
    errorMsg(`error: ${error.name}`, error);
}

let peerConnection;

async function onIceCandidate(pc, event) {
    try {
        await (getOtherPc(pc).addIceCandidate(event.candidate));
    } catch (e) {
        handleError(pc, e);
	}
}

function onIceStateChange(pc, event) {
    if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log('ICE state change event: ', event);
    }
}

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

async function createRoom() {
    createButton.disabled = true;
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
    roomInfo.innerHTML = `Current room is ${roomRef.id} - You are the caller!`;
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
            const rtcSessionDescription = new rtcSessionDescription(data.answer);
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
}

async function joinRoom() {
    const db = firebase.firestore();
    const targetRoom = roomId.value;
    const roomRef = db.collection('rooms').doc(targetRoom);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);
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
}
function gotDisplayMediaStream(streams) {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    shareButton.disabled = true;
    createButton.disabled = false;
    localStream = streams; // make stream available to console
    localVideo.srcObject = streams;
    localStream.getVideoTracks()[0].addEventListener('ended', () => {
        shareButton.disabled = false;
        start();
    });
}

function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({video: true})
    .then(gotDisplayMediaStream, handleError);
}

function gotUserMediaStream(streams) {
    createButton.disabled = false;
    localStream = streams; // make stream available to console
    localVideo.srcObject = streams;
    remoteStream = new MediaStream();
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
        .then(gotUserMediaStream).catch(handleError);
}

function init() {
    start();
    shareButton.addEventListener('click', shareScreen);
    createButton.addEventListener('click', createRoom);
    joinButton.addEventListener('click', joinRoom);
    disconnectButton.addEventListener('click', hangup);
}

init();
