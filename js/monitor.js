'use strict';

//const performanceDiv = document.querySelector('#performance-div');

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
        this.framesDecoded = 0;
        this.framesEncoded = 0;
        this.d_fps_buf = "";
        this.e_fps_buf = "";
        this.sum_d_fps = 0;
        this.sum_e_fps = 0;
        this.d_fpsCnt = 0;
        this.e_fpsCnt = 0;
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

    getCanvasId() {
        return this.canvasId;
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
        if (performance.measureMemory || performance.measureUserAgentSpecificMemory) {
            let result;
            try {
                if (performance.measureMemory) {
                    result = await performance.measureMemory();
                } else if (performance.measureUserAgentSpecificMemory) {
                    result = await performance.measureUserAgentSpecificMemory();
                }
            } catch (error) {
                if (error instanceof DOMException &&
                    error.name === "SecurityError") {
                    console.log("The context is not secure.");
                    return;
                } else {
                    throw error;
                }
            }
            this.data.memoryUsage = result.bytes / (1024 * 1024);
            console.log('mem:', this.data.memoryUsage);
        }
    }
}

var TESTCNT = 20;

class StreamMonitor extends BaseMonitor {
    constructor(canvasId, videoId, peerConnection, isRemote, pcName) {
        super(canvasId, videoId, isRemote);

        console.log("stream monitor id:", canvasId, " in ", pcName);
        this.senders = peerConnection.getSenders();
        this.receivers = peerConnection.getReceivers();
        this.inboundData = [];
        this.outboundData = [];
        this.pcName = pcName;

        if (this.isRemote) {
            this.receivers.forEach(receiver => {
                this.inboundData.push(new StreamMonitoringData());
            });
        } else {
            this.senders.forEach(sender => {
                this.outboundData.push(new StreamMonitoringData());
            })
        }
    }

    async monitoring() {
        if (this.isRemote) {
            await this.monitoringReceiverStats();
        } else {
            await this.monitoringSenderStats();
        }
    }

    flushData(data) {
        performanceDiv.innerHTML += "[" + this.pcName + "] ";
 
        if (data.d_fps_buf) {
            performanceDiv.innerHTML += " avg d_fps (" + (data.sum_d_fps/TESTCNT).toFixed(1) + ")";
            performanceDiv.innerHTML += "<br/> framesDecoded/s "+ data.d_fps_buf + '<br/>';
            console.log(data.d_fps_buf);
            data.d_fps_buf = "";
            data.sum_d_fps = 0;
            data.framesDecoded = 0;
            data.d_fpsCnt = 0;
            return;
        }

        if (data.e_fps_buf) {
            performanceDiv.innerHTML += "(" + data.videoWidth + 'x' + data.videoHeight + ")";
            performanceDiv.innerHTML += " avg e_fps (" + (data.sum_e_fps/TESTCNT).toFixed(1) + ")";
            performanceDiv.innerHTML += "<br/> framesEncoded/s "+ data.e_fps_buf + '<br/>';
            console.log(data.e_fps_buf);
            data.e_fps_buf = "";
            data.sum_e_fps = 0;
            data.framesEncoded = 0;
            data.e_fpsCnt = 0;
            return;
        }

    }

    updateInboundData(id, stats) {
        for (let report of stats.values()) {
            if (report.type != "inbound-rtp")
                continue;
            
            //console.log(report);
            if (report.id.indexOf("RTCInboundRTPVideoStream") >= 0) {
                var lastFramesDecoded = this.inboundData[id].framesDecoded;
                this.inboundData[id].framesDecoded = report.framesDecoded;

                if (lastFramesDecoded == 0)
                    continue;

                var d_fps = report.framesDecoded - lastFramesDecoded;
                this.inboundData[id].sum_d_fps += d_fps;
                this.inboundData[id].d_fps_buf += d_fps + ' ';
                this.inboundData[id].d_fpsCnt++;
                if (this.inboundData[id].d_fpsCnt == TESTCNT) {
                    this.flushData(this.inboundData[id]);
                }
            } else if (report.id.indexOf("RTCInboundRTPAudioStream") >= 0) {
                if (report.jitter != null)    
                    this.inboundData[id].audioJitter = report.jitter;
            }
        }
    }

    updateOutboundData(id, stats) {
        for (let report of stats.values()) {
            if (report.type != "outbound-rtp")
                continue;
            
            //console.log(report);
            if (report.id.indexOf("RTCOutboundRTPVideoStream") >= 0) {
                var lastFramesEncoded = this.outboundData[id].framesEncoded;
                this.outboundData[id].framesEncoded = report.framesEncoded;

                if (lastFramesEncoded == 0)
                    continue;

                this.outboundData[id].videoWidth = report.frameWidth;
                this.outboundData[id].videoHeight = report.frameHeight;
                this.outboundData[id].fps = report.framesPerSecond;

                var e_fps = report.framesEncoded - lastFramesEncoded

                this.outboundData[id].sum_e_fps += e_fps;
                this.outboundData[id].e_fps_buf += e_fps + ' ';
                this.outboundData[id].e_fpsCnt++;
                if (this.outboundData[id].e_fpsCnt == TESTCNT) {
                    this.flushData(this.outboundData[id]);
                }
            } else if (report.id.indexOf("RTCOutboundRTPAudioStream") >= 0) {
                if (report.jitter != null)    
                    this.outboundData[id].audioJitter = report.jitter;
            }
        }
    }

    async monitoringReceiverStats() {
        var index = 0;
        this.receivers.forEach(async(receiver) => {
            let stats = await receiver.getStats();
            this.updateInboundData(index, stats);
            ++index;
        });
    }

    async monitoringSenderStats() {
        var index = 0;
        this.senders.forEach(async(sender) => {
            let stats = await sender.getStats();
            this.updateOutboundData(index, stats);
            ++index;
        });
    }

}

function monitoringStart(monitor) {
    if (Monitor.getMonitor().isMonitoring) {
        monitor.monitoring();
    }
}

var gMonitor = null;
class Monitor {
    constructor() {
        console.log('new Monitor!!');
        this.monitors = [];
        this.timerId = null;
        this.isMonitoring = false;
    }

    start() {
        console.log('start monitor');
        this.isMonitoring = true;
        performanceDiv.innerHTML = "";
        this.timerId = setInterval(monitoringStart, 1000, this);
    }

    stop() {
        console.log('stop monitor');
        this.isMonitoring = false;
        clearInterval(this.timerId);
        this.monitors.forEach(monitor => {
            monitor.clearData();
        });
    }

    addSystemMonitor(canvasId, videoId) {
        console.log('add system monitor:', canvasId, videoId);
        this.monitors.push(new SystemMonitor(canvasId, videoId));
    }

    addStreamMonitor(canvasId, videoId, peerConnection, isRemote, pcName) {
        console.log('add stream monitor:', canvasId)
        this.monitors.push(new StreamMonitor(canvasId, videoId, peerConnection, isRemote, pcName));
    }

    removeStreamMonitor(canvasId) {
        let index = this.monitors.findIndex(monitor => monitor.canvasId == canvasId);
        if (index >= 0) {
            console.log("remove monitor:", this.monitors[index].canvasId, index);
            this.monitors.splice(index, 1);
        }
    }

    findStreamMonitor(canvasId) {
        let index = this.monitors.findIndex(monitor => monitor.canvasId == canvasId);
        if (index == -1) return false;
        else return true;
    }

    monitoring() {
        console.log('video monitors:', this.monitors.length);
        this.monitors.forEach(function (monitor) {
            monitor.monitoring();
            //monitor.drawData();
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
            let pcName = args[4];
            Monitor.getMonitor().addStreamMonitor("localmonitor", "localvideo", peerConnection, false, pcName);    
            Monitor.getMonitor().addStreamMonitor(canvasId, videoId, peerConnection, true, pcName);
        
        } else if (type === "disconnected") {
            let canvasId = args[1];
            Monitor.getMonitor().removeStreamMonitor(canvasId);
        }
    }
}
