// Comby - yet another parser combinator library for JavaScript
// For more info see README.md or Wikipedia: https://en.wikipedia.org/wiki/Parser_combinator
// Copyright (c) 2016 Crystalline Emerald
// Licensed under MIT license.

var C = require('./comby.js');

var pr = console.log;

var $ = C.$;
var SEQ = C.SEQ;
var ALT = C.ALT;
var REP = C.REP;
var T = C.T;
var OPT = C.OPT;
var OPTREM = C.OPTREM;
var END = C.END;
var tokenizer = C.tokenizer;
var wrap = C.wrap;
var isDigit = C.isDigit;
var isNumber = C.isNumber;
var isWhitespace = C.isWhitespace;
var isAlpha = C.isAlpha;
var isAlphaNum = C.isAlphaNum;
var pState = C.pState;

function randItem(array, random) {
    random = random || Math.random;
    return array[Math.floor(random()*array.length)];
}

function randInt(_min,_max) {
    _min = _min || 0;
    _max = _max || 100;
    return Math.ceil((_max-_min)*Math.random())+_min;
}

function _reduce(arr, fn) {
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

function runTests(tests, opt) {
    opt = opt || {};
    pr('RUNNING TESTS'+(opt.name ? ': '+opt.name : ''));
    var t = Date.now();
    var failed = [];
    tests.map(function (test, i) {
        
        var input = (opt.prepInput && opt.prepInput(test[0])) || test[0];
        
        var _ret = test[1](input);
        var ret = _ret;
        if (opt.procResult) ret = opt.procResult(_ret);
        
        var compareTo = (opt.prepCompare && opt.prepCompare(test[2])) || test[2];
        var compare = opt.compare || ((a,b) => (a === b));
        
        if (compare(ret, compareTo)) {
            if (!opt.concise) pr('TEST',i,'PASSED');
        } else {
            var fhret;
            if (opt.onFail) {
                fhret = opt.onFail(test[0], test[1], test[2]);
            }
            pr('TEST',i,'FAILED EXPECT:',compareTo,'GOT:',ret,(fhret ? ('|' + fhret) : ''));
            failed.push(i);
        }
    });
    var tStr = '@ TIME: '+timeDiff(t, 3);
    if (failed.length) {
        pr('SOME TESTS FAILED:', failed, tStr);
    } else {
        pr('ALL '+tests.length+' TESTS PASSED', tStr);
    }
    return failed;
}

// Basic tests of simplest parsers

var pCombTests = [
    ['1', $('1'), true],
    ['12', SEQ('1', '2'), true],
    ['13', SEQ('1', '2'), false],
    ['12', SEQ('1', '2', END), true],
    ['123', SEQ('1', '2', END), false],
    ['12212121221', SEQ(REP(ALT('1', '2')), END), true],
    ['12212321221', SEQ(REP(ALT('1', '2')), END), false],
    ['1', SEQ('1', OPT('2'), END), true],
    ['1', $(isDigit), true],
    ['1+5', SEQ($(isDigit), '+', $(isDigit)), true],
    ['1', ALT($(isDigit), SEQ($(isDigit), '+', $(isDigit))), true],
    ['+5', REP( '+', '5' ), true],
    ['+5', REP( '+', $(isDigit) ), true],
    ['+5+1', REP( '+', $(isDigit) ), true],
    ['1+5', 
        ALT( SEQ( $(isDigit), REP('+', $(isDigit))),
             $(isDigit)
        ),
        true],
    ['1+5+123+54+123', 
        ALT( SEQ( REP($(isDigit)), REP('+', REP($(isDigit)))),
             REP($(isDigit))
        ),
        true]
]

runTests(pCombTests, {
    name: 'SHORT',
    prepInput: x => new pState(x, 0),
    procResult: x => (x && (x.s.length === x.i)),
    concise: true
});

// Arithmetic expression parser/evaluator test

// Tests and test generator

function prepArithTests(tests) {
    return tests.map(x => [x[0], arithSolve, x[1]]);
}

var basicArithTests = [
    ['10', 10],
    ['-10', -10],
    ['-(10)', -10],
    ['10+35', 45],
    ['10+2*35', 80],
    ['(10+2)*35', 420],
    ['97-24*2-84', -35]
];

function genRandArithTests(N) {
    var ops = '+-*/';
    var unOps = '-';
    var unP = 0.1;
    var parenP = 0.2;
    var out = [];
    for (var i=0; i<N; i++) {
        var expr = '';
        var num = false;
        var pN = randInt(1,N);
        for (var j=0; j<pN; j++) {
            if (num) {
                expr += randItem(ops);
            } else {
                if (Math.random() < unP) {
                    var unop = randItem(unOps);
                    if (expr.length && expr[expr.length-1] !== unop) {
                        expr += unop;
                    }
                }
                expr += randInt();
            }
            num = !num;
        }
        if (!num) {
           expr += randInt();
        }
        out.push(expr);
    }
    return out.map(expr => [expr, eval(expr)]);
}

var arithTests = [].concat(basicArithTests, genRandArithTests(100));

function prepArithTests(tests, solver) {
    return tests.map(x => [x[0], solver, x[1]]);
}

var simplecalc = require('./example_simplecalc.js');
var engcalc = require('./example_engcalc.js');

// Tests of simple|advanced, tokenized|untokenized calculators
// _T means "tokenized version", it uses tokenizer and thus supports whitespace

var simpleSolver = simplecalc._calc;

runTests(prepArithTests(arithTests, simpleSolver), {
    name: 'SIMPLE CALCULATOR (NO TOKENIZER)',
    concise: true
});

var simpleSolver_T = simplecalc._calc_T;

runTests(prepArithTests(arithTests, simpleSolver_T), {
    name: 'SIMPLE CALCULATOR (USE TOKENIZER)',
    concise: true
});

var advancedSolver = engcalc._calc;

runTests(prepArithTests(arithTests, advancedSolver), {
    name: 'ADVANCED CALCULATOR (NO TOKENIZER)',
    concise: true
});

var advancedSolver_T = engcalc._calc_T;

runTests(prepArithTests(arithTests, advancedSolver_T), {
    name: 'ADVANCED CALCULATOR (USE TOKENIZER)',
    concise: true
});

































