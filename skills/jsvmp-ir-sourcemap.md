# JSVMP IR Source Map Specification

> Maps IR instructions to original JS locations for browser breakpoint generation.

## 1. File Structure

```
output/
├── {name}_disasm.asm      # IR assembly
└── {name}_disasm.asm.map  # Source Map (JSON)
```

## 2. Source Map Format

```json
{
  "version": 1,
  "file": "main_disasm.asm",
  "sourceFile": "source/main.js",
  "sourceFileUrl": "https://example.com/main.js",
  
  "vm": {
    "dispatcher": {
      "function": "interpret",
      "line": 1000,
      "column": 8
    },
    "registers": {
      "ip": { "name": "pc", "description": "Instruction Pointer" },
      "sp": { "name": "sp", "description": "Stack Pointer" },
      "stack": { "name": "stk", "description": "Virtual Stack" },
      "bytecode": { "name": "code", "description": "Bytecode Array" },
      "scope": { "name": "env", "description": "Scope Chain" },
      "constants": { "name": "K", "description": "Constants Pool" }
    }
  },
  
  "functions": [
    { "id": 0, "name": "main", "bytecodeRange": [0, 100], "irLineRange": [10, 50] }
  ],
  
  "mappings": [
    {
      "irLine": 10,
      "irAddr": 0,
      "opcode": 1,
      "opcodeName": "PUSH_CONST",
      "source": { "line": 1000, "column": 8 },
      "breakpoint": {
        "condition": "pc === 0 && code[pc] === 1",
        "logMessage": "PC:0 OP:1 PUSH_CONST",
        "watchExpressions": [
          { "name": "$pc", "expr": "pc" },
          { "name": "$opcode", "expr": "code[pc]" },
          { "name": "$stack[0]", "expr": "stk[sp]" }
        ]
      },
      "semantic": "Push K[0]"
    }
  ],
  
  "opcodeHandlers": {
    "1": { "name": "PUSH_CONST", "handlerLine": 1050, "stackEffect": "+1" }
  }
}
```

## 3. Key Fields

### 3.1 `vm` - VM Structure

From `find_jsvmp_dispatcher` result. Variable names vary per target.

### 3.2 `mappings` - IR to JS Mappings

| Field | Description |
|-------|-------------|
| `irLine` | IR file line number (1-based) |
| `irAddr` | Bytecode address (0-based) |
| `opcode` | Raw opcode value |
| `source` | **ORIGINAL** JS location (from `[Src Lx:xxx]` in `read_code_smart` output) |
| `breakpoint.condition` | JS expression for conditional breakpoint |
| `breakpoint.watchExpressions` | Variables to extract when paused |

### ⚠️ 3.2.1 CRITICAL: Extracting Original Source Coordinates

**`find_jsvmp_dispatcher` returns BEAUTIFIED line numbers. You MUST use `read_code_smart` to read the code and extract ORIGINAL coordinates from `[Src Lx:xxx]` markers!**

**Workflow:**
```javascript
// Step 1: find_jsvmp_dispatcher gives beautified line (e.g., L:150)
const dispatcherInfo = find_jsvmp_dispatcher({ filePath: "source/main.js" });
// Returns: dispatcher at beautified line 150

// Step 2: Use read_code_smart to read the code and get original coordinates
read_code_smart({ file: "source/main.js", start: 148, end: 155 });
// Output:
// [L:148] [Src L1:28400]  function interpret() {
// [L:149] [Src L1:28420]    var pc = 0;
// [L:150] [Src L1:28456]    for (;;) {
//  ^^^^    ^^^^^^^^^^^^
//  |       └── ORIGINAL: line=1, column=28456 (USE THIS for Source Map!)
//  └── BEAUTIFIED line (for human reading only, DO NOT use for breakpoints)

// Step 3: Extract and use ORIGINAL coordinates in Source Map
{
  "source": { 
    "line": 1,       // ← From [Src L1:xxx] - extract the line number after "L"
    "column": 28456  // ← From [Src L1:28456] - extract the column number after ":"
  }
}
```

**Extraction Pattern:**
```javascript
// Parse [Src Lx:xxx] from read_code_smart output
const srcMatch = line.match(/\[Src L(\d+):(\d+)\]/);
if (srcMatch) {
  const originalLine = parseInt(srcMatch[1]);    // e.g., 1
  const originalColumn = parseInt(srcMatch[2]);  // e.g., 28456
}
```

**Why This Matters:**
- Minified JS files are typically 1 line with thousands of columns
- Chrome DevTools breakpoints use `lineNumber` + `columnNumber`
- Using beautified line numbers will set breakpoints at wrong locations
- **ALWAYS** use `read_code_smart` to verify code logic AND extract original coordinates

### 3.3 Breakpoint Condition

**MUST use actual variable names from `find_jsvmp_dispatcher`**:

```javascript
const info = await find_jsvmp_dispatcher({ filePath: "main.js" });
const ip = info.instructionPointer;      // e.g., "pc", "a2", "_0x1234"
const bytecode = info.bytecodeArray;     // e.g., "code", "o2", "_0x5678"

// Build condition
const condition = `${ip} === ${addr} && ${bytecode}[${ip}] === ${opcode}`;
```

| Scenario | Template |
|----------|----------|
| Specific PC + opcode | `{ip} === {pc} && {bytecode}[{ip}] === {opcode}` |
| PC only | `{ip} === {pc}` |
| Log breakpoint | `console.log(\`PC:\${${ip}}\`), false` |

### 3.4 Watch Expressions

Standard watches for every instruction:

```json
{
  "watchExpressions": [
    { "name": "$pc", "expr": "{ip}" },
    { "name": "$opcode", "expr": "{bytecode}[{ip}]" },
    { "name": "$stack[0]", "expr": "{stack}[{sp}]" },
    { "name": "$stack[1]", "expr": "{stack}[{sp}-1]" },
    { "name": "$sp", "expr": "{sp}" }
  ]
}
```

## 4. Usage

### Set Breakpoint at IR Line

```javascript
const map = JSON.parse(fs.readFileSync('output/main_disasm.asm.map'));
const mapping = map.mappings.find(m => m.irLine === targetLine);

set_breakpoint({
  urlRegex: `.*${path.basename(map.sourceFile)}.*`,
  lineNumber: mapping.source.line,
  columnNumber: mapping.source.column,
  condition: mapping.breakpoint.condition
});
```

### Extract VM State When Paused

```javascript
async function extractVMState(mapping) {
  const state = {};
  for (const watch of mapping.breakpoint.watchExpressions) {
    const result = await evaluate_on_call_frame({ expression: watch.expr });
    state[watch.name] = result.value;
  }
  return state;
}
```

## 5. Generation

```javascript
function generateMapping(pc, opcode, vmInfo, irLine) {
  const { ip, bytecode, stack, sp } = vmInfo.registers;
  
  return {
    irLine,
    irAddr: pc,
    opcode,
    opcodeName: OPCODE_TABLE[opcode].name,
    source: { line: vmInfo.dispatcher.line, column: vmInfo.dispatcher.column },
    breakpoint: {
      condition: `${ip.name} === ${pc} && ${bytecode.name}[${ip.name}] === ${opcode}`,
      logMessage: `PC:${pc} OP:${opcode}`,
      watchExpressions: [
        { name: "$pc", expr: ip.name },
        { name: "$opcode", expr: `${bytecode.name}[${ip.name}]` },
        { name: "$stack[0]", expr: `${stack.name}[${sp.name}]` }
      ]
    }
  };
}
```

## 6. Checklist

- [ ] Call `find_jsvmp_dispatcher` first to get dispatcher location and variable names
- [ ] **Use `read_code_smart` to read relevant code sections** (understand logic + get original coordinates)
- [ ] **Extract ORIGINAL coordinates from `[Src Lx:xxx]` in `read_code_smart` output**
- [ ] `source.line` and `source.column` use ORIGINAL coordinates for Chrome breakpoints
- [ ] `breakpoint.condition` uses actual variable names (not hardcoded)
- [ ] `irLine` = IR file line number for O(1) lookup
- [ ] `watchExpressions` generated for each instruction
