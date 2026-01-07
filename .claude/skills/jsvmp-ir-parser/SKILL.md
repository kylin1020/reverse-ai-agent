# JSVMP IR Parser (Chevrotain)

**MANDATORY**: Use Chevrotain for ALL IR parsing. NEVER use regex.

## LIR File Format (`.vmasm`)

### Header Section
```
@format v1.1
@domain target-website.com
@source source/main.js
@url https://example.com/api/*.js
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=k
```

### Injection Points (for VSCode Extension auto-breakpoints)
```
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578
@bytecode_transform expr="z.map(x=>x[0])"
@loop_entry line=2, column=131029
@breakpoint line=2, column=131639
```

**Purpose**:
- `@dispatcher`: Conditional breakpoint location
- `@global_bytecode`: Inject `window.__global_bytecode = {var}` AFTER variable assignment
  - If bytecode is in closure (e.g., `r.d`), inject inside closure after assignment
- `@bytecode_transform`: Expression to extract pure bytecode from mixed variable
  - Global bytecode variable may contain non-bytecode data
- `@loop_entry`: Inject offset calculation code (uses `window.__global_bytecode`)
- `@breakpoint`: Best breakpoint position inside dispatcher loop
- `line`/`column`: Source position in minified JS for CDP breakpoints

### Constants Section
```
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)
@const K[2] = Boolean(true)
@const K[3] = Null
```

### Code Section
```
@section code
@entry 0x0000

0x0000: PUSH_CONST         K[0]            ; "signature"
0x0005: GET_GLOBAL                         ; window
0x000A: CALL               2               ; fn(arg1, arg2)
0x000F: RET                                ; return
```

## Token Definitions

**Order matters**: Longer patterns first, Identifier last.

```
WhiteSpace, NewLine, LineComment (skipped)
Directives: @format, @domain, @source, @url, @reg, @section, @const, @entry
Injection: @dispatcher, @global_bytecode, @bytecode_transform, @loop_entry, @breakpoint
Types: String, Number, Boolean, Null, Object
References: HexAddress (0x[0-9A-Fa-f]+:?), KRef (K[\d+]), VRef (v[\d+])
Literals: QuotedString, NumericLiteral, BooleanLiteral
Operators: =, ,, (, ), [, ]
Identifier (last)
```

## Parser Rules

```
program = headerSection + constantsSection + codeSection

headerSection = formatDecl? + domainDecl? + sourceDecl? + urlDecl? + regDecl

regDecl = @reg + regMapping (, regMapping)*
regMapping = Identifier = Identifier

constantsSection = @section constants + constDecl*
constDecl = @const KRef = typedValue

codeSection = @section code + entryDecl? + instruction*
instruction = HexAddress + Identifier + operand*
operand = KRef | VRef | HexAddress | NumericLiteral | QuotedString | Identifier
```

## AST Structure

```javascript
{
  header: {
    format: "v1.1",
    domain: "douyin.com",
    source: "source/bdms.js",
    url: "https://*.douyin.com/*/bdms.js",
    registers: { ip: "a", sp: "p", stack: "v", bc: "o", storage: "l", const: "Z" }
  },
  injectionPoints: {
    dispatcher: { location: { line: 2, column: 131618 }, breakpoint: { line: 2, column: 131639 } },
    globalBytecode: { variable: "z", location: { line: 2, column: 91578 } },
    bytecodeTransform: { expr: "z.map(x=>x[0])" },
    loopEntry: { location: { line: 2, column: 131029 } }
  },
  constants: [
    { index: 0, type: "String", value: "signature" },
    { index: 1, type: "Number", value: 1024 }
  ],
  code: {
    entry: 0,
    instructions: [
      { addr: 0x0000, opcode: "PUSH_CONST", operands: ["K[0]"], lineNumber: 42 },
      { addr: 0x0005, opcode: "GET_GLOBAL", operands: [], lineNumber: 43 }
    ]
  },
  lineToAddr: Map<lineNumber, address>,
  addrToLine: Map<address, lineNumber>
}
```

## Usage in lib/*.js

```javascript
// Requires compilation: cd jsvmp-ir-extension && npm run compile
const { VmasmLexer } = require('../../jsvmp-ir-extension/out/utils/vmasm-lexer');
const { vmasmParser } = require('../../jsvmp-ir-extension/out/utils/vmasm-parser');
const { vmasmVisitor } = require('../../jsvmp-ir-extension/out/utils/vmasm-visitor');

function parseVmasmFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lexResult = VmasmLexer.tokenize(content);
  vmasmParser.input = lexResult.tokens;
  return vmasmVisitor.visit(vmasmParser.program());
}
```

## Key AST Fields

| Field | Type | Description |
|-------|------|-------------|
| `instructions[].addr` | number | Bytecode address (hex) |
| `instructions[].opcode` | string | Opcode name |
| `instructions[].operands` | string[] | Operand list |
| `instructions[].lineNumber` | number | IR file line number |
| `constants[].index` | number | K[index] |
| `constants[].type` | string | String/Number/Boolean/Null |
| `constants[].value` | any | Constant value |
| `lineToAddr` | Map | IR line → bytecode address |
| `addrToLine` | Map | Bytecode address → IR line |
