// Comby - yet another parser combinator library for JavaScript
// Symbolic differentiation demo, enter >node example_derive.js to try it
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

// Arithmetic Expression Tree Derivative Evaluator

var arithDeriveOps = {
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
    sin: (arr, varName) => ({op:'*', args: [{op: 'cos', args: [arr[0]]}, deriveTree(arr[0], varName)]}),
    cos: (arr, varName) => ({op: '-', args: [{op:'*', args: [{op: 'sin', args: [arr[0]]}, deriveTree(arr[0], varName)]}]}),
    sqrt: (arr, varName) => ({op: '/', args: [deriveTree(arr[0], varName), {op: '*', args:[2,{op: 'sqrt', args:[arr[0]]}]}]}),
    log: (arr, varName) => ({op: '/', args: [deriveTree(arr[0], varName), arr[0]]})
}

var arithComputeOps = {
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
//('abs sign sqrt pow exp log log2 max min sin asin cos acos tan atan atan2').split(' ').forEach(
('sin cos log sqrt').split(' ').forEach(
    (name) => {fromMath[name] = Math[name]});

addFunctions(arithComputeOps, fromMath);

var arithEnv = {
    PI: 3.141592653589793,
    E: 2.718281828459045
}

function deriveTree(opTree, varName, opMap = arithDeriveOps, env = arithEnv) {
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

function simplifyTree(opTree, opMap) {
    if (typeof opTree === 'object' && opTree.op && opMap[opTree.op]) {
        var _args = new Array(opTree.args.length);
        for (var i=0; i<opTree.args.length; i++) { _args[i] = simplifyTree(opTree.args[i], opMap) }
        
        //Pull up lower level + and * exprs
        if (opTree.op === '+' || '*') {
            for (var i=0; i<opTree.args.length; i++) {
                if (typeof x === 'object' && (x.op === opTree.op)) {
                    _args.splice.apply([i,1].concat(x.args));
                }
            }
        }
        
        var constants = _args.filter(x => typeof x === 'number');
        
        //If all arguments are constants then just return computed value, don't do it if non-numeric constants are present
        if (constants.length == opTree.args.length) {
            return computeTree(opTree, opMap);
        } else if (constants.length && opTree.op === '+') {
            var res = constants[0];
            if (constants.length > 1) { res = opMap['+'](constants) }
            _args = _args.filter(x => typeof x !== 'number');
            if (res !== 0) { _args.unshift(res) }
            else if (_args.length == 1) { return _args[0] }
            return {op: opTree.op, args: _args };
        } else if (constants.length && opTree.op === '*') {
            var res = constants[0];
            if (constants.length > 1) { res = opMap['*'](constants) }
            _args = _args.filter(x => typeof x !== 'number');
            //pr('op:',opTree.op,'constants:',constants,'res:',res,'_args:',_args);
            if (res !== 1) { _args.unshift(res) }
            else if (_args.length == 1) { return _args[0] }
            return {op: opTree.op, args: _args };
        } else {
            return {op: opTree.op, args: _args}
        }
    } else {
        return opTree;
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

function makeDeriveComp(parser, preSimplify, postSimplify) {
    preSimplify = preSimplify || function (x) { return x }
    postSimplify = postSimplify || function (x) { return x }
    return function (arithExprStr) {
        pr(arithExprStr);
        var parseOut = parser(arithExprStr);
        if (!parseOut) {
            pr('Expression parser error', parseOut);
            return;
        }
        pr(parseOut);
        var expr = preSimplify(parseOut[0]);
        var varName = parseOut[2];
        var varValue = parseOut[4];
        pr('EXPR:',expr);
        pr('VAR:',varName);
        varValue && pr('VAL:',varValue);
        if (typeof varValue === 'number') {
            var env = {};
            env[varName] = varValue;
            return computeTree(postSimplify(deriveTree(expr, varName)), arithComputeOps, env);
        } else {
            return postSimplify(deriveTree(expr, varName));
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
    return computeTree(
        arithSimplify(deriveTree(arithSimplify(arithParser(exprStr)[0]), varName)),
        arithComputeOps, env);
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
    
    return TERM
}

var calcParser = wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), END), arithTok);

var arithSimplify = function (tree) { return simplifyTree(tree, arithComputeOps) }

var deriveComputer = makeDeriveComp(wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), ',', ID_T, OPT(SEQ('=', NUM_T)), END), arithTok), arithSimplify, arithSimplify);

var arithSolve = makeArithSolver(wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), END), arithTok));

var arithParser = wrap(SEQ(makeAdvancedCalculatorParser(NUM_T, ID_T), END), arithTok);

function numericDerive(exprStr, varName, varVal, eps = 1e-7) {
    var env = {};
    env[varName] = varVal-eps;
    var left = arithSolve(exprStr, env);
    env[varName] = varVal+eps;
    var right = arithSolve(exprStr, env);
    return (right-left)/(2*eps);
}

/*
pr(treeToSEXP(arithParser('1+x*10')[0]));
pr(arithSolve('x+1', {x:10}));
pr(arithSolve('1*x', {x:10}));
pr(numericDerive('2*x', 'x', -1000));
pr(numericDerive('1/x', 'x', 0.2));
pr(symbolicDerive('1/x', 'x', 0.2));
pr(numericDerive('4+sqrt(x*92-74)+cos(x*60*2)/11', 'x', 10));
pr(symbolicDerive('4+sqrt(x*92-74)+cos(x*60*2)/11', 'x', 10));
pr(numericDerive('x/(77*83/99)/sqrt(x*100/90)/65/(88+85)-63/56-42', 'x', 10));
pr(symbolicDerive('x/(77*83/99)/sqrt(x*100/90)/65/(88+85)-63/56-42', 'x', 10));
pr(treeToSEXP(arithSimplify(calcParser('1*3*4*6*6*sin(x/x/x)')[0])));
*/

if (require.main === module) {
    REPL('Symbolic differentiator v0.85\nAvailable functions: '+Object.keys(arithDeriveOps).filter(x => x.length > 1).join(' ')+
    '\nAvailable variables: '+Object.keys(arithEnv).join(' ')+
    '\nType arithmetic expressions and press ENTER:\n','Error',
    function (expr) { return treeToSEXP(deriveComputer(expr)) },
    (out, inp) => pr('Derive(',inp,')','=',out));
}

module.exports = {
    derive: deriveComputer,
    simplify: arithSimplify,
    calcParser: calcParser,
    numericDerive: numericDerive,
    symbolicDerive: symbolicDerive
}

