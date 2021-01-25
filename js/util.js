'use strict'

function randomNumber(strLength) {
    var value = "";
    for (var i=0; i<strLength; i++) {
        value += parseInt(Math.random() * 10);
    }
    return value;
}