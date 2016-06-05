# Comby

Comby is a simple parser combinator library for Javascript. Examples of practcal usage are provided.

# Parser combinators intro

Parser combinators are just recursive descent parsers implemented in functional language.
A parser is a function that takes parse state as a single argument and produces either a new parse state or an error.
Combinator is a function that takes one or more functions and returns new function that is some combination of the arguments.
A simple example of a combinator is
`function compose(fnA, fnB) {return function (x) { return fnA(fnB(x)) }}`
Parser combinator is a function that takes one or more parsers (functions) and returns a new parser. Parser combinators inherit limitations from recursive descent parsers: inability to parse left-recursive grammars, worst-case exponential parse time and implicit resolution of ambiguities. Still, recursive descent parsers are widely used in practical applications and parser combinator-based parsers are sufficient for many problems.

# Library overview

Comby represents parser state as JS object (constructor: pState) with the following properties:  
s - sequence to be parsed, it can be either array or string  
i - current index in the sequence  
p - head of immutable list that contains parse results  

Every parser takes a pState instance as the first argument and produces either a new pState (with i increased to amount of input tokens consumed by this parser and p grown to store parser output) or undefined (in case of any parse error).

Parser combinators accept parsers (i.e. primitive parsers like MATCH(x) or output of other parser combinators), but they can also accept strings (interpreted as matching this specific string) or objects (interpreted as matching a token object with property values equal to this object). Parser combinators always return parsers.

To run a parser on some input you can either construct new pState object `new comby.pState(["my","token","sequence"],0)` and call your parser with it, or you can use `comby.wrap(parser, [tokenizer], [doNotReverse])` function.

# Examples

# List of parsers

* `MATCH(obj), $(obj)`

* `END`

# List of parser combinators

* `SEQ(parser0, parser1, ... ,parserN)`

* `ALT(parser0, parser1, ... ,parserN)`

* `OPT(parser)`

* `OPTREM(parser)`

Accept at least one or more repetitions of parser
* `REP(parser0, parser1, ... ,parserN)`

* `T(parser, transformFn)`  
Transform parser result with function transformFn(arr)
function receives parser output as an array arr (these args are popped from stack)
value returned by function is accepted as final parser result and pushed onto stack

# List of non-essential but useful common parsers provided by comby

* `NATNUM`

* `NUM`

* `ID`

* `ID_T`
    
* `NUM_T`

# List of utility functions

* `wrapParser(p, [tokenizer], [doNotReverse])`

* `tokenizer(rules)`  
Create a regexp-based tokenizer  
Example:  
`
tokenizer({delim: '\\s+',
           tokens: [
               ['[a-zA-Z](?:[a-zA-Z0-9]+)?', x => ({t:'id', d:x})],
               ['[0-9]+', x => parseInt(x)]
           ]});
`



