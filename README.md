# Comby

Comby is a simple parser combinator library for Javascript. It comes with examples of practical usage.

# Parser combinators intro

Parser combinators are just recursive descent parsers implemented in a functional programming language.
A parser is a function that takes parse state as a single argument and produces either a new parse state or an error.
Combinator is a function that takes one or more functions and returns new function that is some combination of the arguments.
The following JS function represents a simple example of combinator:  
`function compose(fnA, fnB) {return function (x) { return fnA(fnB(x)) }}`  

Parser combinator is a function that takes one or more parsers (functions) and returns a new parser. The process of creating a new parser with parser combinators boils down to describing the grammar of a formar language you want to parse with nested parser combinator calls.  
Parser combinators inherit recursive descent parsers'  limitations: inability to parse left-recursive grammars (though you can often transform your grammar to get rid of left recursion), worst-case exponential parse time and implicit resolution of ambiguities. Still, recursive descent parsers are widely used in practical applications and parser combinator-based parsers are sufficient for many problems.  

# Library overview

Comby represents parser state as JS object (constructor: `comby.pState(s, i, p)`) with the following properties:  
s - sequence to be parsed, it can be either array or string  
i - current index in the sequence  
p - head of immutable list that contains parse results  

Every parser takes a pState instance as the first argument and produces either a new pState (with i increased to amount of input tokens consumed by this parser and p grown to store parser output) or undefined (in case of any parse error).

Parser combinators accept parsers (i.e. primitive parsers like MATCH(x) or output of other parser combinators), but they can also accept strings (interpreted as parsers matching this specific string) or objects (interpreted as parsers matching a token object with property values equal to this object). Parser combinators always return parsers.

To run a parser on some input you can either construct new pState object like this: `new comby.pState(["my","token","sequence"],0)` or like this: `new comby.pState(["my string"],0)` and call your parser with it or you can use `comby.wrap(parser, [tokenizer], [doNotReverse])` function. Using `comby.wrap` is preferred.  

# Examples

Run examples in node whilw in comby folder:  

Load comby: `var C = require('./comby.js')`  
We will make a parser matching the word "hello". This can be accomplished in several ways:  
`var p0 = C.$("hello");`  
`var p1 = C.SEQ("hel", "lo");`  
`var p2 = C.SEQ("h","e","l","l","o");`  
`var p3 = C.SEQ("h","e",SEQ("l","l"),"o");`  
Let's try one of these:  
`var wp2 = C.wrap(p2); console.log(wp2("helo")); console.log(wp2("hello"));`  
Let's allow for variable case of first letter:  
`var p4 = C.SEQ(C.ALT("H","h"), "ello"); var wp4 = C.wrap(p4); console.log(wp4("Hello")); console.log(wp4("hello"));`  
Now, let's transform the parser output:  
`var p5 = T(p4, function (arr) { return arr.join('') }); var wp5 = C.wrap(p5); console.log(wp5("Hello")); console.log(wp5("hello"));`  
  
See `example_simplecalc.js , example_engcalc.js , example_derive.js` for more sophisticated examples.  
Each one of them is runnable: `node example_engcalc.js`  
`example_derive.js` is especially interesting because it contains symbolic differentiation code.  

To run tests type `node tests.js`  

# List of parsers

* `MATCH(obj), $(obj)`
An explicit parser matching a string, usually not needed because all combinators can interpret strings as parsers matching strings

* `END`
Accept only if parser state corresponds to end of sequence

# List of parser combinators

* `SEQ(parser0, parser1, ... ,parserN)`
Accept all parsers from the argument list in order, if any does not match return error

* `ALT(parser0, parser1, ... ,parserN)`
Accept first matching parser from the argument list, if no match return error

* `OPT(parser)`
Optionally match parser

* `OPTREM(parser)`
If parser matches, accept and discard the result

* `REP(parser0, parser1, ... ,parserN)`
Accept at least one or more repetitions of parsers 0..N in order

* `T(parser, transformFn)`  
Transform parser result with function `transformFn(arr)`
function receives parser's output as an array `arr` (these args are popped from parser state's p-list)
value returned by function is accepted as final parser result and becomes the new head of the p-list.

# List of non-essential but useful common parsers provided by comby

* `NATNUM`
Accepts a natural number

* `NUM`
Accepts an IEEE floating-point number

* `ID`
Accepts an ID: an alphabetic characters possibly followed by alphanumeric characters

* `ID_T`
Accepts an id token (i.e. accepts a string)

* `NUM_T`
Accepts an number (i.e. a number)

# List of utility functions

* `wrap(p, [tokenizer], [doNotReverse])`
Wraps parser into a functions that accepts a string and returns either an array of parsed output or false.
Accepts an optional tokenizer function, if present it is used to preprocess the string into array of tokens which is passed to the parser.

* `tokenizer(rules)`  
Create a regexp-based tokenizer function  
`rules` is an object with two fields:  
`delim`: a js regexp string that matches delimiter  
`tokens`: an array of `[regexp_string, transform_fn]` arrays, each arrays describes a token with a regexp and a transform function.  
`regexp_string`: a js regexp string that matches token.  
`transform_fn`: a js function which receives token match substring and returns a token object (or number|string).  
Tokenizer ignores delimiter substrings and applies every regexp in order, saving produced token objects into token array.  
Returns: array of tokens.  
Example:  
`
var tok = tokenizer({delim: '\\s+',
           tokens: [
               ['[a-zA-Z](?:[a-zA-Z0-9]+)?', x => ({t:'id', d:x})],
               ['[0-9]+', x => parseInt(x)]
           ]});
`

