'use strict';

const loginDiv = document.querySelector('#login-div');
const activeDiv = document.querySelector('#active-div');
const videosDiv = document.querySelector('#videos-div');
const localvideoDiv = document.querySelector('#localvideo-div');
const localvideoName = document.querySelector('#localvideoName');
const roomSelectionDiv = document.querySelector('#room-selection');
const previewDiv = document.querySelector('#preview-div');
const optionDiv = document.querySelector('#option-div');
const exitingDiv = document.querySelector('#exiting-div');
const qrReaderDiv = document.querySelector('#reader');
const captionDiv = document.querySelector('#caption-div');
const performanceDiv = document.querySelector('#performance-div');
const userUl = document.querySelector("#userList");
const userSt = document.querySelector('#select');
const qrImg = document.querySelector('.qr-div img');

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
    this.qrCheckInButton = document.querySelector('#qrJoinButton');
    this.disconnectButton = document.querySelector('#disconnectButton');
    this.connectDeviceButton = document.querySelector('#connect-device');
    this.shareScreenButton = document.querySelector('#share-screen');
    this.meetNowButton = document.querySelector('#meet-now');
    this.chatTextBox = document.querySelector('#chat-all-msg-textarea');
    this.chatInputTextBox = document.querySelector('#chat-input-msg-textarea');
    this.chatSendButton = document.querySelector('#chat-msg-send-button');
    this.targetRoomLabel = document.querySelector('#targetRoom-label');
    this.allowDialogBtn = document.querySelector('#allow-dialog-btn');
    this.denyDialogBtn = document.querySelector('#deny-dialog-btn');
    this.dialogMessage = document.querySelector('#dialog-message');
    this.remoteDialog = document.querySelector('#remote-dialog');
    this.joinErrorDialog = document.querySelector('#joinError-dialog');
    this.exitDialog = document.querySelector('#exit-dialog');
    this.returnLoginBtn = document.querySelector('#return-login-btn');
    this.exitMessage = document.querySelector('#exit-message');
    this.stopButton = document.querySelector('#stop-dialog-btn');
    this.leaveButton = document.querySelector('#leave-dialog-btn');
    this.returnButton = document.querySelector('#return-meeting-btn');
    this.enableMonitorCheck = document.querySelector('#enable-monitor');
    this.showMonitorCheck = document.querySelector('#show-monitor');
    this.captionButton = document.querySelector('#caption');

    this.createButton.addEventListener('click', this.createRandomRoom.bind(this));
    this.targetRoom.addEventListener('input', this.checkTargetRoom.bind(this));
    this.joinButton.addEventListener('click', this.joinRoom.bind(this));
    this.qrCheckInButton.addEventListener('click', this.qrCheckIn.bind(this));
    this.disconnectButton.addEventListener('click', this.disconnectRoom.bind(this));
    this.connectDeviceButton.addEventListener('click', this.onConnectDevice.bind(this));
    this.shareScreenButton.addEventListener('click', this.onShareScreen.bind(this));
    this.meetNowButton.addEventListener('click', this.onMeetNow.bind(this));
    this.denyDialogBtn.addEventListener('click', ()=>this.remoteDialog.close());
    this.returnLoginBtn.addEventListener('click', ()=>{
                                                this.infoBox_.resetMessage();
                                                this.hideMeetingRoom();
                                                this.showLoginMenu();
                                                this.joinErrorDialog.close();
                                                });
    this.stopButton.addEventListener('click', this.stopMeeting.bind(this));
    this.leaveButton.addEventListener('click', this.hangup.bind(this));
    this.returnButton.addEventListener('click', ()=>{
                                                this.exitDialog.close();
                                                });
    this.captionButton.addEventListener('click', this.enableCaption.bind(this));
    this.enableMonitorCheck.addEventListener('change', function() {
        if (this.checked) {
            Monitor.getMonitor().start();
        } else {
            Monitor.getMonitor().stop();
        }
    });
    this.showMonitorCheck.addEventListener('change', function() {
        if (this.checked) {
            performanceDiv.classList.remove('hidden');
        } else {
            performanceDiv.classList.add('hidden');
        }
    })
    this.chatSendButton.addEventListener('click', this.sendChatMessage.bind(this));

    this.userButton = document.querySelector('.user-btn');
    this.closeButton = document.querySelector('.close-btn');
    this.userListDiv = document.querySelector('#userList-div');
    this.userButton.addEventListener('click', ()=>{
        var mainDiv = document.querySelector('.main');
        mainDiv.style.width = `${75}%`;
        this.userListDiv.classList.add("open");
        window.location.hash = "#open";
    });
    window.onhashchange = function() {
        if (location.hash != "#open") {
            this.userListDiv.classList.remove("open")
        }
    }
    this.closeButton.addEventListener('click', () => {
        var mainDiv = document.querySelector('.main');
        this.userListDiv.classList.remove("open");
        mainDiv.style.width = `${100}%`;
        history.back();
    })

    this.chatDiv = document.querySelector('#chat-div');
    this.chatDiv.addEventListener('click', () => {
        if (this.msgAlert) {
            this.msgAlert = false;
            this.chatDiv.classList.remove('div-blink');
            this.userButton.classList.remove('icon-blink');
        }
    })
    this.mediaOption = {video: true, audio: true};
    this.userCount = 0;
    this.isHost = false;
    this.captionOn = false;
    this.db = firebase.firestore();
    this.show_(roomSelectionDiv);

    Monitor.getMonitor().addSystemMonitor("systemmonitor", "localvideo");
    this.call_.addStateListener(Monitor.onStateChanged);

    try {
        if (this.audioContext != undefined) return;
        let AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        Detector.getDetector(this.audioContext);
        this.call_.addStreamListener(Detector.onStreamChanged);
    } catch (error) {
        alert("Web Audio API not supported, name: " + error.name + ", message: " + error.message);
    }
}


AppController.prototype.sendChatMessage = async function () {
    if (this.chatInputTextBox.value.length == 0) {
        return;
    }

    var targetUser = userSt.options[userSt.selectedIndex].value;
    var privateMessage;
    if (userSt.selectedIndex != 0) { /* private */
        privateMessage = `[${this.user}=>${targetUser}] `;
        this.chatTextBox.value += privateMessage;
    }
    this.chatTextBox.value += "Me: " + this.chatInputTextBox.value + "\n";

    if (userSt.selectedIndex == 0) {
        this.call_.sendChatMessageAll(this.user + ": " + this.chatInputTextBox.value + "\n");
    } else {
        this.call_.sendChatMessage(targetUser, privateMessage + this.user + ": " + this.chatInputTextBox.value + "\n");
    }

    this.chatInputTextBox.value = '';
}

AppController.prototype.receiveMessage = function(msg) {
    this.chatTextBox.value += msg;

    this.msgAlert = true;
    this.chatDiv.classList.add('div-blink');
    this.userButton.classList.add('icon-blink');
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
    if (this.checkTargetRoom()) {
        this.targetRoom.disabled = true;
        this.qrCheckInButton.disabled = true;
        let imgSrc = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="+roomNumber;
        qrImg.src = imgSrc;
    }
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
            return false;
        }
        await this.roomRef.set({created: true}); // new room created
    } else {
        if (!roomSnapshot.exists) {
            console.log(`You cannot join this room ${this.roomId} - It's not exists`);
            this.infoBox_.loginErrorMessage(this.roomId);
            this.showLoginMenu();
            return false;
        }
    }

    this.infoBox_.resetMessage();
    this.meetNowButton.disabled = true;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(activeDiv);
    this.infoBox_.loginRoomMessage(this.isHost, this.roomId);
    Detector.getDetector().start();

    return true;
}

AppController.prototype.qrCheckIn = function() {
    this.html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    this.html5QrcodeScanner.render(this.onScanSuccess.bind(this));

    this.show_(qrReaderDiv);
}

AppController.prototype.onScanSuccess = async function(qrCodeMessage) {
    console.log('qrCodeMessage is: ' + qrCodeMessage);

    this.targetRoom.value = qrCodeMessage;

    if (this.checkTargetRoom()) {
        var joinRoom = await this.joinRoom();
        if (joinRoom == true) {
            this.hide_(qrReaderDiv);
            this.html5QrcodeScanner.clear();
            return;
        }
    }
}

AppController.prototype.checkTargetRoom = function() {
    var roomNumber = this.targetRoom.value;
    console.log('2'+ this.targetRoom.value);
    console.log('3'+ roomNumber)
    console.log('4 '+ roomNumber.length)

    if (roomNumber.length > 0) {
        this.createButton.disabled = true;

        var re = /^[0-9]+$/;
        var validValue = (roomNumber.length == 9) && re.exec(roomNumber);
        if (validValue) {
            this.joinButton.disabled = false;
            this.hide_(this.targetRoomLabel);
        } else {
            this.joinButton.disabled = true;
            this.show_(this.targetRoomLabel);
        }
        return validValue; /* return false or valid Room Number */
    } else {
        this.createButton.disabled = false;
        this.joinButton.disabled = true;
        return false;
    }
}

AppController.prototype.disconnectRoom = function () {
    this.hide_(exitingDiv);

    this.stopButton.disabled = false;
    this.leaveButton.disabled = false;
    this.returnButton.disabled = false;

    if (this.isHost) {
        this.exitMessage.innerHTML = "Stop Meeting? or just leave it?"
        this.show_(this.stopButton);
        this.show_(this.leaveButton);
        this.show_(this.returnButton);
    } else {
        this.exitMessage.innerHTML = "Do you want to leave it?"
        this.hide_(this.stopButton);
        this.show_(this.leaveButton);
        this.show_(this.returnButton);
    }

    this.exitDialog.showModal();
}

AppController.prototype.stopMeeting = async function() {
    if (!this.isHost) {
        return;
    }

    this.show_(exitingDiv);
    this.exitMessage.innerHTML = "Stopping...";
    this.stopButton.disabled = true;
    this.leaveButton.disabled = true;
    this.returnButton.disabled = true;

    var res = await this.userCollection.get();
    if (res.size == 0) {
        await this.hangup();
        return;
    }
    res.docs.forEach(async element => {
        let data = element.data();
        await element.ref.delete();
    });
}

AppController.prototype.hangup = async function() {
    if (!this.isHost) {
        this.show_(exitingDiv);
        this.exitMessage.innerHTML = "Leaving...";
        this.leaveButton.disabled = true;
        this.returnButton.disabled = true;
    }

    this.chatTextBox.value = "";
    this.chatInputTextBox = "";
    localvideoName.innerHTML = "";
    this.resetUserList();
    await this.call_.hangup();
    await this.resource_free();

    this.infoBox_.resetMessage();

    this.exitDialog.close();
    this.hideMeetingRoom();
    this.showLoginMenu();
    Detector.getDetector().stop();
}

AppController.prototype.resource_free = async function () {
    if (this.userRef) {
        await this.userRef.delete();
    }
    if (this.userUnsubscribe) {
        await this.userUnsubscribe();
    }
    if (this.userRefUnsubscribe) {
        await this.userRefUnsubscribe();
    }

    if (this.participants != undefined) {
        this.participants.length = 0;
    }

    var res = await this.userCollection.get();
    if (res.size == 0) {
        await this.roomRef.delete();
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

AppController.prototype.prepareDialog = function(target, value) {
    value = value === true ? value : value === "true";    
    if (target === 'video') {
        if (value) {
            this.dialogMessage.innerHTML = 'Could you turn camera on, please?';
        } else {
            this.dialogMessage.innerHTML = 'Could you turn camera off, please?';
        }
    } else {
        if (value) {
            this.dialogMessage.innerHTML = 'Could you unmute yourself, please?';
        } else {
            this.dialogMessage.innerHTML = 'Could you mute yourself, please?';
        }
    }
    this.allowDialogBtn.addEventListener('click', ()=> {
        this.call_.onLocalMediaOption(target, value);
        this.mediaOption[target] = value;
        this.remoteDialog.close();
    });
    return this.remoteDialog;
}

AppController.prototype.appendDropDownMenu = async function(parent, name) {
    let str = '<a>Audio mute / unmute</a><a>Display on / off</a><a>Share file</a>';
    let dom = document.createElement('div');
    dom.id = "dropdown-menu-" + `${name}`;
    dom.classList.add("dropdown", "hidden");
    dom.innerHTML = str;
    let buttons = dom.getElementsByTagName("a");
    buttons[0].addEventListener('click', ()=>{
        this.updateVideoAudioOption(name, 'audio');
    });
    buttons[1].addEventListener('click', ()=>{
        this.updateVideoAudioOption(name, 'video');
    });
    buttons[2].addEventListener('click', ()=>{
        console.log("Share file");
    })
    parent.appendChild(dom);
}

AppController.prototype.updateVideoAudioOption = function(name, type) {
    console.log("updateVideoAudioOption: " + type);
    if (name == this.user) {
        this.mediaOption[type] = !this.mediaOption[type];
        this.call_.onLocalMediaOption(type, this.mediaOption[type]);
    } else {
        if (this.userCollection) {
            this.userCollection.doc(name).get().then((doc)=>{
                if (doc.exists) {
                    let cur = {};
                    cur[type] = !doc.data()[type];
                    this.userCollection.doc(name).set(cur, {merge: true});
                }
            });
        }
    }
}

AppController.prototype.addUserList = function(name) {
    var li = document.createElement('li');
    var text;

    li.id = `${name}`;
    if (this.user == name) {
        text = document.createTextNode(`${name} [ME]`)
    } else {
        text = document.createTextNode(name);
    }
    li.appendChild(text);
    this.appendDropDownMenu(li, name);
    userUl.append(li);
    li.addEventListener('click', () => {
        let dropdown = document.querySelector("#dropdown-menu-" + `${name}`);
        if (dropdown.classList.contains('hidden')) {
            this.show_(dropdown);
        } else {
            this.hide_(dropdown);
        }
    });

    if (this.user != name) {
        var op = document.createElement('option');
        var textop = document.createTextNode(name);
        op.id = `${name}_op`;
        op.appendChild(textop);
        userSt.append(op);
    }
}

AppController.prototype.removeUserList = function(name) {
    var userli = document.querySelector(`#${name}`);
    if (userli) {
        userli.remove();
    }
    var userOp = document.querySelector(`#${name}_op`);
    if (userOp) {
        userOp.remove();
    }
}

AppController.prototype.resetUserList = function() {
    while(userUl.hasChildNodes()) {
        userUl.removeChild(userUl.firstChild);
    }

    while(userSt.hasChildNodes()) {
        if (userSt.lastChild.index == 0) {
            return; /* don't remove the first child --ALL--*/
        }
        userSt.removeChild(userSt.lastChild);
    }
}

AppController.prototype.addUser = async function() {
    this.userUnsubscribe = this.userCollection.onSnapshot(async snapshot => {
        snapshot.docChanges().forEach(async change => {
            let data = change.doc.data();
            if (data === undefined) return;
            if (change.type === 'added') {
                console.log(`user Added!! name is : ${data.name}`);
                this.addUserList(data.name);
                if (this.user != data.name) {
                    await this.call_.addPeerConnection(this.user, data.name);
                }
                if (this.participants === undefined) {
                    this.participants = [];
                }
                this.participants.push(data.name);
                this.userCount++;
                console.log(`Now, current users are ${this.userCount}`);
            } else if (change.type === 'removed') {
                console.log(`user Removed!! name is : ${data.name}`);
                this.removeUserList(data.name);
                if (this.user != data.name) {
                    await this.call_.hangupIt(data.name);
                }
                this.userCount--;
                console.log(`Now, current users are ${this.userCount}`);
                if (this.userCount == 0) {
                    await this.hangup();
                }
            }
        })
    })

    this.userRef = this.userCollection.doc(this.user);
    this.userRef.set({name: this.user, 
        video: this.mediaOption.video,
        audio: this.mediaOption.audio});
    this.addMediaOptionListener();
    console.log('set ' + this.user)
    var res = await this.userCollection.get();
    if (res.size == 1) {
        console.log(`users collection size is ${res.size}`)
    }

    localvideoName.innerHTML = `[ME] ${this.user}`;
}

AppController.prototype.addMediaOptionListener = function() {
    this.userRefUnsubscribe = this.userRef.onSnapshot((doc) => {
        let data = doc.data();
        if (data === undefined) {
            return;
        }
        if (data['video'] != this.mediaOption['video']) {
            this.prepareDialog('video', data['video']).showModal();
        } else if (data['audio'] != this.mediaOption['audio']) {
            this.prepareDialog('audio', data['audio']).showModal();
        }
    });
}

AppController.prototype.onMeetNow = async function() {
    var res = await this.userCollection.get();
    if (res.size >= this.maxUsers) {
        console.log('This room is FULL!! You cannot join this room');
        this.joinErrorDialog.showModal();
        return ;
    }

    await this.addUser();
    
    this.hide_(previewDiv);
    this.showMeetingRoom();
}

AppController.prototype.enableCaption = function() {
    if (!this.recognition_) {
        this.recognition_ = new Recognition();
        this.recognition_.updateCaptionStatus = function(status) {
            if (this.captionOn == status) {
                console.log('caption status is same with current '
                            + this.captionOn + " == " + status);
            } else {
                this.captionOn = status;
                if (status == true) {
                    this.captionButton.classList.add('on');
                } else {
                    this.captionButton.classList.remove('on');
                }
                console.log('caption status chaged to '+ this.captionOn);
            }
        }.bind(this)
    }
    
    if (this.captionOn == true) {
        this.recognition_.stop();
    } else {
        this.recognition_.start();
    }
}

AppController.prototype.hideMeetingRoom = function() {
    this.meetNowButton.disabled = false;
    this.show_(loginDiv);
    this.hide_(videosDiv);
    this.hide_(previewDiv);
    this.hide_(activeDiv);
    this.hide_(optionDiv);
}

AppController.prototype.showMeetingRoom = function () {
    this.meetNowButton.disabled = true;
    this.hide_(loginDiv);
    this.show_(videosDiv);
    this.show_(previewDiv);
    this.show_(activeDiv);
    this.show_(optionDiv);
    //this.show_(captionDiv);
}

AppController.prototype.showLoginMenu = function () {
    this.createButton.disabled = false;
    this.joinButton.disabled = false;
    this.qrCheckInButton.disabled = false;
    this.targetRoom.disabled = false;
    this.targetRoom.value = "";

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
