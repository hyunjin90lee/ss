'use strict';


var Call = function (appController) {
    console.log("new Call!");

    this.localVideo = document.querySelector('#localvideo');
    //this.remoteVideo = document.querySelector('#remotevideo');

    this.appController_ = appController;
    this.pc_ = [];
    this.connectionCnt = 0;
    this.stateListeners_ = [];
}

Call.prototype.addStateListener = function(listener) {
    this.stateListeners_.push(listener);
}

Call.prototype.onConnectDevice = function() {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    return navigator.mediaDevices.getUserMedia({video:true, audio:true})
        .then(this.gotUserMediaStream.bind(this)).catch((error) => {
            console.log("[Error] failed to get media, name: " + error.name + ", message: " + error.message);
            return false;
        });
}

Call.prototype.onShareScreen = function() {
    return navigator.mediaDevices.getDisplayMedia({video:true, audio:true})
    .then(this.gotDisplayMediaStream.bind(this), (error) => {
        console.log("[Error] failed to share screen:, name: " + error.name + ", message: " + error.message);
        return false;
    });
}

Call.prototype.onLocalMediaOption = function(type, value) {
    console.log(type + ": " + value)
    this.handleMediaOptions(type, value);
}

Call.prototype.handleMediaOptions = function(type, value) {
    if (!this.localStream) {
        return;
    }
    console.log("handleMediaOptions: "+value);
    if (type === "video") {
        this.localStream.getVideoTracks().forEach((track) => {
            track.enabled = value;
            console.log("track.enabled: " + track.enabled + "/" + value);
        })
    } else if (type === "audio"){
        this.localStream.getAudioTracks().forEach((track) => {
            track.enabled = value;
            console.log("track.enabled: " + track.enabled + "/" + value);
        })
    }
}

Call.prototype.gotUserMediaStream = function(streams) {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }

    this.localStream = streams; // make stream available to console
    this.localVideo.srcObject = streams;
    //this.remoteVideo.srcObject = this.remoteStream;

    return true;
}

Call.prototype.gotDisplayMediaStream = function(streams) {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    
    this.localStream = streams; // make stream available to console
    this.localVideo.srcObject = streams;
    //this.remoteVideo.srcObject = this.remoteStream;
    this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        /*shareButton.disabled = false;*/
        this.onConnectDevice();
    });
    return true;
}

Call.prototype.addPeerConnection = async function (me, peer) {
    var pcIndex = this.connectionCnt++;

    this.pc_[pcIndex] = new Connection(me, peer, this);
    this.stateListeners_.forEach(listener => {
        this.pc_[pcIndex].addStateListener(listener);
    });
    await this.pc_[pcIndex].initConnection();

    await this.pc_[pcIndex].startConnection(me);
}

Call.prototype.hangup = async function() {
    console.log('Ending call');

    if (this.localVideo.srcObject) {
        const tracks = this.localVideo.srcObject.getTracks();
        tracks.forEach(track => {
            track.stop();
        });
    }
    
    this.localVideo.srcObject = null;

    for (var i=0; i<this.connectionCnt; i++) {
        await this.pc_[i].hangup();
        delete this.pc_[i]; /* TBD ?? */
    }
    this.connectionCnt = 0;
}

Call.prototype.hangupIt = async function(peer) {
    for (var i=0; i<this.connectionCnt; i++) {
        if (this.pc_[i].peerName == peer) {
            await this.pc_[i].hangup();
            delete this.pc_[i]; /* TBD ?? */
            this.connectionCnt--;
            return;
        }
    }
}