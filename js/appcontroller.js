'use strict';

const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');
const roomSelectionDiv = document.querySelector('#room-selection');
const previewDiv = document.querySelector('#preview-div');
const mediaConstraintDiv = document.querySelector('#media-constraint-div');



var AppController = function(){
    console.log("new AppController!!");
    
    this.init();
}

AppController.prototype.init = function() {
    if (document.visibilityState === 'prerender') {
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        return;
    }

    this.infoBox_ = new InfoBox();
    this.call_ = new Call();

    this.createButton = document.querySelector('#createButton');
    this.targetRoom = document.querySelector('#targetRoom');
    this.joinButton = document.querySelector('#joinButton');
    this.disconnectButton = document.querySelector('#disconnectButton');
    this.connectDeviceButton = document.querySelector('#connect-device');
    this.shareScreenButton = document.querySelector('#share-screen');
    this.meetNowButton = document.querySelector('#meet-now');
    this.targetRoomLabel = document.querySelector('#targetRoom-label');

    this.userConstraints = document.querySelectorAll('#user-constraint > input');
    this.displayConstraints = document.querySelectorAll('#display-constraint > input');

    this.createButton.addEventListener('click', this.createRoom.bind(this));
    this.targetRoom.addEventListener('input', this.checkTargetRoom.bind(this));
    this.joinButton.addEventListener('click', this.joinRoom.bind(this));
    this.disconnectButton.addEventListener('click', this.hangup.bind(this));
    this.connectDeviceButton.addEventListener('click', this.onConnectDevice.bind(this));
    this.shareScreenButton.addEventListener('click', this.onShareScreen.bind(this));
    this.meetNowButton.addEventListener('click', this.onMeetNow.bind(this));
    this.userConstraints.
        forEach(input => input.addEventListener('change', this.onUserContraints.bind(this)));
    this.displayConstraints.
        forEach(input => input.addEventListener('change', this.onDisplayContraints.bind(this)));

    this.db = firebase.firestore();

    this.show_(roomSelectionDiv);
}

AppController.prototype.onVisibilityChange = function() {
    if (document.visibilityState === 'prerender') {
        return;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.init();
}

AppController.prototype.createRoom = async function() {
    this.roomRef = await this.db.collection('rooms').doc();

    this.isCaller = true;
    this.createButton.disabled = true;
    this.joinButton.disabled = true;
    this.disconnectButton.disabled = false;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(mediaConstraintDiv);
}

AppController.prototype.joinRoom = async function() {
    this.roomId = this.targetRoom.value;
    this.roomRef = await this.db.collection('rooms').doc(this.roomId);

    this.isCaller = false;
    this.createButton.disabled = true;
    this.joinButton.disabled = true;
    this.disconnectButton.disabled = false;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(mediaConstraintDiv);
}

AppController.prototype.checkTargetRoom = function() {
    var roomNumber = this.targetRoom.value;

    if (roomNumber.length > 0) {
        this.createButton.disabled = true;

        var re = /^[a-zA-Z0-9]+$/;
        var valid = (roomNumber.length == 20) && re.exec(roomNumber);

        if (valid) {
            this.joinButton.disabled = false;
            this.hide_(this.targetRoomLabel);
        } else {
            this.joinButton.disabled = true;
            this.show_(this.targetRoomLabel);
        }
    } else {
        this.createButton.disabled = false;
        this.joinButton.disabled = true;
    }
}

AppController.prototype.hangup = function() {
    this.call_.hangup();
    this.infoBox_.resetMessage();

    this.shareScreenButton.disabled = false;
    this.createButton.disabled = false;
    this.joinButton.disabled = false;
    this.disconnectButton.disabled = true;

    this.resource_free();
    // this.userConstraints.forEach((input)=>input.disabled=false);
    // this.displayConstraints.forEach((input)=>input.disabled=false);
    this.hide_(mediaConstraintDiv);
    this.hideMeetingRoom();
}

AppController.prototype.callee_free = function () {
    this.calleeCandidatesCollection.get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        this.roomRef.update({
            answer: firebase.firestore.FieldValue.delete()
        });
    });
    console.log('callee_free done');
}

AppController.prototype.caller_free = function () {
    this.callerCandidatesCollection.get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        this.roomRef.update({
            offer: firebase.firestore.FieldValue.delete()
        });
        this.roomRef.delete();
    });
    console.log('caller_free done');
}

AppController.prototype.resource_free = async function () {
    const roomSnapshot = await this.roomRef.get();
    if (roomSnapshot.exists) {
        this.callee_free();
        if (this.isCaller) {
            this.caller_free();
        }
    } else {
        console.log(`room ${this.roomId} already No exist`);
    }
    console.log('resource_free done');
}


AppController.prototype.onConnectDevice = async function() {
    if (await this.call_.onConnectDevice() == true) {
        this.connectDeviceButton.disabled = true;
        // this.userConstraints.forEach(input => input.disabled = true);
        // this.displayConstraints.forEach(input => input.disabled = false);
    }
}

AppController.prototype.onShareScreen = async function() {
    if (await this.call_.onShareScreen() == true) {
        this.shareScreenButton.disabled = true;
        // this.userConstraints.forEach(input => input.disabled = false);
        // this.displayConstraints.forEach(input => input.disabled = true);
    }
}

AppController.prototype.onMeetNow = async function() {
    this.callerCandidatesCollection = this.roomRef.collection('callerCandidates');
    this.calleeCandidatesCollection = this.roomRef.collection('calleeCandidates');
    
    this.call_.onAddCallCandidate = function(isCaller, candidate) {
        if (isCaller) {
            this.callerCandidatesCollection.add(candidate);
        } else {
            this.calleeCandidatesCollection.add(candidate);
        }
    }.bind(this);

    this.call_.startConnection(this.isCaller);

    if (this.isCaller) {
        const roomWithOffer = await this.call_.setLocalDescription(this.isCaller);
        await this.roomRef.set(roomWithOffer);

        this.roomId = this.roomRef.id;
        console.log(`New room created with SDP offer. Room ID: ${this.roomRef.id}`);
 
        this.roomRef.onSnapshot(async snapshot => {
            const data = snapshot.data();
            await this.call_.setRemoteDescription(this.isCaller, data);
        });

        this.calleeCandidatesCollection.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type == 'added') {
                    let data = change.doc.data();
                    await this.call_.addIceCandidate(data);
                }
            });
        })
    } else {
        const roomSnapshot = await this.roomRef.get();
        console.log('Got room:', roomSnapshot.exists);

         if (roomSnapshot.exists) {
            const data = roomSnapshot.data();
            console.log('Got offer:', data.offer);
            await this.call_.setRemoteDescription(this.isCaller, data);

            const roomWithAnswer = await this.call_.setLocalDescription(this.isCaller);
            await this.roomRef.update(roomWithAnswer);
            
            this.callerCandidatesCollection.onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        let data = change.doc.data();
                        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                        await this.call_.addIceCandidate(data);
                    }
                });
            });
        } else {
            this.infoBox_.loginErrorMessage(this.roomId);
            return;
        }
    }
    
    this.hide_(previewDiv);
    this.infoBox_.loginRoomMessage(this.isCaller, this.roomId);
    this.showMeetingRoom();
}

AppController.prototype.onUserContraints = function(event) {
    console.log("onUserContraints ~ event", event.target);
    this.call_.onUserContraints(event.target);
}

AppController.prototype.onDisplayContraints = function(event) {
    console.log("🚀 ~ appcontroller.js ~ line 265 ~ onUserContraints ~ event", event.target);
    this.call_.onDisplayContraints(event.target);
}

AppController.prototype.hideMeetingRoom = function() {
    this.meetNowButton.disabled = false;
    this.show_(loginDiv);
    this.hide_(videosDiv);
    this.hide_(previewDiv);
    this.hide_(activeDiv);
}

AppController.prototype.showMeetingRoom = function () {
    this.meetNowButton.disabled = true;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(activeDiv);
}

AppController.prototype.hide_ = function(element) {
    element.classList.add('hidden');
};

AppController.prototype.show_ = function(element) {
    element.classList.remove('hidden');
}