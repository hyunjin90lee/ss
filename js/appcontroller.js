'use strict';

const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');
const roomSelectionDiv = document.querySelector('#room-selection');
const previewDiv = document.querySelector('#preview-div');
const mediaOptionDiv = document.querySelector('#media-option-div');

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
    this.remoteMediaOption =
        document.querySelectorAll('input[name="remote-video"], input[name="remote-audio"]');
    this.allowDialogBtn = document.querySelector('#allow-dialog-btn');
    this.denyDialogBtn = document.querySelector('#deny-dialog-btn');
    this.dialogMessage = document.querySelector('#dialog-message');
    this.remoteDialog = document.querySelector('#remote-dialog');

    this.createButton.addEventListener('click', this.createRandomRoom.bind(this));
    this.targetRoom.addEventListener('input', this.checkTargetRoom.bind(this));
    this.joinButton.addEventListener('click', this.joinRoom.bind(this));
    this.disconnectButton.addEventListener('click', this.hangup.bind(this));
    this.connectDeviceButton.addEventListener('click', this.onConnectDevice.bind(this));
    this.shareScreenButton.addEventListener('click', this.onShareScreen.bind(this));
    this.meetNowButton.addEventListener('click', this.onMeetNow.bind(this));
    this.localMediaOption.
        forEach(input => input.addEventListener('change', this.onLocalMediaOption.bind(this)));
    this.remoteMediaOption.
        forEach(input => input.addEventListener('change', this.onRemoteMediaOption.bind(this)));
    this.denyDialogBtn.addEventListener('click', ()=>this.remoteDialog.close());

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
    this.show_(mediaOptionDiv);
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

    this.hide_(mediaOptionDiv);
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
    if (this.participants != undefined) {
        this.participants.length = 0;
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

AppController.prototype.prepareDialog = function(data) {
    let target = '';
    let value = false;
    if ('video' in data) {
        target = 'video';
        if (data.video === true || data.video === "true") {
            this.dialogMessage.innerHTML = 'Could you turn camera on, please?';
            value = true;
        } else {
            this.dialogMessage.innerHTML = 'Could you turn camera off, please?';
        }
    } else {
        target = 'audio';
        if (data.video === true || data.video === "true") {
            this.dialogMessage.innerHTML = 'Could you unmute yourself, please?';
            value = true;
        } else {
            this.dialogMessage.innerHTML = 'Could you mute yourself, please?';
        }
    }
    this.allowDialogBtn.addEventListener('click', ()=> {
        this.call_.onLocalMediaOption(target, value);
        this.remoteDialog.close();
    });
}

AppController.prototype.addControlMediaStreamsListener = function() {
    this.participantsCollection = this.roomRef.collection('participants');
    this.mediaOptionRef = this.participantsCollection.doc();
    this.mediaOptionRef.set({id:this.mediaOptionRef.id})
    this.mediaOptionRef.onSnapshot((doc) => {
        let data = doc.data();
        if ((data === undefined)
        || (!('video' in data || 'audio' in data))) {
            return;
        }
        this.prepareDialog(data);
        this.remoteDialog.showModal();        
    });
    this.participantsCollection.where('id','!=',this.mediaOptionRef.id).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                if (data === undefined) return;
                if ('id' in data) {
                    if (this.participants === undefined) {
                        this.participants = [];
                    }
                    this.participants.push(data.id);
                }
            }
        });
    });
};

AppController.prototype.onMeetNow = async function() {
    this.callerCandidatesCollection = this.roomRef.collection('callerCandidates');
    this.calleeCandidatesCollection = this.roomRef.collection('calleeCandidates');
    this.addControlMediaStreamsListener();

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

AppController.prototype.onLocalMediaOption = function(event) {
    console.log("onLocalMediaOption ~ event: ", event.target);
    let input = event.target;
    this.call_.onLocalMediaOption(input.name.split("-")[1], input.value);
}

AppController.prototype.onRemoteMediaOption = function(event) {
    console.log("onRemoteMediaOption ~ event: ", event.target);
    if (this.participantsCollection == undefined) return;
    let option = {};
    let media = event.target.name.split("-")[1];
    option[media] = event.target.value === true ? true : event.target.value == "true";
    this.participants.forEach(id =>
        this.participantsCollection.doc(id).update(option));
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