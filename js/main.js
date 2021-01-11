'use strict';

const localVideo = document.querySelector('#localvideo');
const remoteVideo = document.querySelector('#remotevideo');
const shareButton = document.querySelector('#shareButton');
const connectButton = document.querySelector('#connectButton');
const disconnectButton = document.querySelector('#disconnectButton');

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

let localPeerConnection;
let remotePeerConnection;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

function getName(pc) {
    return (pc === localPeerConnection) ? 'localPeerConnection' : 'remotePeerConnection';
}

function getOtherPc(pc) {
    return (pc === localPeerConnection) ? remotePeerConnection : localPeerConnection;
}

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

function gotRemoteStream(event) {
    if (remoteVideo.srcObject !== event.streams[0]) {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = event.streams[0];
    }
}

async function onCreateOfferSuccess(desc) {
    console.log(`Offer from localPeerConnection\n${desc.sdp}`);
    console.log('localPeerConnection setLocalDescription start');
    try {
        await localPeerConnection.setLocalDescription(desc);
    } catch (e) {
        handleError(e);
    }
    console.log('remotePeerConnection setRemoteDescription start');
    try {
        await remotePeerConnection.setRemoteDescription(desc);
    } catch (e) {
        handleError(e);
    }
    console.log('remotePeerConnection createAnswer start');
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    try {
        const answer = await remotePeerConnection.createAnswer();
        await onCreateAnswerSuccess(answer);
    } catch (e) {
        handleError(e);
    }
}

async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from remotePeerConnection:\n${desc.sdp}`);
    console.log('remotePeerConnection setLocalDescription start');
    try {
        await remotePeerConnection.setLocalDescription(desc);
    } catch (e) {
        handleError(e);
    }
    console.log('localPeerConnection setRemoteDescription start');
    try {
        await localPeerConnection.setRemoteDescription(desc);
    } catch (e) {
        handleError(e);
    }
}

function hangup() {
    console.log('Ending call');
    localPeerConnection.close();
    remotePeerConnection.close();
    localPeerConnection = null;
    remotePeerConnection = null;
    disconnectButton.disabled = true;
    connectButton.disabled = false;
}

async function call() {
    connectButton.disabled = true;
    disconnectButton.disabled = false;
    localPeerConnection = new RTCPeerConnection(configuration);
    localPeerConnection.addEventListener('icecandidate', e => onIceCandidate(localPeerConnection, e));
    remotePeerConnection = new RTCPeerConnection(configuration);
    remotePeerConnection.addEventListener('icecandidate', e => onIceCandidate(remotePeerConnection, e));
    localPeerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(localPeerConnection, e));
    remotePeerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(remotePeerConnection, e));
    remotePeerConnection.addEventListener('track', gotRemoteStream);
    localStream.getTracks().forEach(track => localPeerConnection.addTrack(track, localStream));
    try {
        const offer = await localPeerConnection.createOffer(offerOptions);
        await onCreateOfferSuccess(offer);
    } catch (e) {
        handleError(e);
    }
}

function gotDisplayMediaStream(streams) {
    if (localStream) {
        localStream.getTracks().forEach(track => { track.stop(); });
    }
    shareButton.disabled = true;
    connectButton.disabled = false;
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
    connectButton.disabled = false;
    localStream = streams; // make stream available to console
    localVideo.srcObject = streams;
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
    // connectButton.addEventListener('click', call);
    disconnectButton.addEventListener('click', hangup);
}

init();
