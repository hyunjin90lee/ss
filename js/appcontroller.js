'use strict';

const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');
const roomSelectionDiv = document.querySelector('#room-selection');
const previewDiv = document.querySelector('#preview-div');
const localMediaOptionDiv = document.querySelector('#local-media-option-div');

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
    this.localMediaOption =
        document.querySelectorAll('input[name="local-video"], input[name="local-audio"]');

    this.createButton.addEventListener('click', this.createRandomRoom.bind(this));
    this.targetRoom.addEventListener('input', this.checkTargetRoom.bind(this));
    this.joinButton.addEventListener('click', this.joinRoom.bind(this));
    this.disconnectButton.addEventListener('click', this.hangup.bind(this));
    this.connectDeviceButton.addEventListener('click', this.onConnectDevice.bind(this));
    this.shareScreenButton.addEventListener('click', this.onShareScreen.bind(this));
    this.meetNowButton.addEventListener('click', this.onMeetNow.bind(this));
    this.localMediaOption.
        forEach(input => input.addEventListener('change', this.onMediaOption.bind(this)));

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

AppController.prototype.createRandomRoom = async function() {
    var roomNumber = randomNumber(9);
    console.log(`randomNumber is ${roomNumber}`);

    this.isCaller = true; /* TODO: isCaller setting time */
    this.targetRoom.value = roomNumber;
    this.checkTargetRoom();
    this.targetRoom.disabled = true;
}

AppController.prototype.joinRoom = async function() {
    this.roomId = this.targetRoom.value;
    this.roomRef = await this.db.collection('rooms').doc(this.roomId);
    const roomSnapshot = await this.roomRef.get();

    if (this.isCaller) {
        if (roomSnapshot.exists) {
            console.log(`Room #${this.roomId} is already created. Choose another room number`);
            this.infoBox_.roomExistErrorMessage(this.roomId);
            this.showLoginMenu();
            return;
        }
        await this.roomRef.set({created: true}); // new room created
    } else {
        if (!roomSnapshot.exists) {
            console.log(`You cannot join this room ${this.roomId} - It's not exists`);
            this.infoBox_.loginErrorMessage(this.roomId);
            this.showLoginMenu();
            return;
        }
    }

    this.infoBox_.resetMessage();
    this.disconnectButton.disabled = false;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(localMediaOptionDiv);
    this.show_(activeDiv);
}

AppController.prototype.checkTargetRoom = function() {
    var roomNumber = this.targetRoom.value;

    if (roomNumber.length > 0) {
        this.createButton.disabled = true;

        var re = /^[0-9]+$/;
        var valid = (roomNumber.length == 9) && re.exec(roomNumber);

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

AppController.prototype.hangup = async function() {
    this.call_.hangup();
    this.infoBox_.resetMessage();

    this.shareScreenButton.disabled = false;
    this.createButton.disabled = false;
    this.joinButton.disabled = false;
    this.disconnectButton.disabled = true;

    await this.resource_free();

    this.hide_(localMediaOptionDiv);
    this.hideMeetingRoom();
    this.showLoginMenu();
}

AppController.prototype.callee_free = async function () {
    if (!this.calleeCandidatesCollection) {
        return;
    }

    this.calleeCandidatesCollection.get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        this.roomRef.update({
            answer: firebase.firestore.FieldValue.delete()
        });
        console.log('callee_free done');
    });
}

AppController.prototype.caller_free = function () {
    if (!this.callerCandidatesCollection) {
        return;
    }

    this.callerCandidatesCollection.get().then(res => {
        res.forEach(element => {
            element.ref.delete();
        });
        this.roomRef.update({
            offer: firebase.firestore.FieldValue.delete()
        });
        this.roomRef.delete();
        console.log('caller_free done');
    });
}

AppController.prototype.resource_free = async function () {
    var isCaller = this.isCaller;
    const roomSnapshot = await this.roomRef.get();
    if (roomSnapshot.exists) {
        this.callee_free();
        if (isCaller) {
            this.caller_free();
        }
    } else {
        console.log(`room ${this.roomId} already No exist`);
    }
    console.log('resource_free done');
}


AppController.prototype.onConnectDevice = async function() {
    if (await this.call_.onConnectDevice() == true) {
        this.meetNowButton.disabled = false;
    }
}

AppController.prototype.onShareScreen = async function() {
    if (await this.call_.onShareScreen() == true) {
        this.meetNowButton.disabled = false;
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

AppController.prototype.onMediaOption = function(event) {
    console.log("onMediaOption ~ event: ", event.target);
    this.call_.onMediaOption(event.target);
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

AppController.prototype.showLoginMenu = function () {
    this.createButton.disabled = false;
    this.joinButton.disabled = false;
    this.targetRoom.disabled = false;
    this.targetRoom.value = "";
    this.isCaller = false;
    console.log("showLoginMenu")
}

AppController.prototype.hide_ = function(element) {
    element.classList.add('hidden');
};

AppController.prototype.show_ = function(element) {
    element.classList.remove('hidden');
}