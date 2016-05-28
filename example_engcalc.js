// Comby - yet another parser combinator library for JavaScript
// Engineering calculator demo, enter >node example_engcalc.js to try it
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
var ID = C.ID;
var ID_T = C.ID_T;
var NUM_T = C.NUM_T;

var reduce = C.reduce;


// Arithmetic Expression Tree Evaluator

var arithOps = {
    '+': (arr) => reduce(arr, (a,b) => a+b),
    '-': (arr) => arr.length == 1 ? -arr[0] : reduce(arr, (a,b) => a-b),
    '*': (arr) => reduce(arr, (a,b) => a*b),
    '/': (arr) => reduce(arr, (a,b) => a/b),
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

// Tokenizer for arithmetic expressions and function calls

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

var advancedSolver = arithSolver(wrap(makeAdvancedCalculatorParser()));

var advancedSolver_T = arithSolver(wrap(makeAdvancedCalculatorParser(NUM_T, ID_T), arithTok));

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
    REPL('Enter arithmetic expression:\n', 'Error', advancedSolver_T);
}

module.exports = {
    calc: advancedSolver_T,
    _calc: advancedSolver,
    _calc_T: advancedSolver_T
}

