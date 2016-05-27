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

// Arithmetic Expression Tree Evaluator

var arithOps = {
    '+': (arr) => _reduce(arr, (a,b) => a+b),
    '-': (arr) => arr.length == 1 ? -arr[0] : _reduce(arr, (a,b) => a-b),
    '*': (arr) => _reduce(arr, (a,b) => a*b),
    '/': (arr) => _reduce(arr, (a,b) => a/b),
}

function addFunctions(obj, fns) {
    for (fname in fns) {
        (function (name, val) {
            obj[name] = function (args) { return val.apply(this, args) };
        })(fname, fns[fname]);
    }
}

var fromMath = {};
('abs sign sqrt pow exp log max min sin cos tan atan2').split(' ').forEach(
    (name) => {fromMath[name] = Math[name]});

addFunctions(arithOps, fromMath);

function computeTree(opTree, ops) {
    if (typeof opTree === 'number') {
        return opTree;
    } else if (typeof opTree === 'object') {
        if (opTree.op && arithOps[opTree.op]) {
            var ret = arithOps[opTree.op](opTree.args.map(computeTree));
            //pr('OP:',opTree,'OUT:',ret);
            return ret;
        } else {
            pr('Error in computeTree: Unknown op \"'+opTree.op+'\" in', opTree);
        }
    } else {
        pr('Error in computeTree: Unknown argument', opTree);
    }
}

// Arithmetic expression solver 

function arithSolver(parser) {
    return function (arithExprStr) {
        var parseOut = parser(arithExprStr);
        if (!parseOut) {
            pr('arithSolver parser error', parseOut);
            return;
        }
        return computeTree(parseOut[0], arithOps);
    }
}

// Simple and advanced calculator parsers

// Convert a list of values separated by same-priority binary infix operations to AST
function infixT(ops) {
    return x => {
        if (x.length < 3) { pr('ERROR: Wrong infix term:',x); return }
        
        var i = 0;
        function get() { return x[i++] }
        var ret = [];
        
        var tok;
        while (tok = get()) {
            if (typeof tok == 'string' && ops.indexOf(tok) > -1) {
                ret.push(get());
                var args = [];
                args[1] = ret.pop();
                args[0] = ret.pop();
                ret.push({op: tok, args: args});
            } else {
                ret.push(tok);
            }
        }
        
        return ret[0];
    };
}

// Tokenizer for arithmetic expressions, needed in some tests

var arithTok = tokenizer({
    delim: '\\s+',
    tokens: [
        ['[\\(\\)]', x => x],
        ['[\\*\\/\\+\\-]', x => x],
        ['[a-zA-Z][a-zA-Z0-9]+', x => ({t:'id', d:x})],
        ['[0-9]+\\.[0-9]+', x => parseFloat(x)],
        ['[0-9]+', x => parseInt(x)]
    ]});

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

var ID_T = T($(x => x.t === 'id'), x => x[0].d);
    
var NUM_T = $(x => (typeof x === 'number'));

// A simple calculator grammar (no functions)

function makeSimpleCalculatorParser(_NUM) {
    
    _NUM = _NUM || NUM;
    
    var PARENS = ALT(
        T(SEQ('(', function(x) { return TERM(x) }, ')'), x => x[1]),
        _NUM
    );

    var UNARY = ALT( T(SEQ('-', PARENS), x => {return {op: '-', args: [x[1]]}}),
                     PARENS );

    var FACTOR = ALT(
        T(SEQ( UNARY, REP( ALT('*','/'), UNARY) ), infixT(['*','/'])),
        UNARY
    );

    var TERM = ALT(
        T(SEQ( FACTOR, REP( ALT('+', '-'), FACTOR) ), infixT(['+','-'])),
        FACTOR
    );
    
    return TERM;
}

// Advanced Calculator: has functions

function makeAdvancedCalculatorParser(_NUM, _ID) {

    var _ID = _ID || ID;
    
    var _NUM = _NUM || NUM;
    
    var ARGLIST = T(ALT(REP(function(x) { return TERM(x) }, ','),
                          function(x) { return TERM(x) }),
                    x => x.filter(y => y != ','));

    var FUNCALL = T(SEQ(_ID, '(', OPT(ARGLIST), ')'),
                    x => {
                        var args = [];
                        //Check if arglist exists
                        if (x[2] != ')') { args = x[2] }
                        return {op: x[0], args};
                    });
    
    var PARENS = ALT(
        T(SEQ('(', function(x) { return TERM(x) }, ')'), x => x[1]),
        FUNCALL,
        _NUM
    );

    var UNARY = ALT( T(SEQ('-', PARENS), x => {return {op: '-', args: [x[1]]}}),
                     PARENS );

    var FACTOR = ALT(
        T(SEQ( UNARY, REP( ALT('*','/'), UNARY) ), infixT(['*','/'])),
        UNARY
    );

    var TERM = ALT(
        T(SEQ( FACTOR, REP( ALT('+', '-'), FACTOR) ), infixT(['+','-'])),
        FACTOR
    );
    
    return TERM;
}

// Tests of simple|advanced, tokenized|untokenized calculators

var simpleSolver = arithSolver(wrap(makeSimpleCalculatorParser()));

runTests(prepArithTests(arithTests, simpleSolver), {
    name: 'SIMPLE CALCULATOR (NO TOKENIZER)',
    concise: true
});

var simpleSolver_T = arithSolver(wrap(makeSimpleCalculatorParser(NUM_T), arithTok));

runTests(prepArithTests(arithTests, simpleSolver_T), {
    name: 'SIMPLE CALCULATOR (USE TOKENIZER)',
    concise: true
});

var advancedSolver = arithSolver(wrap(makeAdvancedCalculatorParser()));

runTests(prepArithTests(arithTests, advancedSolver), {
    name: 'ADVANCED CALCULATOR (NO TOKENIZER)',
    concise: true
});

var advancedSolver_T = arithSolver(wrap(makeAdvancedCalculatorParser(NUM_T, ID_T), arithTok));

runTests(prepArithTests(arithTests, advancedSolver_T), {
    name: 'ADVANCED CALCULATOR (USE TOKENIZER)',
    concise: true
});

































