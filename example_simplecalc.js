// Comby - yet another parser combinator library for JavaScript
// Simple calculator demo, enter >node example_simplecalc.js to try it
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

var NATNUM = C.NATNUM;
var NUM = C.NUM;
var NUM_T = C.NUM_T;

var reduce = C.reduce;

// Arithmetic Expression Tree Evaluator

var arithOps = {
    '+': (arr) => reduce(arr, (a,b) => a+b),
    '-': (arr) => arr.length == 1 ? -arr[0] : reduce(arr, (a,b) => a-b),
    '*': (arr) => reduce(arr, (a,b) => a*b),
    '/': (arr) => reduce(arr, (a,b) => a/b),
}

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

function arithSolver(parser, prErr) {
    return function (arithExprStr) {
        var parseOut = parser(arithExprStr);
        if (!parseOut) {
            if (prErr) pr('arithSolver parser error', parseOut);
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

// Tokenizer for arithmetic expressions

var arithTok = tokenizer({
    delim: '\\s+',
    tokens: [
        ['[\\(\\)]', x => x],
        ['[\\*\\/\\+\\-]', x => x],
        ['[0-9]+\\.[0-9]+', x => parseFloat(x)],
        ['[0-9]+', x => parseInt(x)]
    ]});

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

var simpleSolver = arithSolver(wrap(makeSimpleCalculatorParser()));

var simpleSolver_T = arithSolver(wrap(makeSimpleCalculatorParser(NUM_T), arithTok));

function REPL(inviteMsg, errMsg, evalFn, ansPrefix){
    ansPrefix = ansPrefix || '>';
    var readline = require('readline');
    var rl = readline.createInterface({input: process.stdin, output: process.stdout});
    function _REPL() {
        rl.question(inviteMsg, (answer) => {
          var ans = evalFn(answer);
          if (ans !== undefined) pr(ansPrefix, answer, '=',ans);
          else pr(ansPrefix, errMsg);
          _REPL();
        });
    }
    _REPL();
}

if (require.main === module) {
    REPL('Enter arithmetic expression:\n', 'Error', simpleSolver_T);
}

module.exports = {
    calc: simpleSolver_T,
    _calc: simpleSolver,
    _calc_T: simpleSolver_T
}

