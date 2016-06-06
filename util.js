// Comby - yet another parser combinator library for JavaScript
// Common utility functions
// Copyright (c) 2016 Crystalline Emerald
// Licensed under MIT license.

function randItem(array, random) {
    random = random || Math.random;
    return array[Math.floor(random()*array.length)];
}

function randInt(_min,_max) {
    _min = _min || 0;
    _max = _max || 100;
    return Math.ceil((_max-_min)*Math.random())+_min;
}

function reduce(arr, fn) {
    if (arr.length < 2) return arr[0];
    else {
        var acc = fn(arr[0], arr[1]);
        for (var i=2; i<arr.length; i++) {
            acc = fn(acc, arr[i]);
        }
        return acc;
    }
}

function timeDiff(startTime, digits) {
    digits = digits || 1;
    return ((Date.now()-startTime)/1000).toFixed(digits)+'s';
}

function REPL(inviteMsg, errMsg, evalFn, printFn){
    var readline = require('readline');
    var rl = readline.createInterface({input: process.stdin, output: process.stdout});
    var invited = false;
    function _REPL() {
        rl.question((invited ? '' : inviteMsg)+'>', (answer) => {
            if (!invited) invited = true;
            var ans = evalFn(answer);
            if (ans !== undefined) printFn(ans, answer);
            else pr(errMsg);
            _REPL();
        });
    }
    _REPL();
}

function cloneObject(obj) {
    if (obj === null || typeof obj !== 'object') { return obj }
    var temp = obj.constructor();
    for (var key in obj) { temp[key] = cloneObject(obj[key]) }
    return temp;
}

module.exports = {
    randItem: randItem,
    randInt: randInt,
    reduce: reduce,
    timeDiff: timeDiff,
    cloneObject: cloneObject,
    REPL: REPL
}
