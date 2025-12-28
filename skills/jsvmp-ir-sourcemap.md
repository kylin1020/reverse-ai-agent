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
| `source` | Original JS location |
| `breakpoint.condition` | JS expression for conditional breakpoint |
| `breakpoint.watchExpressions` | Variables to extract when paused |

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

- [ ] Call `find_jsvmp_dispatcher` first to get actual variable names
- [ ] `breakpoint.condition` uses actual variable names (not hardcoded)
- [ ] `irLine` = actual file line number for O(1) lookup
- [ ] `watchExpressions` generated for each instruction
