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
    this.call_ = new Call(this);
    this.maxUsers = 5;

    this.userName = document.querySelector("#userName");
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
    this.joinErrorDialog = document.querySelector('#joinError-dialog');
    this.returnLoginBtn = document.querySelector('#return-login-btn');
    this.enableMonitorCheck = document.querySelector('#enable-monitor');

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
    this.returnLoginBtn.addEventListener('click', ()=>{
                                                this.infoBox_.resetMessage();
                                                this.hide_(mediaOptionDiv);
                                                this.hideMeetingRoom();
                                                this.showLoginMenu();
                                                this.joinErrorDialog.close();
                                                });
    this.enableMonitorCheck.addEventListener('change', function() {
        if (this.checked) {
            Monitor.getMonitor().start();
        } else {
            Monitor.getMonitor().stop();
        }
    });

    this.userCount = 0;
    this.isHost = false;
    this.db = firebase.firestore();
    this.show_(roomSelectionDiv);

    Monitor.getMonitor().addSystemMonitor("systemmonitor", "localvideo");
    this.call_.addStateListener(Monitor.onStateChanged);
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

    this.isHost = true; /* TODO: isHost setting time */
    this.targetRoom.value = roomNumber;
    this.checkTargetRoom();
    this.targetRoom.disabled = true;
}

AppController.prototype.joinRoom = async function() {
    if (this.userName.value.length == 0) {
        this.user = "noname" + randomNumber(2);
    } else {
        this.user = this.userName.value;
    }
    console.log('userName is ' + this.user);

    this.roomId = this.targetRoom.value;
    this.roomRef = await this.db.collection('rooms').doc(this.roomId);
    this.userCollection = this.roomRef.collection('users');
    const roomSnapshot = await this.roomRef.get();

    if (this.isHost) {
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
    this.infoBox_.loginRoomMessage(this.isHost, this.roomId);
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
    this.disconnectButton.disabled = true;
    this.shareScreenButton.disabled = true;
    this.connectDeviceButton.disabled = true;
    this.meetNowButton.disabled = true;

    await this.call_.hangup();
    await this.resource_free();

    this.infoBox_.resetMessage();

    this.hide_(mediaOptionDiv);
    this.hideMeetingRoom();
    this.showLoginMenu();
}

AppController.prototype.resource_free = async function () {
    // TBD : it should be fixed later
    if (this.userRef) {
        await this.userRef.delete();
    }
    if (this.mediaOptionRef) {
        await this.mediaOptionRef.delete();
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
        value = data.video === true || data.video === "true";
        if (value) {
            this.dialogMessage.innerHTML = 'Could you turn camera on, please?';
        } else {
            this.dialogMessage.innerHTML = 'Could you turn camera off, please?';
        }
    } else {
        target = 'audio';
        value = data.audio === true || data.audio === "true";
        if (value) {
            this.dialogMessage.innerHTML = 'Could you unmute yourself, please?';
        } else {
            this.dialogMessage.innerHTML = 'Could you mute yourself, please?';
        }
    }
    this.allowDialogBtn.addEventListener('click', ()=> {
        this.call_.onLocalMediaOption(target, value);
        this.remoteDialog.close();
    });
}

AppController.prototype.addUser = async function() {
    this.userCollection.onSnapshot(async snapshot => {
        snapshot.docChanges().forEach(async change => {
            let data = change.doc.data();
            if (change.type === 'added') {
                this.userCount++;
                console.log(`user Added!! name is : ${data.name}, current users are ${this.userCount}`)
                if (this.user != data.name) {
                    await this.call_.addPeerConnection(this.user, data.name);
                }
            } else if (change.type === 'removed') {
                this.userCount--;
                console.log(`user Removed!! name is : ${data.name}, current users are ${this.userCount}`)
                if (this.userCount == 0) {
                    await this.roomRef.delete();
                }
            }
        })
    })

    this.userRef = this.userCollection.doc(this.user);
    this.userRef.set({name: this.user});
    console.log('set ' + this.user)
    var res = await this.userCollection.get();
    if (res.size == 1) {
        console.log(`users collection size is ${res.size}`)
    }

    var div = document.createElement('div');
    var localName = `[ME] ${this.user}`;
    var text = document.createTextNode(localName);
    div.appendChild(text);
    videosDiv.prepend(div);
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
    var res = await this.userCollection.get();
    if (res.size >= this.maxUsers) {
        console.log('This room is FULL!! You cannot join this room');
        this.joinErrorDialog.showModal();
        return ;
    }

    this.addControlMediaStreamsListener();
    await this.addUser(); /* TBD: it will be merged with addControlMedia~~ soon */
    
    this.hide_(previewDiv);
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
        this.participantsCollection.doc(id).set(option));
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
    this.connectDeviceButton.disabled = false;
    this.shareScreenButton.disabled = false;

    this.isHost = false;
    this.userCount = 0;
    console.log("showLoginMenu")
}

AppController.prototype.hide_ = function(element) {
    element.classList.add('hidden');
};

AppController.prototype.show_ = function(element) {
    element.classList.remove('hidden');
}