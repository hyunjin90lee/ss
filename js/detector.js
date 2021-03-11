'use strict';

let loaded = false;
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(
      "./res/models"
    ),
    faceapi.nets.faceRecognitionNet.loadFromUri(
      "./res/models"
    )
]).then(()=>loaded = true);

class DetectingData {
    constructor() {
    }

    toString() {
        return null;
    }
}

class StreamDetectingData extends DetectingData {
    constructor() {
        super();
        this.instant = 0;
    }

    toString() {
        return "instant: " + this.instant;
    }
}


class FaceDetectingData extends DetectingData {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.size = 0;
    }

    toString() {
        return "x: " + this.x + ", y: " + this.y + ", size: " + this.size;
    }
}

class BaseDetector {
    constructor() {
        this.data = null;
    }

    clearData() {
    }

    detecting() {
        return;
    }

    async insert(chunk, controller) {
    }

    addSenderStream(senderStream) {
    }
}

class FaceDetector extends BaseDetector {
    constructor(videoElement) {
        super();
        console.log("new FaceDetector!!");
        this.options = new faceapi.TinyFaceDetectorOptions({ 
            inputSize	: 320,
            scoreThreshold  : 0.50
        });
        this.videoElement = videoElement;
        this.data = new FaceDetectingData();
    }

    insert = async (chunk, controller) => {
        try {
            let metadata;
            if (this.data.size == 0) {
                metadata = new ArrayBuffer (1);
                const view = new DataView (metadata);
                view.setUint8 (0, 0);
            } else {
                metadata = new ArrayBuffer (5);
                const view = new DataView (metadata);
                view.setUint16 (0, this.data.x );
                view.setUint16 (2, this.data.y );
                view.setUint8 (4, this.data.size/16 + 1);
            }
            const frame = chunk.data;
            chunk.data = new ArrayBuffer(metadata.byteLength + chunk.data.byteLength);
            const data = new Uint8Array (chunk.data);
            data.set(new Uint8Array (frame), 0);
            data.set (new Uint8Array (metadata), frame.byteLength);
            controller.enqueue (chunk);
        } catch (e) {
            console.error (e);
        }
    }

    addSenderStream = (senderStream)=>{
        let readableStream = senderStream.readableStream;
        let writableStream = senderStream.writableStream;
        const transformStream = new TransformStream ({transform: this.insert});
		readableStream
				.pipeThrough (transformStream)
				.pipeTo (writableStream);
    }

    detecting = async () => {
        const result = await faceapi.detectSingleFace(
            this.videoElement, this.options);
        if (result) {
            this.data.size = Math.max(result.box.width, result.box.height);
            this.data.x = (result.box.x + result.box.width/2).toFixed(2);
            this.data.y = (result.box.y + result.box.height/2).toFixed(2);
        }
    }

    clearData = () => {
    }
}

class SoundDetector extends BaseDetector {
    constructor(audioStream, audioContext) {
        super();
        console.log("new SoundDetector!!");
        this.data = new StreamDetectingData();
        this.audioStream = audioStream;
        this.audioContext = audioContext;
        this.script = audioContext.createScriptProcessor(2048, 1, 1);
        this.script.onaudioprocess = this.updateData.bind(this);
        this.padding = 5;
        this.connectToSource();
    }

    insert = async (chunk, controller) => {
        try {
            let metadata;
            if (this.data.instant == 0) {
                metadata = new ArrayBuffer (1);
                const view = new DataView (metadata);
                view.setUint8 (0, 0);
            } else {
                metadata = new ArrayBuffer (5);
                const view = new DataView (metadata);
                view.setFloat32 (0, this.data.instant);
                view.setUint8 (4, 1);
            }
            const frame = chunk.data;
            chunk.data = new ArrayBuffer(metadata.byteLength + chunk.data.byteLength);
            const data = new Uint8Array (chunk.data);
            data.set(new Uint8Array (frame), 0);
            data.set (new Uint8Array (metadata), frame.byteLength);
            controller.enqueue (chunk);
        } catch (e) {
            console.error (e);
        }
    }

    addSenderStream = (senderStream)=>{
        let readableStream = senderStream.readableStream;
        let writableStream = senderStream.writableStream;
        const transformStream = new TransformStream ({transform: this.insert});
		readableStream
				.pipeThrough (transformStream)
				.pipeTo (writableStream);
    }

    connectToSource = () => {
        try {
            this.mic = this.audioContext.createMediaStreamSource(this.audioStream);
            this.mic.connect(this.script);
            this.script.connect(this.audioContext.destination);
        } catch (error) {
            if (error) {
                alert(error);
            }
        }
    }

    updateData = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        this.data.instant = (Math.max(...input) * 10).toFixed(2);
    }

    clearData = () => {
        super.clearData();
        this.mic.disconnect(this.script);
        this.script.disconnect(this.audioContext.destination);
    }
}

function detectingStart(detector) {
    detector.detecting();
}

var gDetector = null;
class Detector {
    constructor(videoElement) {
        console.log('new Detector!!');
        this.videoElement = videoElement;
        this.faceDetector = null;
        this.soundDetector = null;
        this.detectors = [];
        this.timerId = null;
        try {
            let AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (error) {
            alert("Web Audio API not supported, name: " + error.name + ", message: " + error.message);
        }
    }

    start() {
        console.log('start detectors');
        this.addSoundDetector();
        this.addFaceDetector();
        this.timerId = setInterval(detectingStart, 1000, this);
    }

    stop() {
        console.log('stop detectors');
        clearInterval(this.timerId);
        this.detectors.forEach(detector => {
            detector.clearData();
        });
    }
    
    addSoundDetector = () => {
        console.log('add sound detector');
        this.soundDetector = new SoundDetector(this.videoElement.srcObject, this.audioContext);
        this.detectors.push(this.soundDetector);
    }

    addFaceDetector = () => {
        console.log('add face detector');
        this.faceDetector = new FaceDetector(this.videoElement);
        this.detectors.push(this.faceDetector);
    }

    detecting() {
        this.detectors.forEach(function (detector) {
            detector.detecting();
        });
    }

    static getDetector(...args) {
        if (gDetector == null)
            gDetector = new Detector(args[0]);
        return gDetector;
    }

    static addVideoSenderStream(senders) {
        if (Detector.getDetector().faceDetector != null) {
            Detector.getDetector().faceDetector.addSenderStream(senders);
        }
    }

    static addAudioSenderStream(senders) {
        if (Detector.getDetector().soundDetector != null) {
            Detector.getDetector().soundDetector.addSenderStream(senders);
        }
    }
}
