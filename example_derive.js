// Comby - yet another parser combinator library for JavaScript
// Symbolic differentiation demo, enter >node example_derive.js to try it
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

function cloneObject(obj) {
    if (obj === null || typeof obj !== 'object') { return obj }
    var temp = obj.constructor();
    for (var key in obj) { temp[key] = cloneObject(obj[key]) }
    return temp;
}

// Arithmetic Expression Tree Evaluator

var arithOps = {
    '+': (arr, varName) => ({op: '+', args: arr.map(expr => deriveTree(expr, varName))}),
    '-': (arr, varName) => {
        if (arr.length == 1) { return {op:'-', args: [deriveTree(arr[0], varName)]} }
        else { return {op: '-', args: arr.map(expr => deriveTree(expr, varName))} }
    },
    '*': (arr, varName) => {
        return reduce(arr, (a,b) => ({op: '+', args: [
            {op: '*', args: [deriveTree(a, varName), b]},
            {op: '*', args: [deriveTree(b, varName), a]}
        ]}));
    },
    '/': (arr, varName) => {
        return reduce(arr, (a,b) => ({op:'/', args:[
            {op: '-', args: [
                {op: '*', args: [deriveTree(a, varName), b]},
                {op: '*', args: [deriveTree(b, varName), a]}
            ]},
            {op: '*', args: [b,b]}
        ]}));
    },
}

var arithComputeOps = {
    '+': (arr) => reduce(arr, (a,b) => a+b),
    '-': (arr) => arr.length == 1 ? -arr[0] : reduce(arr, (a,b) => a-b),
    '*': (arr) => reduce(arr, (a,b) => a*b),
    '/': (arr) => reduce(arr, (a,b) => a/b),
}

/*
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
*/

var arithEnv = {
    PI: 3.141592653589793,
    E: 2.718281828459045
}

function deriveTree(opTree, varName, opMap = arithOps, env = arithEnv) {
    if (typeof opTree === 'number') {
        return 0;
    } else if (typeof opTree === 'object') {
        if (opTree.op === 'var') {
            if (opTree.id === varName) { return 1 }
            if (env && opTree.id && typeof env[opTree.id] === 'number') { return 0 }
            else { pr('Error in deriveTree: undefined var \"'+opTree.id+'\"'); return }
        } else if (opTree.op && opMap[opTree.op]) {
            return opMap[opTree.op](opTree.args, varName);
        } else {
            pr('Error in deriveTree: Unknown op \"'+opTree.op+'\" in', opTree);
        }
    } else {
        pr('Error in deriveTree: Unknown argument', opTree);
    }
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

function treeToSEXP(opTree) {
    if (typeof opTree === 'number') {
        return opTree.toString();
    } else if (typeof opTree === 'object') {
        if (opTree.op === 'var') {
            return opTree.id;
        } else if (opTree.op) {
            var _args = new Array(opTree.args.length);
            for (var i=0; i<opTree.args.length; i++) { _args[i] = treeToSEXP(opTree.args[i]) }
            return '('+opTree.op+' '+_args.join(' ')+')';
        }
    }
    return 'error';
}

// Arithmetic expression solver 

function makeDeriveComp(parser) {
    return function (arithExprStr) {
        pr(arithExprStr);
        var parseOut = parser(arithExprStr);
        if (!parseOut) {
            pr('Expression parser error', parseOut);
            return;
        }
        pr(parseOut);
        var expr = parseOut[0];
        var varName = parseOut[2];
        var varValue = parseOut[4];
        pr('EXPR:',expr);
        pr('VAR:',varName);
        varValue && pr('VAL:',varValue);
        if (typeof varValue === 'number') {
            var env = {};
            env[varName] = varValue;
            return computeTree(deriveTree(expr, varName), arithComputeOps, env);
        } else {
            return deriveTree(expr, varName);
        }
    }
}

function makeArithSolver(parser) {
    return function (arithExprStr, env) {
        var parseOut = parser(arithExprStr);
        if (!parseOut) {
            pr('arithSolver parser error', parseOut);
            return;
        }
        var evalEnv = arithEnv;
        if (env) {
            evalEnv = cloneObject(env);
            evalEnv.__proto__ = arithEnv;
        }
        return computeTree(parseOut[0], arithComputeOps, evalEnv);
    }
}

function symbolicDerive(exprStr, varName, varVal) {
    var env = {};
    env[varName] = varVal;
    return computeTree(deriveTree(arithParser(exprStr)[0], varName), arithComputeOps, env);
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
        ['[\\*\\/\\+\\-\\=]', x => x],
        ['[a-zA-Z](?:[a-zA-Z0-9]+)?', x => ({t:'id', d:x})],
        ['[0-9]+[eE][\\+\\-]?[0-9]+', x => parseFloat(x)],
        ['[0-9]+\\.(?:[0-9]+)?(?:[eE][\\+\\-]?[0-9]+)?', x => parseFloat(x)],
        ['[0-9]+', x => parseInt(x)]
    ]});

// Untokenized versions of parsers for natural numbers, rational decimal numbers
// and ids (matches variable and function names)
// These are slower than tokenized versions

// Advanced Calculator: has functions

function makeAdvancedCalculatorParser(_NUM, _ID) {

    var _ID = _ID || ID;
    
    var _NUM = _NUM || NUM;
    
    var ARGLIST = T(ALT(SEQ(REP(function(x) { return TERM(x) }, ','), function(x) { return TERM(x) }),
                        OPT(function(x) { return TERM(x) })),
                    x => x.filter(y => y != ','));
    

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
       
    //return SEQ(TERM, ',', _ID, END);
    return TERM
}

//var deriveComputer = makeDeriveComp(wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), ',', ID_T, END), arithTok));
var deriveComputer = makeDeriveComp(wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), ',', ID_T, OPT(SEQ('=', NUM_T)), END), arithTok));

var arithSolve = makeArithSolver(wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), END), arithTok));

var arithParser = wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), END), arithTok);

//pr(treeToSEXP(arithParser('1+x*10')[0]));

//pr(arithSolve('x+1', {x:10}));
//pr(arithSolve('1*x', {x:10}));

function numericDerive(exprStr, varName, varVal, eps = 1e-7) {
    var env = {};
    env[varName] = varVal-eps;
    var left = arithSolve(exprStr, env);
    env[varName] = varVal+eps;
    var right = arithSolve(exprStr, env);
    return (right-left)/(2*eps);
}

//pr(numericDerive('2*x', 'x', -1000));
//pr(numericDerive('1/x', 'x', 0.2));
//pr(symbolicDerive('1/x', 'x', 0.2));

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

if (require.main === module) {
    REPL('Symbolic differentiator v0.85\nAvailable functions: '+Object.keys(arithOps).filter(x => x.length > 1).join(' ')+
    '\nAvailable variables: '+Object.keys(arithEnv).join(' ')+
    '\nType arithmetic expressions and press ENTER:\n','Error',
    function (expr) { return treeToSEXP(deriveComputer(expr)) },
    (out, inp) => pr('Derive(',inp,')','=',out));
}

module.exports = {
    derive: deriveComputer,
    numericDerive: numericDerive,
    symbolicDerive: symbolicDerive
}
