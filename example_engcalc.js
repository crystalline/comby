// Comby - yet another parser combinator library for JavaScript
// Engineering calculator demo, enter >node example_engcalc.js to try it
// Copyright (c) 2016 Crystalline Emerald
// Licensed under MIT license.

var C = require('./comby.js');

var util = require('./util.js');
var reduce = util.reduce;
var cloneObject = util.cloneObject;
var REPL = util.REPL;

var pr = console.log;

var $ = C.$;
var SEQ = C.SEQ;
var ALT = C.ALT;
var REP = C.REP;
var LIST = C.LIST;
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
('abs sign sqrt pow exp log log2 max min sin asin cos acos tan atan atan2').split(' ').forEach(
    (name) => {fromMath[name] = Math[name]});

addFunctions(arithOps, fromMath);

var arithEnv = {
    PI: 3.141592653589793,
    E: 2.718281828459045
}

function computeTree(opTree, opMap, env) {
    if (typeof opTree === 'number') {
        return opTree;
    } else if (typeof opTree === 'object') {
        if (opTree.op === 'var') {
            if (env && opTree.id && typeof env[opTree.id] === 'number') { return env[opTree.id] }
            else { pr('Error in computeTree: undefined var \"'+opTree.id+'\"'); return }
        } else if (opTree.op && opMap[opTree.op]) {
            var _args = new Array(opTree.args.length);
            for (var i=0; i<opTree.args.length; i++) { _args[i] = computeTree(opTree.args[i], opMap, env) }
            return opMap[opTree.op](_args);
        } else {
            pr('Error in computeTree: Unknown op \"'+opTree.op+'\" in', opTree);
        }
    } else {
        pr('Error in computeTree: Unknown argument', opTree);
    }
}

// Arithmetic expression solver 

function makeArithSolver(parser) {
    return function (arithExprStr, env) {
        if (typeof arithExprStr === 'object') {
            var parseOut = arithExprStr;
        } else {
            var parseOut = parser(arithExprStr);
        }
        if (!parseOut) {
            pr('arithSolver parser error', parseOut);
            return;
        }
        var evalEnv = arithEnv;
        if (env) {
            evalEnv = cloneObject(env);
            evalEnv.__proto__ = arithEnv;
        }
        return computeTree(parseOut[0], arithOps, evalEnv);
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
        ['[,\\(\\)]', x => x],
        ['[\\*\\/\\+\\-]', x => x],
        ['[a-zA-Z](?:[a-zA-Z0-9]+)?', x => ({t:'id', d:x})],
        ['[0-9]+[eE][\\+\\-]?[0-9]+|[0-9]+\\.(?:[0-9]+)?(?:[eE][\\+\\-]?[0-9]+)?', x => parseFloat(x)],
        ['[0-9]+', x => parseInt(x)]
    ]});

// Untokenized versions of parsers for natural numbers, rational decimal numbers
// and ids (matches variable and function names)
// These are slower than tokenized versions

// Advanced Calculator: has functions

function makeAdvancedCalculatorParser(_NUM, _ID) {

    var _ID = _ID || ID;
    
    var _NUM = _NUM || NUM;
    
    /*
    var ARGLIST = T(ALT(SEQ(REP(function(x) { return TERM(x) }, ','), function(x) { return TERM(x) }),
                        OPT(function(x) { return TERM(x) })),
                    x => x.filter(y => y != ','));
    */
    
    var ARGLIST = T(LIST(function(x) { return TERM(x) }, ',', true), x => x);
    

    var FUNCALL = T(SEQ(_ID, '(', ARGLIST, ')'),
                    x => {
                        var args = [];
                        //Check if arglist exists
                        if (x[2] != ')') { args = x[2] }
                        return {op: x[0], args};
                    });
    
    var PARENS = ALT(
        T(SEQ('(', function(x) { return TERM(x) }, ')'), x => x[1]),
        FUNCALL,
        _NUM,
        T(_ID, x => ({op:'var', id:x[0]}))
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
    
    return SEQ(TERM, END);
}

var advancedSolver = makeArithSolver(wrap(makeAdvancedCalculatorParser()));

var advancedSolver_T = makeArithSolver(wrap(makeAdvancedCalculatorParser(NUM_T, ID_T), arithTok));

if (require.main === module) {
    REPL('Engineering calculator v0.91\nAvailable functions: '+Object.keys(arithOps).filter(x => x.length > 1).join(' ')+
    '\nAvailable constants: '+Object.keys(arithEnv).join(' ')+
    '\nType arithmetic expressions and press ENTER:\n','Error', advancedSolver_T, (out, inp) => pr(inp,'=',out));
}

//pr(advancedSolver_T('1+sin(3)'));

module.exports = {
    calc: advancedSolver_T,
    _calc: advancedSolver,
    _calc_T: advancedSolver_T
}

