// Comby - yet another parser combinator library for JavaScript
// For more info see README.md or Wikipedia: https://en.wikipedia.org/wiki/Parser_combinator
// Copyright (c) 2016 Crystalline Emerald
// Licensed under MIT license.

var util = require('util');

var pr = console.log;

var pri = function (obj) {
    pr(util.inspect(obj, {showHidden: false, depth: null}));
}

//Simple string querying

var digits = '0123456789';
var ws = ' \t\r\n';
var enAlpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var enAlphaNum = digits+enAlpha;

function isDigit(d) { return digits.indexOf(d) > -1 }
function isWhitespace(d) { return ws.indexOf(d) > -1 }
function isAlpha(d) { return enAlpha.indexOf(d) > -1 }
function isAlphaNum(d) { return enAlphaNum.indexOf(d) > -1 }

function isFromStr(str) {
    return function (c) {
        return (c && c.length == 1 && str.indexOf(c) > -1);
    }
}

function strForEach(str, fn) {
    for (var i=0; i<str.length; i++) {
        fn(i);
    }
}

function strEvery(str, fn) {
    if (!str.length) return false;
    for (var i=0; i<str.length; i++) {
        if (!fn(i)) return false;
    }
    return true;
}

function isNumber(str) {
    return strEvery(str, isDigit);
}

// Simple regexp-based tokenizer
// Pass regexps as strings, note that to escape a chatracter in regexp string
// you should use \\ instead of \
// delim is delimiter regexp
// rules is an array of [token_regexp, token_process_fn]
// returns list of processed tokens

function makeTokenizer(rules) {
    function compileRE(re) {
        return new RegExp('^'+re);
    }
    return function (input) {
        var trules = rules.tokens.map(rule => [compileRE(rule[0]), rule[0], rule[1]]);
        var delim = compileRE(rules.delim);
        var matching = true;
        var tokens = [];
        var i = 0;
        while(matching && i < input.length) {
            var inp = input.substr(i);
            var m;
            if (m = inp.match(delim)) {
                i += m[0].length;
            } else {
                matching = false;
                for (var j=0; j<trules.length; j++) {
                    var tre = trules[j][0];
                    var tfn = trules[j][2];
                    if (m = inp.match(tre)) {
                        tokens.push(tfn(m[0]));
                        i += m[0].length;
                        matching = true;
                        break;
                    }
                }
            }
        }
        if (!matching) return false;
        //pr('TOKENS:',tokens);
        return tokens;
    }
}

// Parser combinator utils

function pState(seq, i, parsed) {
    this.s = seq;
    this.i = i || 0;;
    this.p = parsed;
}

function appendToken(input, token, incr) {
    incr = incr || 1;
    return new pState(input.s, input.i+incr, CONS(token, input.p));
}

function skipToken(input, N) {
    N = N || 1;
    return new pState(input.s, input.i+N, input.p);
}

function getToken(input) {
    return input.s[input.i];
}

function reachedEnd(input) {
    return input.s.length == input.i;
}

function _cons(l,r) {
    this.l = l;
    this.r = r;
}

function CONS(l,r) {
    return new _cons(l,r);
}

function LISTREF(l, index) {
    var top;
    var i = 0;
    for (top = l; !!top; top = top.r) {
        if (i === index) {
            return top.l;
        }
        i++;
    }
}

function LISTTAKER(l, N) {
    var top = l;
    var arr = [];
    var c = N;
    while (c-- && top) {
        arr.unshift(top.l);
        top = top.r;
    }
    return arr;
}

function LISTDROP(l, N) {
    var top = l;
    var arr = [];
    var c = N;
    while (c-- && top) {
        top = top.r;
    }
    return top;
}

function LISTTAKETO(l, target) {
    var top = l;
    var arr = [];
    while (top && (top !== target)) {
        arr.unshift(top.l);
        top = top.r;
    }
    return arr;
}

function ARR2LIST(arr) {
    var ret;
    for (var i=arr.length-1; i>-1; i--) {
        ret = CONS(arr[i], ret);
    }
    return ret;
}

function LIST2ARR(l) {
    var top = l;
    var arr = [];
    while (top) {
        arr.push(top.l);   
        top = top.r;
    }
    return arr;
}

//Parser combinators

function MATCH(obj) {
    return function (input) {
        var token = getToken(input);
        if ((typeof obj === 'function' && obj(token)) || token === obj) {
            return appendToken(input, token);
        } else {
            return false;
        }
    }
}

var $ = MATCH;

function matchObj(obj, ref) {
    for (k in ref) {
        if (ref.hasOwnProperty(k)) {
            if (obj[k] !== ref[k]) return false;
        }
    }
    return true;
}

function applyParser(obj, input) {
    if (typeof obj == 'function') {
        return obj(input);
    } else if (typeof obj == 'object') {
        var token = getToken(input);
        if (matchObj(token, obj)) return appendToken(input, token);
        else return false;
    } else if (typeof obj == 'string') {
        if (typeof input.s == 'string') {
            var token = input.s.substr(input.i, obj.length);
            if (token === obj) return appendToken(input, token, obj.length);
        } else {
            var token = getToken(input);
            if (token === obj) return appendToken(input, token);
        }
        return false;
    } else {
        pr('Error in applyParser');
        return false;
    }
}

function SEQ() {
    var parsers = arguments;
    return function (input) {
        var next;
        var prev = input;
        
        for (var i=0; i<parsers.length; i++) {
            var parser = parsers[i];
            next = applyParser(parser, prev);
            prev = next;
            if (!next) {
                return false;
            }
        }
        
        return next;
    }
}

function ALT() {
    var parsers = arguments;
    return function (input) {
        var next;
        for (var i=0; i<parsers.length; i++) {
            var parser = parsers[i];
            next = applyParser(parser, input);
            if (next) {
                return next;
            }
        }
        return false;
    }
}

function OPT(parser) {
    var parsers = arguments;
    return function (input) {
        var next = applyParser(parser, input);
        if (next) {
            return next;
        } else {
            return input;
        }
    }
}

function OPTREM(parser) {
    var parsers = arguments;
    return function (input) {
        var next = applyParser(parser, input);
        if (next) {
            return skipToken(input);
        } else {
            return input;
        }
    }
}

//Parse a sequence of ELEM DELIM repetitions
//By default discards delimiter parse results and disallows for empty lists (0 repetitions)
//Last delimiter is optional
//Unless empty returns sequence of ELEMs of max length that could be parsed
//It is up to enclosing parser to parse boundaries
function LIST(elemParser, delimParser, acceptEmpty, saveDelim) {
    return function (input) {
        var i = 0;
        var expectElem = true;
        var prevBase = input;
        var prev = prevBase;
        var next;
        var preElem;
        
        while (true) {
            //pr('LOOP:',i,prev.s[prev.i],expectElem);
            if (expectElem) {
                next = applyParser(elemParser, prev);
                if (next) {
                    prev = next;
                } else {
                    if (i === 0) {
                        if (acceptEmpty) return prev;
                        else return;
                    }
                    //Return parser state that contains previous list element and unconsumed delimiter
                    //Without this in case of parse error delimiter gets deleted
                    return preElem;
                }
            } else {
                //Expect delimiter or error
                //Save previous parser state in case of error on next element parse
                preElem = next;
                del = applyParser(delimParser, next);
                if (del) {
                    if (saveDelim) { prev = del }
                    prev = new pState(next.s, del.i, next.p);
                } else {
                    return next;
                }
            }
            expectElem = !expectElem;
            i++;
        }
    }
}

// Greedily search for matches of parser
function FIND(parser) {
    return function (input) {
        var next;
        var basePrev = input;
        var prev = input;
        var atLeastOne = false;
        while (true) {
            if (prev.s.length === prev.i) {
                if (atLeastOne) return prev;
                else return;
            }
            next = applyParser(parser, prev);
            if (next) {
                prev = next;
                atLeastOne = true;
            } else {
                prev = new pState(prev.s, prev.i+1, prev.p);
            }
        }
    }
}

//Accept at least one or more repetitions of parser
function REP() {
    var parsers = arguments;
    return function (input) {
        
        var next;
        var prevBase = input;
        var prev;
        var allFailed = true;
        var saving = true;
        
        while (saving) {
            prev = prevBase;
            for (var i=0; i<parsers.length; i++) {
                var parser = parsers[i];
                next = applyParser(parser, prev);
                prev = next;
                if (!next) {
                    saving = false;
                    break;
                }
            }
            if (saving) {
                allFailed = false;
                prevBase = next;
            }
        }
        if (allFailed) return false;
        return prevBase;
    }
}

// Transform parser result with function transformFn(arr)
// function receives parser output as an array arr (these args are popped from stack)
// value returned by function is accepted as final parser result and pushed onto stack
// if returned value is undefined nothing is pushed onto the stack, i.e. parse result becomes erased
// passing identity function x => x as transformFn causes all parse results to be gathered into the list and pushed onto the stack
function T(parser, transformFn) {
    var parsers = arguments;
    return function (input) {
        var prevTop = input.p;
        var next = applyParser(parser, input);
        if (next) {
            var args = LISTTAKETO(next.p, prevTop);
            var rest = prevTop;
            var processedArgs = transformFn(args);
            //If transformFn returned undefined completely discard result
            return new pState(next.s, next.i, (processedArgs === undefined) ? rest : CONS(processedArgs, rest));
        } else {
            return false;
        }
    }
}

function END(input) {
    if (reachedEnd(input)) {
        return input;
    } else {
        return false;
    }
}

function wrapParser(p, tokenizer, allowPartialParse, doNotReverse, verbose) {
    return function (str) {
        var input = str;
        if (tokenizer) { input = tokenizer(str) }
        var ret = p(new pState(input, 0));
        //ret && pr(ret.s.length, ret.i);
        if (ret && !allowPartialParse && (ret.s.length > ret.i)) {
            if (verbose) pr('wrapParser error not all input parsed');
            return;
        }
        if (ret) {
            return doNotReverse ? LIST2ARR(ret.p) : LIST2ARR(ret.p).reverse()
        } else { return }
    }
}

// Additional parsers that can be useful

// Untokenized versions of parsers for natural numbers, rational decimal numbers
// and ids (matches variable and function names)
// These are slower than tokenized versions

var NATNUM = T(REP($(isDigit)), x => {return parseInt(x.join(''))});

var NUM = ALT(T(SEQ(NATNUM, '.', NATNUM),
                x => {
                    var ret = x[0] + x[2]/(10*x[2].toString().length);
                    return ret;
                }),
              NATNUM);

var ID = T(SEQ($(isAlpha), REP($(isAlphaNum))), x => x.join(''));

// Tokenized versions of NUM and ID

var ID_T = T($(x => x && x.t === 'id'), x => x[0].d);
    
var NUM_T = $(x => (typeof x === 'number'));

module.exports = {
    $: $,
    SEQ: SEQ,
    ALT: ALT,
    REP: REP,
    LIST: LIST,
    FIND: FIND,
    T: T,
    OPT: OPT,
    OPTREM: OPTREM,
    END: END,
    NATNUM: NATNUM,
    NUM: NUM,
    ID: ID,
    ID_T: ID_T,
    NUM_T: NUM_T,
    tokenizer: makeTokenizer,
    wrap: wrapParser,
    pState: pState,
    isDigit: isDigit,
    isNumber: isNumber,
    isWhitespace: isWhitespace,
    isAlpha: isAlpha,
    isAlphaNum, isAlphaNum
};

