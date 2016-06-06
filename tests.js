// Comby - yet another parser combinator library for JavaScript
// For more info see README.md or Wikipedia: https://en.wikipedia.org/wiki/Parser_combinator
// Copyright (c) 2016 Crystalline Emerald
// Licensed under MIT license.

var C = require('./comby.js');
var util = require('./util.js');

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
        var compare = opt.compare || ((a,b) => (a === b)||(isNaN(a)&&isNaN(b)));
        
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
    var tStr = '@ TIME: '+util.timeDiff(t, 3);
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

function runExampleTests() {
    var p0 = C.$("hello");  
    var p1 = C.SEQ("hel", "lo");  
    var p2 = C.SEQ("h","e","l","l","o");  
    var p3 = C.SEQ("h","e",SEQ("l","l"),"o");  
    var wp2 = C.wrap(p2);
    var p4 = C.SEQ(C.ALT("H","h"), "ello"); var wp4 = C.wrap(p4);
    var p5 = T(p4, function (arr) { return arr.join('') }); var wp5 = C.wrap(p5);
    var fail = false;
    var tests = [[wp2("helo"), undefined],
     [wp2("hello"), [ 'h', 'e', 'l', 'l', 'o' ]],
     [wp4("Hello"), [ 'H', 'ello' ]],
     [wp5("Hello"), [ 'Hello' ]],
     [wp5("hello"), [ 'hello' ]]].forEach((elem, i) => { if (JSON.stringify(elem[0]) !== JSON.stringify(elem[1])) { pr('FAILED:', i); fail = true } });
    if (fail) { pr('EXAMPLE TESTS FAILED') }
    else { pr('EXAMPLE TESTS PASSED') }
}

runExampleTests() 

runTests(pCombTests, {
    name: 'SHORT',
    prepInput: x => new pState(x, 0),
    compare: function (a,b) {
        if (b === true || b === false) {
            return (a && (a.s.length === a.i)) === b;
        } else {
            return a && (a.s.length === a.i) && a === b;
        }
    },
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

function _genRandArithExprs(N, enParens, enFns, enVar) {
    var ops = '+-*/';
    var unOps = '-';
    var unP = 0.1;
    var parenP = 0.1;
    var varP = 0.2;
    var out = [];
    var fns1 = 'sin cos log sqrt'.split(' ').map(name => {global[name] = Math[name]; return name});
    var fn1p = 0.3;
    
    for (var i=0; i<N; i++) {
        var expr = '';
        var num = false;
        var pN = util.randInt(1,N);
        for (var j=0; j<pN; j++) {
            if (num) {
                expr += util.randItem(ops);
            } else {
                if (Math.random() < unP) {
                    var unop = util.randItem(unOps);
                    if (expr.length && expr[expr.length-1] !== unop) {
                        expr += unop;
                    }
                }
                if (enParens && Math.random() < parenP) {
                    expr += '('+util.randItem(_genRandArithExprs(4))+')';
                } else if (enFns && Math.random() < fn1p) {
                    if (!enVar || Math.random() < 0.5)
                        expr += util.randItem(fns1)+'('+util.randItem(_genRandArithExprs(6))+')';
                    else
                        expr += util.randItem(fns1)+'('+enVar+'*'+util.randItem(_genRandArithExprs(6))+')';
                } else if (enVar && Math.random() < varP) {
                    expr += enVar;
                } else {
                    expr += util.randInt();
                }
            }
            num = !num;
        }
        if (!num) {
           expr += util.randInt();
        }
        out.push(expr);
    }
    return out;
}

function genRandArithTests(N, enParens, enFns) {
    return _genRandArithExprs(N, enParens, enFns).map(expr => [expr, eval(expr)]);
}

var simpleArithTests = [].concat(basicArithTests, genRandArithTests(100));

var advancedArithTests = [].concat(basicArithTests, genRandArithTests(100, true, true));

function prepArithTests(tests, solver) {
    return tests.map(x => [x[0], solver, x[1]]);
}

var deriveTests = ['1+x+1+sin(cos(log(sqrt(2*x+40)+30)*7))'].concat(_genRandArithExprs(50, true, true, 'x'));

function prepDeriveTests(tests) {
    return tests.filter(expr => !isNaN(advancedSolver_T(expr, {x:10}))).map(x => [x, function (expr) {
        var x = Math.random()*10.0+2;
        var num = numericDerive(expr, 'x', x);
        var sym = symbolicDerive(expr, 'x', x);
        var deNom = 0.5*(Math.abs(num)+Math.abs(sym));
        if (deNom === 0) deNom = 1;
        var diff = Math.abs(num - sym)/deNom;
        if (isNaN(num)) { pr('Ignoring NaN in Derive test'); return 0 }
        if (isNaN(diff) || diff > 0.1) {
            pr('EXPR:',expr,'NUM:',num,'SYM:',sym,'deNom:',deNom);
        }
        return diff;
    }, true]);
}

function prepSimplifyTests(tests) {
    return tests.filter(expr => !isNaN(advancedSolver_T(expr, {x:10}))).map(x => [x, function (expr) {
        var val = Math.random()*10.0+2;
        var ret = advancedSolver_T(expr, {x:val});
        if (isNaN(ret)) { pr('Ignoring NaN in Simplify test'); return 0 }
        var sret = advancedSolver_T(simplify(calcParser(expr)), {x:val});
        return Math.abs(sret - ret);
    }, true]);
}

var simplecalc = require('./example_simplecalc.js');
var engcalc = require('./example_engcalc.js');
var derivecalc = require('./example_derive.js');

var numericDerive = derivecalc.numericDerive;
var symbolicDerive = derivecalc.symbolicDerive;
var simplify = derivecalc.simplify;
var calcParser = derivecalc.calcParser;

// Tests of simple|advanced, tokenized|untokenized calculators and symbolic differentiator
// _T means "tokenized version", it uses tokenizer and thus supports whitespace

var simpleSolver = simplecalc._calc;

runTests(prepArithTests(simpleArithTests, simpleSolver), {
    name: 'SIMPLE CALCULATOR (NO TOKENIZER)',
    concise: true
});

var simpleSolver_T = simplecalc._calc_T;

runTests(prepArithTests(simpleArithTests, simpleSolver_T), {
    name: 'SIMPLE CALCULATOR (USE TOKENIZER)',
    concise: true
});

var advancedSolver = engcalc._calc;
var eng_computeTree = engcalc.computeTree;

runTests(prepArithTests(advancedArithTests, advancedSolver), {
    name: 'ADVANCED CALCULATOR (NO TOKENIZER)',
    concise: true
});

var advancedSolver_T = engcalc._calc_T;

runTests(prepArithTests(advancedArithTests, advancedSolver_T), {
    name: 'ADVANCED CALCULATOR (USE TOKENIZER)',
    concise: true
});

runTests(prepSimplifyTests(deriveTests), {
    name: 'SYMBOLIC SIMPLIFICATION',
    concise: true,
    compare: (diff) => (diff < 0.01)
});

runTests(prepDeriveTests(deriveTests), {
    name: 'SYMBOLIC DERIVATIVE',
    concise: true,
    compare: (diff) => (diff < 0.01)
});














