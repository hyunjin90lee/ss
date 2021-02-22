'use strict';

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
        this.slow = 0;
    }

    toString() {
        return "instant: " + this.instant + ", slow: " + this.slow;
    }
}

class BaseDetector {
    constructor(canvasId) {
        this.canvas = document.querySelector("#" + canvasId);
        this.canvasId = canvasId;
        this.data = null;
    }

    drawData() {
        return;
    }

    clearData() {
        var ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    detecting() {
        return;
    }
}

class SoundDetector extends BaseDetector {
    constructor(canvasId, audioStream, audioContext) {
        super(canvasId);
        console.log("[HJ] SoundDetector");
        this.data = new StreamDetectingData();
        this.audioStream = audioStream;
        this.audioContext = audioContext;
        this.script = audioContext.createScriptProcessor(2048, 1, 1);
        this.script.onaudioprocess = this.updateData.bind(this);
        this.padding = 5;
        this.connectToSource();
        this.loadImage();
    }

    loadImage = () => {
        this.img = document.getElementById('sound-image');
        window.ctx = this.canvas.getContext('2d');
        this.imgWidth = this.img.width;
        this.imgHeight = this.img.height;
        this.xPos = this.canvas.width - this.imgWidth - this.padding;
    }

    drawData = () => {
        if (window.ctx == undefined) return;
        window.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        window.ctx.save();
        window.ctx.fillStyle = "red";
        window.ctx.fillRect(this.xPos, this.padding, this.imgWidth, this.imgHeight);
        window.ctx.globalCompositeOperation = "destination-in";
        window.ctx.globalAlpha = this.data.instant;
        window.ctx.drawImage(this.img, this.xPos, this.padding, this.imgWidth, this.imgHeight);
        window.ctx.restore();
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
        let i;
        let sum = 0.0;
        for (i = 0; i < input.length; ++i) {
            sum += input[i] * input[i];
        }
        this.data.instant = (sum / input.length * 100).toFixed(2);
        this.data.slow = 0.95 * this.data.slow + 0.05 * this.data.instant;
        this.drawData();
    }
}

var gDetector = null;
class Detector {
    constructor(audioContext) {
        console.log('[HJ] new Detector!!');
        this.detectors = [];
        this.audioContext = audioContext;
    }

    start() {
        console.log('start detectors');
    }

    stop() {
        console.log('stop detectors');
        clearInterval(this.timerId);
        this.detectors.forEach(detector => {
            detector.clearData();
        });
    }

    addSoundDetector = (canvasId, audioStream) => {
        console.log('add sound detector:', canvasId);
        this.detectors.push(new SoundDetector(canvasId, audioStream, this.audioContext));
    }

    removeStreamDetector = (canvasId) => {
        let index = this.detectors.findIndex(detector => detector.canvasId == canvasId);
        if (index >= 0) {
            console.log("remove sound:", this.detectors[index].canvasId, index);
            this.detectors.splice(index, 1);
        }
    }

    detecting() {
        console.log('detectors:', this.detectors.length);
    }

    static getDetector(...params) {
        if (gDetector == null)
            gDetector = new Detector(params[0]);
        return gDetector;
    }

    static onStreamChanged(...args) {
        let type = args[0];
        console.log(args);
        if (type === "connected") {
            let canvasId = args[1];
            let audioStream = args[2];
            Detector.getDetector().addSoundDetector(canvasId, audioStream);        
        } else if (type === "disconnected") {
            let canvasId = args[1];
            Detector.getDetector().removeStreamDetector(canvasId);
        }
    }
}