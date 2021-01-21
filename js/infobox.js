'use strict';

var InfoBox = function() {
    console.log("new InfoBox!!");

    this.roomInfo = document.querySelector('#roomInfo');
    this.noticeInfo = document.querySelector('#noticeInfo');
}

InfoBox.prototype.resetMessage = function () {
    this.roomInfo.innerHTML = '';
    this.noticeInfo.innerHTML = '';
}

InfoBox.prototype.loginRoomMessage = function (isCaller, roomId) {
    if (isCaller) {
        this.roomInfo.innerHTML = `Current room is ${roomId} - You are a Host!`;
    } else {
        this.roomInfo.innerHTML = `You joined this room ${roomId} - You are an Attendee!`;
    }
    this.noticeInfo.innerHTML = "Press [Disconnect] button at first, and then exit the app";
}

InfoBox.prototype.loginErrorMessage = function (roomId) {
    this.roomInfo.innerHTML = `You cannot join this room ${roomId} - It's not exists`;
}