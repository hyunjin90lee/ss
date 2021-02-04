'use strict';

class MonitoringData {
    constructor() {
    }

    toString() {
        return null;
    }
}

class SystemMonitoringData extends MonitoringData {
    constructor() {
        super();
        this.cpuUsage = 0;
        this.memoryUsage = 0;
    }
    toString() {
        return 'mem:' + this.memoryUsage.toFixed(2) + ' MB';
    }
}

class StreamMonitoringData extends MonitoringData {
    constructor() {
        super();
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.fps = 0;
        this.videoJitter = 0;
        this.audioJitter = 0;
    }

    toString() {
        if (this.audioJitter == 0) {
            return ' res:' + this.videoWidth + 'x' + this.videoHeight +
            ' fps:' + this.fps;    
        }
        return ' res:' + this.videoWidth + 'x' + this.videoHeight +
            ' fps:' + this.fps +
            ' jitter:' + this.audioJitter;
    }
}

class BaseMonitor {
    constructor(canvasId, videoId, isRemote) {
        this.canvas = document.querySelector("#" + canvasId);
        this.video = document.querySelector("#" + videoId);
        this.canvasId = canvasId;
        this.isRemote = isRemote;
        this.textAlign = "left";
        this.data = null;
        this.x = 0;
        this.y = 15;
    }

    drawData() {
        if (this.canvas == null) {
            console.log('draw failed')
            return;
        }
        var ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.font = 'bold 12px Courier';
        ctx.fillStyle = "red";
        ctx.textAlign = this.textAlign;
        ctx.fillText(this.data.toString(), this.x, this.y);
    }

    clearData() {
        var ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    monitoring() {
        return;
    }
}

class SystemMonitor extends BaseMonitor {
    constructor(canvasId, videoId) {
        super(canvasId, videoId, false);
        this.textAlign = "right";
        this.x = 315;
        this.y = 15;
        this.data = new SystemMonitoringData();
    }

    monitoring() {
        this.monitoringMemoryUsage();
    }

    async monitoringMemoryUsage() {
        if (performance.measureMemory) {
            let result;
            try {
                result = await performance.measureMemory();
            } catch (error) {
                if (error instanceof DOMException &&
                    error.name === "SecurityError") {
                    console.log("The context is not secure.");
                } else {
                    throw error;
                }
            }
            this.data.memoryUsage = result.bytes / (1024 * 1024);
            //console.log('mem:', this.data.memoryUsage);
        }
    }
}

class StreamMonitor extends BaseMonitor {
    constructor(canvasId, videoId, peerConnection, isRemote) {
        super(canvasId, videoId, isRemote);

        console.log("stream monitor id:", canvasId);
        this.senders = peerConnection.getSenders();
        this.receivers = peerConnection.getReceivers();
        this.data = new StreamMonitoringData();
    }

    monitoring() {
        if (this.isRemote) {
            this.monitoringReceiverStats();
        } else {
            this.monitoringSenderStats();
        }
    }

    updateData(stats) {
        for (let report of stats.values()) {
            if (report.type != "inbound-rtp" && report.type != "outbound-rtp")
                continue;
            
            //console.log(report);
            if (report.id.indexOf("RTCInboundRTPVideoStream") >= 0 || 
                report.id.indexOf("RTCOutboundRTPVideoStream") >= 0) {
                if (report.frameWidth != null) {
                    this.data.videoWidth = report.frameWidth;
                    this.data.videoHeight = report.frameHeight;
                    this.data.fps = report.framesPerSecond;
                }
            } else if (report.id.indexOf("RTCInboundRTPAudioStream") >= 0 ||
                report.id.indexOf("RTCOutboundRTPAudioStream") >= 0) {
                if (report.jitter != null)    
                    this.data.audioJitter = report.jitter;
            }
        }
    }

    async monitoringReceiverStats() {
        this.receivers.forEach(async(receiver) => {
            let stats = await receiver.getStats();
            this.updateData(stats);
        });
    }

    async monitoringSenderStats() {
        this.senders.forEach(async(sender) => {
            let stats = await sender.getStats();
            this.updateData(stats);
        });
    }
}

function monitoringStart(monitor) {
    monitor.monitoring();
}

var gMonitor = null;
class Monitor {
    constructor() {
        console.log('new Monitor!!');
        this.monitors = [];
        this.timerId = null;
    }

    start() {
        console.log('start monitor');
        this.timerId = setInterval(monitoringStart, 1000, this);
    }

    stop() {
        console.log('stop monitor');
        clearInterval(this.timerId);
        this.monitors.forEach(monitor => {
            monitor.clearData();
        });
    }

    addSystemMonitor(canvasId, videoId) {
        console.log('add system monitor:', canvasId, videoId);
        this.monitors.push(new SystemMonitor(canvasId, videoId));
    }

    addStreamMonitor(canvasId, videoId, peerConnection, isRemote) {
        console.log('add stream monitor:', canvasId)
        this.monitors.push(new StreamMonitor(canvasId, videoId, peerConnection, isRemote));
    }

    removeStreamMonitor(canvasId) {
        let index = this.monitors.findIndex(monitor => monitor.canvasId == canvasId);
        if (index >= 0) {
            console.log("remove monitor:", this.monitors[index].canvasId, index);
            this.monitors.splice(index, 1);
        }
    }

    monitoring() {
        console.log('video monitors:', this.monitors.length);
        this.monitors.forEach(function (monitor) {
            monitor.monitoring();
            monitor.drawData();
        });
    }

    static getMonitor() {
        if (gMonitor == null)
            gMonitor = new Monitor();
        return gMonitor;
    }

    static onStateChanged(...args) {
        let type = args[0];
        console.log(args);
        if (type === "connected") {
            let canvasId = args[1];
            let videoId = args[2];
            let peerConnection = args[3];
            if (canvasId == "remotemonitor1") {
                Monitor.getMonitor().addStreamMonitor("localmonitor", "localvideo", peerConnection, false);    
            }
            Monitor.getMonitor().addStreamMonitor(canvasId, videoId, peerConnection, true);
        
        } else if (type === "disconnected") {
            let canvasId = args[1];
            Monitor.getMonitor().removeStreamMonitor(canvasId);
        }
    }
}