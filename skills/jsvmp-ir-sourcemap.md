# JSVMP IR Source Map Specification

> Maps IR instructions to original JS locations for browser breakpoint generation.

## ⚠️ CRITICAL FORMAT REQUIREMENT

**When generating IR source maps, you MUST follow the EXACT format specified in Section 2 below. This format is required for proper breakpoint generation and IR debugging. Do NOT use any other format or structure.**

## 1. File Structure

```
output/
├── {name}_disasm.asm      # IR assembly
└── {name}_disasm.asm.map  # Source Map (JSON)
```

## 2. Source Map Format (REQUIRED STRUCTURE)

**⚠️ CRITICAL: This is the EXACT format that MUST be generated. Do NOT deviate from this structure.**

```json
{
  "version": 1,
  "file": "example.asm",
  "sourceFile": "src/example.js",
  "sourceFileUrl": "http://localhost:3000/src/example.js",
  
  "vm": {
    "dispatcher": {
      "function": "dispatch",
      "line": 42,
      "column": 8,
      "description": "Main VM dispatcher loop"
    },
    "registers": {
      "ip": {
        "name": "pc",
        "description": "Program Counter / Instruction Pointer"
      },
      "sp": {
        "name": "sp",
        "description": "Stack Pointer"
      },
      "stack": {
        "name": "stack",
        "description": "Virtual Machine Stack"
      },
      "bytecode": {
        "name": "bytecode",
        "description": "Bytecode Array"
      },
      "scope": {
        "name": "scope",
        "description": "Scope Chain Array"
      },
      "constants": {
        "name": "constants",
        "description": "Constants Pool"
      }
    },
    "entryPoint": {
      "line": 10,
      "column": 0,
      "description": "VM entry point"
    }
  },
  
  "functions": [
    {
      "id": 0,
      "name": "main",
      "bytecodeRange": [0, 15],
      "irLineRange": [1, 8],
      "params": 0,
      "strict": true
    },
    {
      "id": 1,
      "name": "add",
      "bytecodeRange": [16, 25],
      "irLineRange": [9, 14],
      "params": 2,
      "strict": false
    }
  ],
  
  "mappings": [
    {
      "irLine": 1,
      "irAddr": 0,
      "opcode": 1,
      "opcodeName": "PUSH_CONST",
      "source": {
        "line": 5,
        "column": 12
      },
      "breakpoint": {
        "condition": "pc === 0",
        "logMessage": "Pushing constant to stack",
        "watchExpressions": [
          {
            "name": "$pc",
            "expr": "pc"
          },
          {
            "name": "$sp",
            "expr": "sp"
          },
          {
            "name": "$stack[0]",
            "expr": "stack[0]"
          }
        ]
      },
      "semantic": "Push constant 42 onto stack"
    },
    {
      "irLine": 2,
      "irAddr": 2,
      "opcode": 2,
      "opcodeName": "LOAD_VAR",
      "source": {
        "line": 6,
        "column": 8
      },
      "breakpoint": {
        "condition": "pc === 2",
        "logMessage": "Loading variable",
        "watchExpressions": [
          {
            "name": "$pc",
            "expr": "pc"
          },
          {
            "name": "$scope[0]",
            "expr": "scope[0]"
          }
        ]
      },
      "semantic": "Load variable 'x' from scope"
    },
    {
      "irLine": 3,
      "irAddr": 4,
      "opcode": 10,
      "opcodeName": "ADD",
      "source": {
        "line": 6,
        "column": 14
      },
      "breakpoint": {
        "condition": "pc === 4",
        "logMessage": "Performing addition",
        "watchExpressions": [
          {
            "name": "$stack[sp-1]",
            "expr": "stack[sp-1]"
          },
          {
            "name": "$stack[sp]",
            "expr": "stack[sp]"
          }
        ]
      },
      "semantic": "Add top two stack values"
    },
    {
      "irLine": 4,
      "irAddr": 5,
      "opcode": 20,
      "opcodeName": "CALL",
      "source": {
        "line": 7,
        "column": 4
      },
      "breakpoint": {
        "condition": "pc === 5",
        "logMessage": "Calling function",
        "watchExpressions": [
          {
            "name": "$pc",
            "expr": "pc"
          },
          {
            "name": "$args",
            "expr": "stack.slice(sp-2, sp)"
          }
        ]
      },
      "semantic": "Call function with 2 arguments"
    }
  ]
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

**IMPORTANT: Follow the exact structure from Section 2. All fields are REQUIRED.**

```javascript
function generateSourceMap(vmInfo, functions, mappings) {
  return {
    version: 1,
    file: `${vmInfo.name}_disasm.asm`,
    sourceFile: vmInfo.sourceFile,
    sourceFileUrl: vmInfo.sourceFileUrl,
    
    vm: {
      dispatcher: {
        function: vmInfo.dispatcher.function,
        line: vmInfo.dispatcher.line,
        column: vmInfo.dispatcher.column,
        description: vmInfo.dispatcher.description || "Main VM dispatcher loop"
      },
      registers: {
        ip: {
          name: vmInfo.registers.ip.name,
          description: vmInfo.registers.ip.description || "Program Counter / Instruction Pointer"
        },
        sp: {
          name: vmInfo.registers.sp.name,
          description: vmInfo.registers.sp.description || "Stack Pointer"
        },
        stack: {
          name: vmInfo.registers.stack.name,
          description: vmInfo.registers.stack.description || "Virtual Machine Stack"
        },
        bytecode: {
          name: vmInfo.registers.bytecode.name,
          description: vmInfo.registers.bytecode.description || "Bytecode Array"
        },
        scope: {
          name: vmInfo.registers.scope.name,
          description: vmInfo.registers.scope.description || "Scope Chain Array"
        },
        constants: {
          name: vmInfo.registers.constants.name,
          description: vmInfo.registers.constants.description || "Constants Pool"
        }
      },
      entryPoint: {
        line: vmInfo.entryPoint.line,
        column: vmInfo.entryPoint.column,
        description: vmInfo.entryPoint.description || "VM entry point"
      }
    },
    
    functions: functions.map(fn => ({
      id: fn.id,
      name: fn.name,
      bytecodeRange: fn.bytecodeRange,
      irLineRange: fn.irLineRange,
      params: fn.params,
      strict: fn.strict
    })),
    
    mappings: mappings.map(m => ({
      irLine: m.irLine,
      irAddr: m.irAddr,
      opcode: m.opcode,
      opcodeName: m.opcodeName,
      source: {
        line: m.source.line,
        column: m.source.column
      },
      breakpoint: {
        condition: m.breakpoint.condition,
        logMessage: m.breakpoint.logMessage,
        watchExpressions: m.breakpoint.watchExpressions.map(w => ({
          name: w.name,
          expr: w.expr
        }))
      },
      semantic: m.semantic
    }))
  };
}

function generateMapping(pc, opcode, vmInfo, irLine, sourceLoc, semantic) {
  const { ip, bytecode, stack, sp, scope } = vmInfo.registers;
  
  return {
    irLine,
    irAddr: pc,
    opcode,
    opcodeName: OPCODE_TABLE[opcode].name,
    source: {
      line: sourceLoc.line,
      column: sourceLoc.column
    },
    breakpoint: {
      condition: `${ip.name} === ${pc}`,
      logMessage: `PC:${pc} OP:${opcode} ${OPCODE_TABLE[opcode].name}`,
      watchExpressions: [
        { name: "$pc", expr: ip.name },
        { name: "$sp", expr: sp.name },
        { name: "$stack[0]", expr: `${stack.name}[${sp.name}]` },
        { name: "$stack[1]", expr: `${stack.name}[${sp.name}-1]` }
      ]
    },
    semantic
  };
}
```

## 6. Checklist

- [ ] **MUST follow EXACT format from Section 2** - all fields are required
- [ ] Call `find_jsvmp_dispatcher` first to get dispatcher location and variable names
- [ ] **Use `read_code_smart` to read relevant code sections** (understand logic + get original coordinates)
- [ ] **Extract ORIGINAL coordinates from `[Src Lx:xxx]` in `read_code_smart` output**
- [ ] `source.line` and `source.column` use ORIGINAL coordinates for Chrome breakpoints
- [ ] `breakpoint.condition` uses actual variable names (not hardcoded)
- [ ] `breakpoint.logMessage` is descriptive and includes PC/opcode info
- [ ] `breakpoint.watchExpressions` includes at minimum: $pc, $sp, $stack[0]
- [ ] `semantic` field describes what the instruction does in plain language
- [ ] `irLine` = IR file line number for O(1) lookup
- [ ] `vm.entryPoint` is populated with correct line/column
- [ ] `functions` array includes all discovered functions with correct ranges
- [ ] All register descriptions are filled in (ip, sp, stack, bytecode, scope, constants)
