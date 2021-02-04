'use strict';

var InfoBox = function() {
    console.log("new InfoBox!!");

    this.roomInfo = document.querySelector('#roomInfo');
    this.noticeInfo = document.querySelector('#noticeInfo');
}

InfoBox.prototype.resetMessage = function () {
    this.normal_(this.roomInfo);
    this.normal_(this.noticeInfo);
    this.roomInfo.innerHTML = '';
    this.noticeInfo.innerHTML = '';
}

InfoBox.prototype.loginRoomMessage = function (isCaller, roomId) {
    this.normal_(this.roomInfo);

    if (isCaller) {
        this.roomInfo.innerHTML = `Current room is ${roomId}. You are a Host!`;
    } else {
        this.roomInfo.innerHTML = `You joined this room ${roomId}. You are an Attendee!`;
    }
    this.noticeInfo.innerHTML = "Press [Disconnect] button at first, and then exit the app";
}

InfoBox.prototype.loginErrorMessage = function (roomId) {
    this.error_(this.roomInfo);
    this.roomInfo.innerHTML = `You cannot join this room ${roomId} - It's not exists`;
}

InfoBox.prototype.roomExistErrorMessage = function (roomId) {
    this.error_(this.roomInfo);
    this.roomInfo.innerHTML = `Room ${roomId} is already created. Choose another room number`;
}

InfoBox.prototype.error_ = function(element) {
    element.classList.add('error-label');
}

InfoBox.prototype.normal_ = function(element) {
    element.classList.remove('error-label');
}