'use strict';

class ReceivingData {
    constructor() {
    }

    toString() {
        return null;
    }
}

class SoundReceivingData extends DetectingData {
    constructor() {
        super();
        this.instant = 0;
        this.isMax = false;
    }

    toString() {
        return "size: " + this.size + ", x: " + this.x + ", y: " + this.y;
    }
}

class FaceReceivingData extends DetectingData {
    constructor() {
        super();
        this.size = 0;
        this.x = 0;
        this.y = 0;
    }

    toString() {
        return "size: " + this.size + ", x: " + this.x + ", y: " + this.y;
    }
}

class BaseReceiver {
    constructor() {
        this.data = null;
    }

    drawData(params) {
        return;
    }

    clearData() {
    }

    detecting() {
        return;
    }

    broadcast(userRef) {
        return;
    }
}

class FaceReceiver extends BaseReceiver {
    constructor(receiverStream, videoElement, outerId, innerId) {
        super();
        console.log("new FaceReceiver!!");
        this.readableStream = receiverStream.readableStream;
		this.writableStream = receiverStream.writableStream;
        this.videoElement = videoElement;
        this.outerDiv = document.querySelector("#" + outerId);
        this.innerDiv = document.querySelector("#" + innerId);
        this.data = null;
        const transformStream = new TransformStream ({transform: this.extract});
		this.readableStream
				.pipeThrough (transformStream)
				.pipeTo (this.writableStream);
    }

    drawData = () => {
        if (this.data == null) return;
        //Show a bit more than the face
	    const faceSize = Math.min(this.data.size*2,
            this.innerDiv.offsetWidth, this.innerDiv.offsetHeight);
	    const outerSize = this.outerDiv.offsetWidth;
	    //Calculate zoom 
	    const zoom = outerSize / faceSize;
	    //Move inner to show face
	    var left = (this.outerDiv.offsetWidth/2 - this.data.x*zoom);
	    var top = (this.outerDiv.offsetHeight/2 - this.data.y*zoom);
	    //Don't go out of video image
	    left = Math.max(this.outerDiv.offsetWidth - this.innerDiv.offsetWidth*zoom, left);
	    left = Math.min(0, left);
	    top = Math.max(this.outerDiv.offsetHeight - this.innerDiv.offsetHeight*zoom, top);
	    top = Math.min(0, top);
	    //Set style to move video
	    Object.assign(this.innerDiv.style,{
    		transform	:  "scale("+zoom+")",
		    left		:  left + "px",
		    top		:  top + "px"
	    });
        this.data = null;
    }

    extract = async (chunk, controller) => {
        try {
            const view = new DataView (chunk.data);
            const last = view.getUint8 (chunk.data.byteLength-1);
            if (last)
            {
                this.data = new FaceReceivingData();
                //Update size
                this.data.size = (last - 1) * 16;
                //Get face center
                this.data.x = view.getUint16 (chunk.data.byteLength-5);
                this.data.y = view.getUint16 (chunk.data.byteLength-3);
            }
            //Remove metadata
            chunk.data = chunk.data.slice(0,chunk.data.byteLength - (last ? 5 : 1))
            //Transfer the frame to controller
            controller.enqueue (chunk);
        } catch (e) {
            console.error (e);
        }
    }

    clearData = () => {
    }
}

class SoundReceiver extends BaseReceiver {
    constructor(receiverStream, videoElement, outerId, innerId) {
        super();
        console.log("new SoundReceiver!!");
        this.readableStream = receiverStream.readableStream;
		this.writableStream = receiverStream.writableStream;
        this.videoElement = videoElement;
        this.outerDiv = document.querySelector("#" + outerId);
        this.innerDiv = document.querySelector("#" + innerId);
        this.data = null;
        const transformStream = new TransformStream ({transform: this.extract});
		this.readableStream
				.pipeThrough (transformStream)
				.pipeTo (this.writableStream);
    }

    changeClass(element, from, to) {
        element.classList.remove(from);
        element.classList.add(to);
    }

    drawData = () => {
        if (this.data == null) return;
        if (this.data.isMax) {
            this.changeClass(this.outerDiv, 'outer-div2', 'outer-div');
            this.changeClass(this.innerDiv, 'inner-div2', 'inner-div');
        } else {
            this.changeClass(this.outerDiv, 'outer-div', 'outer-div2');
            this.changeClass(this.innerDiv, 'inner-div', 'inner-div2');
        }
    }

    extract = async (chunk, controller) => {
        try {
            const view = new DataView (chunk.data);
            const last = view.getUint8 (chunk.data.byteLength-1);
            if (last)
            {
                this.data = new SoundReceivingData();
                this.data.instant = view.getFloat32 (chunk.data.byteLength-5);
            }
            chunk.data = chunk.data.slice(0,chunk.data.byteLength - (last ? 5 : 1));
            controller.enqueue (chunk);
        } catch (e) {
            console.error (e);
        }
    }

    clearData = () => {
    }
}

function receivingStart(receiver) {
    receiver.receiving();
}

var gReceiver = null;
class Receiver {
    constructor() {
        console.log('new Receiver!!');
        this.receivers = [];
        this.soundReceivers = [];
        this.timerId = null;
    }

    start() {
        console.log('start receivers');
        this.timerId = setInterval(receivingStart, 1000, this);
    }

    stop() {
        console.log('stop receivers');
        clearInterval(this.timerId);
        this.receivers.forEach(receiver => {
            receiver.clearData();
        });
    }

    addFaceReceiver = (remoteStream, videoElement, outerId, innerId) => {
        console.log('add face receiver');
        this.receivers.push(new FaceReceiver(remoteStream, videoElement, outerId, innerId));
    }

    addSoundReceiver = (remoteStream, videoElement, outerId, innerId) => {
        console.log('add sound receiver');
        this.receivers.push(new SoundReceiver(remoteStream, videoElement, outerId, innerId));
    }

    findMaxSound() {
        let maxSound = null;
        this.receivers.forEach(receiver=>{
            if (typeof(receiver) !== SoundReceiver) {
                return;
            }
            if (maxSound == null) {
                maxSound = receiver;
            }
            if (maxSound.data.instant <= receiver.data.instant) {
                maxSound.data.isMax = false;
                maxSound = receiver;
                maxSound.data.isMax = true;
            } else {
                receiver.data.isMax = false;
            }
        })
    }

    receiving() {
        this.findMaxSound();
        this.receivers.forEach(function (receiver) {
            receiver.drawData();
        });
    }

    static getReceiver() {
        if (gReceiver == null)
            gReceiver = new Receiver();
        return gReceiver;
    }

    static onReceiveStream(...args) {
        let type = args[0];
        if (type === "video") {
            let receiverStream = args[1];
            let videoElement = args[2];
            let outerId = args[3];
            let innerId = args[4];
            Receiver.getReceiver().addFaceReceiver(receiverStream, videoElement, outerId, innerId);
        } else if (type === "audio") {
            let receiverStream = args[1];
            let videoElement = args[2];
            let outerId = args[3];
            let innerId = args[4];
            Receiver.getReceiver().addSoundReceiver(receiverStream, videoElement, outerId, innerId);
        }
    }
}
