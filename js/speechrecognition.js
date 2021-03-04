'use strict';

/*!
 *
 * WebRTC Lab
 * @author dodortus (codejs.co.kr / dodortus@gmail.com)
 *
 */

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent

var final_span = document.querySelector('#final_span');
var interim_span = document.querySelector('#interim_span');

var Recognition = function() {
    if (typeof SpeechRecognition !== 'function') {
        alert('unable to use speech recognition API');
        return false;
    }

    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ko-KR';

    this.isRecognizing = false;
    this.finalTranscript = '';

    this.recognition.addEventListener('start', this.onStart.bind(this));
    this.recognition.addEventListener('result', this.onResult.bind(this));
    this.recognition.addEventListener('end', this.onEnd.bind(this));
    this.recognition.addEventListener('error', this.onError.bind(this));
    this.recognition.addEventListener('audiostart', this.onAudioStart.bind(this));
    this.recognition.addEventListener('audioend', this.onAudioEnd.bind(this));

}

Recognition.prototype.start = function() {
    console.log('recognition start!');

    if (this.isRecognizing) {
        this.recognition.stop();
        return;
    }
    
    this.recognition.start();
  
    this.finalTranscript = '';
    final_span.innerHTML = '';
    interim_span.innerHTML = '';
}

Recognition.prototype.stop = function() {
    console.log('recognition stop!');

    if (!this.isRecognizing) {
        console.log('already stopped');
        return;
    }

    this.recognition.stop();
}

Recognition.prototype.onStart = function () {
    console.log('onstart', arguments);
    this.isRecognizing = true;
    this.updateCaptionStatus(true);
}

Recognition.prototype.onResult = function (event) {
    console.log('onresult', event);
  
    let interimTranscript = '';
    if (typeof event.results === 'undefined') {
        this.recognition.onend = null;
        this.recognition.stop();
        return;
    }

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
            this.finalTranscript += transcript;
        } else {
            interimTranscript += transcript;
        }
    }

    this.finalTranscript = capitalize(this.finalTranscript);
    final_span.innerHTML = linebreak(this.finalTranscript);
    interim_span.innerHTML = linebreak(interimTranscript);

    console.log('finalTranscript', this.finalTranscript);
    console.log('interimTranscript', interimTranscript);
}

Recognition.prototype.onEnd = function () {
    console.log('onend', arguments);
    this.isRecognizing = false;

    if (!this.finalTranscript) {
        console.log('empty finalTranscript');
        //return false;
    }

    this.updateCaptionStatus(false);
}

Recognition.prototype.onError = function (event) {
    console.log('onerror', event);
  
    /*if (event.error.match(/no-speech|audio-capture|not-allowed/)) {
        this.ignoreEndProcess = true;
    }*/
}

Recognition.prototype.onAudioStart = function() {
    console.log('onAudioStart');
}

Recognition.prototype.onAudioEnd = function() {
    console.log('onAudioEnd');
}

const FIRST_CHAR = /\S/;
const TWO_LINE = /\n\n/g;
const ONE_LINE = /\n/g;

/**
 * 개행 처리
 * @param {string} s
 */
function linebreak(s) {
    return s.replace(TWO_LINE, '<p></p>').replace(ONE_LINE, '<br>');
}

/**
 * 첫문자를 대문자로 변환
 * @param {string} s
 */
function capitalize(s) {
    return s.replace(FIRST_CHAR, function (m) {
        return m.toUpperCase();
    });
}