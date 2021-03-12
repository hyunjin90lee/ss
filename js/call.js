'use strict';


var Call = function (appController) {
    console.log("new Call!");

    this.localVideo = document.querySelector('#localvideo');
    this.localVideoContainer = document.querySelector('#local-container-div');

    this.appController_ = appController;
    this.pc_ = [];
    this.stateListeners_ = [];
    this.constraint_ = {
        video: {
            width: { max: 640 },
            height: { max: 480 },
        },
        audio: {
            sampleSize: 16,
            channelCount: 2,
            echoCancellation: true,
        }};
}

Call.prototype.receiveMessage = function(event) {
    console.log("receiveMessage: " + event.data);
    this.appController_.receiveMessage(event.data);
}

Call.prototype.sendChatMessageAll = function(msg) {
    console.log("sendChatMessageAll: " + msg);
    if (this.pc_.length === 0) return;
    this.pc_.forEach(p => p.sendChatMessage(msg));
}

Call.prototype.sendChatMessage = function(target, msg) {
    console.log("sendChatMessage to " + target + ": " + msg);
    if (this.pc_.length === 0) return;

    for (var i=0; i<this.pc_.length; i++) {
        if (this.pc_[i].peerName == target) {
            this.pc_[i].sendChatMessage(msg);
            break;
        }
    }
}

Call.prototype.addStateListener = function(listener) {
    this.stateListeners_.push(listener);
}

Call.prototype.onConnectDevice = function() {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    return navigator.mediaDevices.getUserMedia(this.constraint_)
        .then(this.gotMediaStream.bind(this)).catch((error) => {
            console.log("[Error] failed to get media, name: " + error.name + ", message: " + error.message);
            return false;
        });
}

Call.prototype.onShareScreen = function() {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    return navigator.mediaDevices.getDisplayMedia(this.constraint_)
    .then(this.gotMediaStream.bind(this), (error) => {
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

Call.prototype.gotMediaStream = function(streams) {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => { track.stop(); });
    }
    this.localStream = streams; // make stream available to console
    this.localVideo.srcObject = streams;
    this.localVideo.width = streams.getVideoTracks()[0].getSettings().width * 0.5;
    this.localVideo.height = streams.getVideoTracks()[0].getSettings().height * 0.5;
    Detector.getDetector(this.localVideo).start();
    this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        Detector.getDetector().stop();
    });
    return true;
}

Call.prototype.addPeerConnection = async function (me, peer) {
    let connection = new Connection(me, peer, this);
    this.stateListeners_.forEach(listener => {
        connection.addStateListener(listener);
    });
    await connection.initConnection();

    await connection.startConnection(me);

    this.pc_.push(connection);
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

    for (var i=0; i<this.pc_.length; i++) {
        console.log(`pc_[${i}].pcName is ${this.pc_[i].pcName}`)
        if (this.pc_[i]) {
            await this.pc_[i].hangup();
            this.pc_.splice(i,1);
        }
    }

    console.log("Ending call done")
}

Call.prototype.hangupIt = async function(peer) {
    console.log("hangupIt(w/" + peer + ")")
    for (var i=0; i<this.pc_.length; i++) {
        console.log(`pc_[${i}].pcName is ${this.pc_[i].pcName}`)
        if (this.pc_[i].peerName == peer) {
            await this.pc_[i].hangup();
            this.pc_.splice(i,1);
            return;
        }
    }
    console.log("hangupIt done(w/" + peer + ")")
}
