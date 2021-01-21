'use strict';

var Call = function () {
    console.log("new Call!");

    this.localVideo = document.querySelector('#localvideo');
    this.remoteVideo = document.querySelector('#remotevideo');
    this.userMediaConstraints = {video: true, audio: true};
    this.displayMediaContraints = {video: true, audio: true};

    this.configuration = {
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

    this.remoteStream = new MediaStream();
    this.onAddCallCandidate = null;
}

Call.prototype.onConnectDevice = function() {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    navigator.mediaDevices.getUserMedia(this.userMediaConstraints)
        .then(this.gotUserMediaStream.bind(this)).catch((error) => {
            console.log("[Error] failed to get media, name: " + error.name + ", message: " + error.message);
            return false;
        });
}

Call.prototype.onShareScreen = function() {
    return navigator.mediaDevices.getDisplayMedia(this.displayMediaContraints)
    .then(this.gotDisplayMediaStream.bind(this), (error) => {
        console.log("[Error] failed to share screen:, name: " + error.name + ", message: " + error.message);
        return false;
    });
}

Call.prototype.onUserContraints = function(input) {
    this.userMediaConstraints[input.name.split("-")[1]] = input.value;
    if (this.localStream) {
        this.localStream.getTracks().
            forEach(track => track.applyConstraints(this.userMediaConstraints));
    }
}

Call.prototype.onDisplayContraints = function(input) {
    this.displayMediaContraints[input.name.split("-")[1]] = input.value;
    if (this.localStream) {
        this.localStream.getTracks().
            forEach(track => track.applyConstraints(this.displayMediaContraints));
    }
}

Call.prototype.gotUserMediaStream = function(streams) {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }

    this.localStream = streams; // make stream available to console
    this.localVideo.srcObject = streams;
    this.remoteVideo.srcObject = this.remoteStream;
    return true;
}

Call.prototype.gotDisplayMediaStream = function(streams) {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    
    this.localStream = streams; // make stream available to console
    this.localVideo.srcObject = streams;
    this.remoteVideo.srcObject = this.remoteStream;
    this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        /*shareButton.disabled = false;*/
        this.onConnectDevice();
    });
    return true;
}

Call.prototype.startConnection = function(isCaller) {
    console.log('Create PeerConnection with configuration: ', this.configuration);
    
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.registerPeerConnectionListeners();
    
    this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        this.onAddCallCandidate(isCaller, event.candidate.toJSON());
    });

    this.peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            this.remoteStream.addTrack(track);
        });
    });
}

Call.prototype.setLocalDescription = async function (isCaller) {
    if (isCaller) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        console.log('Created offer: ', offer);

        return {
            'offer': {
                type: offer.type,
                sdp: offer.sdp,
            },
        };
    } else {
        const answer = await this.peerConnection.createAnswer();
        console.log('Created answer:', answer);
        await this.peerConnection.setLocalDescription(answer);

        return {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
    }

}

Call.prototype.setRemoteDescription = async function (isCaller, data) {
    if (isCaller) {
        if (!this.peerConnection.currentRemoteDescription && data && data.answer) {
            console.log('Got remote description: ', data.answer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    }
}

Call.prototype.addIceCandidate = async function (data) {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
}

Call.prototype.registerPeerConnectionListeners = function() {
    this.peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
          `ICE gathering state changed: ${this.peerConnection.iceGatheringState}`);
    });
  
    this.peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${this.peerConnection.connectionState}`);
        if (this.peerConnection.connectionState == "disconnected") {
            //noticeInfo.innerHTML = 'Peer disconnected!! '
        }
    });
  
    this.peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${this.peerConnection.signalingState}`);
    });
  
    this.peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
          `ICE connection state change: ${this.peerConnection.iceConnectionState}`);
    });
}

Call.prototype.hangup = function() {
    console.log('Ending call');
    const tracks = this.localVideo.srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    if (this.remoteStream && this.remoteStream.getTracks()) {
        console.log("Stop remote tracks. Size: " + this.remoteStream.getTracks().length);
        this.remoteStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
        this.peerConnection.close();
    }
    this.localVideo.srcObject = null;
    this.remoteVideo.srcObject = null;
}