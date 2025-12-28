# JSVMP IR Source Map Specification

> This specification defines the mapping format between IR and original JS code, enabling automatic browser breakpoint generation from IR line numbers.

## 1. Design Goals

| Goal | Description |
|------|-------------|
| IR → JS Mapping | Each IR instruction maps to precise JS location |
| Precise Breakpoints | Conditions combine IP + opcode for accuracy |
| Bidirectional Query | Support IR→JS and JS→IR lookups |
| Incremental Update | Support mapping updates after IR modifications |

## 2. File Structure

### 2.1 Output Files

```
output/
├── {name}_disasm.asm          # IR assembly file
├── {name}_disasm.asm.map      # IR Source Map (JSON)
└── {name}_disasm.asm.map.idx  # Fast index file (optional)
```

### 2.2 Source Map Format (JSON)

```json
{
  "version": 1,
  "file": "bdms_disasm.asm",
  "sourceFile": "source/bdms.js",
  "sourceFileUrl": "https://example.com/bdms.js",
  
  "vm": {
    "dispatcher": {
      "function": "d2",
      "line": 3298,
      "column": 12,
      "description": "主解释器循环"
    },
    "registers": {
      "ip": { "name": "a2", "description": "Instruction Pointer" },
      "sp": { "name": "p2", "description": "Stack Pointer" },
      "stack": { "name": "v2", "description": "Virtual Stack" },
      "bytecode": { "name": "o2", "description": "Bytecode Array" }
    }
  },
  
  "functions": [
    {
      "id": 0,
      "name": "main",
      "bytecodeRange": [0, 1903],
      "irLineRange": [15, 2500]
    }
  ],
  
  "mappings": [
    {
      "irLine": 15,
      "irAddr": 0,
      "opcode": 17,
      "opcodeName": "PUSH_CONST",
      "source": { "line": 3298, "column": 12 },
      "breakpoint": {
        "condition": "a2 === 0 && o2[a2] === 17",
        "logMessage": "PC:0 OP:17 PUSH_CONST Z[134]"
      },
      "semantic": "Push Z[134]=\"1.0.1.19\""
    },
    {
      "irLine": 16,
      "irAddr": 2,
      "opcode": 23,
      "opcodeName": "SET_SCOPE",
      "source": { "line": 3298, "column": 12 },
      "breakpoint": {
        "condition": "a2 === 2 && o2[a2] === 23",
        "logMessage": "PC:2 OP:23 SET_SCOPE depth=0 Z[8]"
      },
      "semantic": "scope[0][Z[8]] = pop()"
    }
  ],
  
  "opcodeHandlers": {
    "17": {
      "name": "PUSH_CONST",
      "handlerLine": 3350,
      "handlerColumn": 8,
      "description": "Push constant from Z array"
    }
  }
}
```

## 3. Core Field Descriptions

### 3.1 `vm` - VM Structure Info

Extracted from `find_jsvmp_dispatcher` result:

```json
{
  "vm": {
    "dispatcher": {
      "function": "d2",           // Dispatcher function name
      "line": 3298,               // Dispatcher entry line
      "column": 12,               // Dispatcher entry column
      "description": "Main interpreter loop"
    },
    "registers": {
      "ip": { "name": "a2", "description": "Instruction Pointer" },
      "sp": { "name": "p2", "description": "Stack Pointer" },
      "stack": { "name": "v2", "description": "Virtual Stack" },
      "bytecode": { "name": "o2", "description": "Bytecode Array" },
      "scope": { "name": "s2", "description": "Scope Chain Array" },
      "constants": { "name": "Z", "description": "Constants Pool" }
    },
    "entryPoint": {
      "line": 3298,
      "column": 12,
      "condition": null,
      "description": "Opcode fetch point"
    }
  }
}
```

### 3.2 `mappings` - IR to JS Mappings

Each IR instruction has one mapping entry:

```json
{
  "irLine": 15,                    // IR file line number (1-based)
  "irAddr": 0,                     // Bytecode address (0-based)
  "opcode": 17,                    // Raw opcode value
  "opcodeName": "PUSH_CONST",      // Mnemonic
  
  "source": {
    "line": 3298,                  // Original JS line number
    "column": 12                   // Original JS column (for set_breakpoint)
  },
  
  "breakpoint": {
    "condition": "a2 === 0 && o2[a2] === 17",  // Breakpoint condition (JS expression)
    "logMessage": "PC:0 OP:17",    // Log breakpoint message
    "watchExpressions": [          // Variables to watch when paused
      { "name": "$stack[0]", "expr": "v2[p2]" },
      { "name": "$stack[1]", "expr": "v2[p2-1]" },
      { "name": "$opcode", "expr": "o2[a2]" },
      { "name": "$pc", "expr": "a2" }
    ]
  },
  
  "semantic": "Push Z[134]=\"1.0.1.19\""  // Semantic description
}
```

### 3.3 `breakpoint.condition` - Breakpoint Condition

Breakpoint condition is a JavaScript expression executed in browser. **MUST use variables from `find_jsvmp_dispatcher` result**.

**Condition Generation Process**:
1. Call `find_jsvmp_dispatcher` to get actual variable names
2. Use returned `instructionPointer`, `bytecodeArray` etc. to build condition
3. Combine multiple variables for precise breakpoints

| Scenario | Condition Template | Example (if IP=`a2`, Bytecode=`o2`) |
|----------|-------------------|-------------------------------------|
| Specific PC + opcode | `{ip} === {pc} && {bytecode}[{ip}] === {opcode}` | `a2 === 100 && o2[a2] === 17` |
| Specific PC only | `{ip} === {pc}` | `a2 === 100` |
| PC range + opcode | `{ip} >= {start} && {ip} <= {end} && {bytecode}[{ip}] === {opcode}` | `a2 >= 100 && a2 <= 200 && o2[a2] === 18` |
| Stack condition | `{ip} === {pc} && {stack}[{sp}] === "test"` | `a2 === 50 && v2[p2] === "test"` |
| Log breakpoint | `console.log(\`PC:\${${ip}} OP:\${${bytecode}[${ip}]}\`), false` | `console.log(\`PC:\${a2} OP:\${o2[a2]}\`), false` |

**Important**: Variable names like `a2`, `o2`, `v2`, `p2` are just examples. Actual names vary per target and MUST be obtained from `find_jsvmp_dispatcher`.

```javascript
// Example: Build condition from find_jsvmp_dispatcher result
const dispatcherInfo = await find_jsvmp_dispatcher({ filePath: "source/main.js" });

// Extract actual variable names
const ip = dispatcherInfo.instructionPointer;      // e.g., "a2" or "_0x1234"
const bytecode = dispatcherInfo.bytecodeArray;     // e.g., "o2" or "_0x5678"

// Build precise condition using actual names
const condition = `${ip} === ${pc} && ${bytecode}[${ip}] === ${opcode}`;
```

### 3.4 `breakpoint.watchExpressions` - Debug Variable Extraction

`watchExpressions` defines VM runtime variables to extract when paused at a breakpoint. This enables mapping JSVMP internal state to human-readable IR variables.

**VM Runtime → IR Variable Mapping**:

| VM Runtime | IR Variable | Description |
|------------|-------------|-------------|
| `{stack}[{sp}]` | `$stack[0]` | Stack top (TOS) |
| `{stack}[{sp}-1]` | `$stack[1]` | Stack second |
| `{stack}[{sp}-2]` | `$stack[2]` | Stack third |
| `{scope}[depth]` | `$scope[depth]` | Scope at depth |
| `{bytecode}[{ip}]` | `$opcode` | Current opcode |
| `{ip}` | `$pc` | Program counter |
| `{constants}[x]` | `$const[x]` | Constant pool value |

**Standard Watch Expressions** (generated for every instruction):

```json
{
  "watchExpressions": [
    { "name": "$pc", "expr": "a2" },
    { "name": "$opcode", "expr": "o2[a2]" },
    { "name": "$stack[0]", "expr": "v2[p2]" },
    { "name": "$stack[1]", "expr": "v2[p2-1]" },
    { "name": "$stack[2]", "expr": "v2[p2-2]" },
    { "name": "$sp", "expr": "p2" }
  ]
}
```

**Opcode-Specific Watch Expressions**:

Different opcodes may need additional watches based on their operands:

```javascript
// LOAD_SCOPE depth=0, x=8 → also watch the scope being accessed
{
  "watchExpressions": [
    // ... standard watches ...
    { "name": "$scope[0]", "expr": "s2[0]" },
    { "name": "$scope[0][8]", "expr": "s2[0][Z[8]]" }
  ]
}

// CALL n=3 → watch the function and arguments
{
  "watchExpressions": [
    // ... standard watches ...
    { "name": "$fn", "expr": "v2[p2-3]" },
    { "name": "$this", "expr": "v2[p2-4]" },
    { "name": "$args", "expr": "[v2[p2-2], v2[p2-1], v2[p2]]" }
  ]
}
```

**Generation from VM Info**:

```javascript
function generateWatchExpressions(vmInfo, opcode, operands) {
  const { ip, sp, stack, bytecode, scope, constants } = vmInfo.registers;
  
  // Standard watches (always included)
  const watches = [
    { name: "$pc", expr: ip.name },
    { name: "$opcode", expr: `${bytecode.name}[${ip.name}]` },
    { name: "$stack[0]", expr: `${stack.name}[${sp.name}]` },
    { name: "$stack[1]", expr: `${stack.name}[${sp.name}-1]` },
    { name: "$stack[2]", expr: `${stack.name}[${sp.name}-2]` },
    { name: "$sp", expr: sp.name }
  ];
  
  // Opcode-specific watches
  if (opcode === 'LOAD_SCOPE' || opcode === 'SET_SCOPE') {
    const [depth, idx] = operands;
    watches.push({ 
      name: `$scope[${depth}]`, 
      expr: `${scope.name}[${depth}]` 
    });
  }
  
  if (opcode === 'CALL' || opcode === 'NEW') {
    const argCount = operands[0];
    watches.push({ 
      name: "$fn", 
      expr: `${stack.name}[${sp.name}-${argCount}]` 
    });
  }
  
  return watches;
}
```

**Usage in Browser DevTools**:

When paused at a breakpoint, use `evaluate_on_call_frame` to extract values:

```javascript
async function extractVMState(sourceMap, irLine) {
  const mapping = sourceMap.mappings.find(m => m.irLine === irLine);
  if (!mapping?.breakpoint?.watchExpressions) return null;
  
  const state = {};
  for (const watch of mapping.breakpoint.watchExpressions) {
    const result = await evaluate_on_call_frame({
      expression: watch.expr,
      maxOutputChars: 1000
    });
    state[watch.name] = result.value;
  }
  
  return state;
}

// Example output:
// {
//   "$pc": 100,
//   "$opcode": 17,
//   "$stack[0]": "hello",
//   "$stack[1]": 42,
//   "$sp": 5
// }
```

### 3.5 `opcodeHandlers` - Opcode Handler Mappings

```json
{
  "opcodeHandlers": {
    "17": {
      "name": "PUSH_CONST",
      "handlerLine": 3350,         // Handler code line
      "handlerColumn": 8,          // Handler code column
      "description": "Push constant from Z array",
      "stackEffect": "+1",         // Stack effect
      "operands": ["constIndex"]   // Operand types
    },
    "18": {
      "name": "JMP",
      "handlerLine": 3380,
      "handlerColumn": 8,
      "description": "Unconditional jump",
      "stackEffect": "0",
      "operands": ["targetAddr"]
    }
  }
}
```

## 4. IR File Format (Clean Version)

IR file stays clean, only function header has source mapping. **Source Map uses actual line numbers for direct indexing**.

```javascript
// JSVMP Disassembly - douyin.com bdms.js
// Source Map: bdms_disasm.asm.map
// Total Functions: 42
// Total Constants: 256

// ========================================
// Function 0 (main)
// Params: 0, Strict: true
// Bytecode: [0, 1903]
// Source: L3298:12
// ========================================

    0: LOAD_CLOSURE       1          // D(x, s2) - create closure // Z[1]="Symbol"
    2: SET_SCOPE          0   8      // scope[depth][x] = val // depth=0, Z[8]="string"
   14: JMP                8          // Unconditional jump // -> 22
```

**Key Points**:
- Use `//` comments instead of `;;`
- Function header has `Source: L{line}:{column}` for starting position
- **No special markers needed** - Source Map `irLine` is the actual file line number
- Individual instruction breakpoint info is ALL in `.asm.map` file

**Matching Logic** (O(1) lookup):
```javascript
// Source Map stores actual line numbers, build index once
const lineIndex = {};
for (const mapping of sourceMap.mappings) {
  lineIndex[mapping.irLine] = mapping;
}

// Direct lookup by line number
function getBreakpointForLine(lineNumber) {
  return lineIndex[lineNumber];
}
```

## 5. Usage Scenarios

### 5.1 Set Breakpoint at IR Line

```javascript
// Read Source Map
const sourceMap = JSON.parse(fs.readFileSync('output/bdms_disasm.asm.map'));

// Find breakpoint info for IR line 15
const mapping = sourceMap.mappings.find(m => m.irLine === 15);

// Set browser breakpoint with precise condition
set_breakpoint(
  urlRegex: ".*bdms.js.*",
  lineNumber: mapping.source.line,
  columnNumber: mapping.source.column,
  condition: mapping.breakpoint.condition  // e.g., "a2 === 0 && o2[a2] === 17"
);
```

### 5.2 Set Breakpoint at Specific PC

```javascript
// Find breakpoint info for PC=100
const mapping = sourceMap.mappings.find(m => m.irAddr === 100);

if (mapping) {
  // Use mapping's precise condition
  set_breakpoint(
    urlRegex: ".*bdms.js.*",
    lineNumber: mapping.source.line,
    columnNumber: mapping.source.column,
    condition: mapping.breakpoint.condition
  );
} else {
  // Fallback: use dispatcher location with manual condition
  const { ip, bytecode } = sourceMap.vm.registers;
  set_breakpoint(
    urlRegex: ".*bdms.js.*",
    lineNumber: sourceMap.vm.dispatcher.line,
    columnNumber: sourceMap.vm.dispatcher.column,
    condition: `${ip.name} === 100`
  );
}
```

### 5.3 Batch Set Log Breakpoints

```javascript
// Set log breakpoints for all CALL instructions
const callMappings = sourceMap.mappings.filter(m => m.opcodeName === 'CALL');

for (const mapping of callMappings) {
  set_breakpoint(
    urlRegex: ".*bdms.js.*",
    lineNumber: mapping.source.line,
    columnNumber: mapping.source.column,
    // Log breakpoint: log message then return false to not pause
    condition: `console.log('${mapping.breakpoint.logMessage}'), false`
  );
}
```

## 6. Generating Source Map

### 6.1 Generating Mappings During Disassembly

When generating IR, collect mapping info into Source Map file:

```javascript
// Disassembler output structure
const disasmResult = {
  asm: [],           // IR lines
  mappings: [],      // Mapping entries (stored in .map file)
  opcodeHandlers: {} // Handler info
};

function disassemble(bytecode, constants, vmInfo) {
  // Get actual variable names from find_jsvmp_dispatcher result
  const ip = vmInfo.registers.ip.name;           // e.g., "a2" or "_0x1234"
  const bytecodeArr = vmInfo.registers.bytecode.name;  // e.g., "o2" or "_0x5678"
  
  let irLine = 10;  // Skip file header (adjust based on actual header lines)
  
  for (let pc = 0; pc < bytecode.length; ) {
    const opcode = bytecode[pc];
    const handler = OPCODE_TABLE[opcode];
    
    // Generate IR line (clean format, no breakpoint info)
    const irText = formatInstruction(pc, opcode, ...);
    disasmResult.asm.push(irText);
    
    // Generate mapping (stored in .map file)
    // IMPORTANT: Use actual variable names from vmInfo
    disasmResult.mappings.push({
      irLine: irLine,
      irAddr: pc,
      opcode: opcode,
      opcodeName: handler.name,
      source: {
        line: vmInfo.dispatcher.line,
        column: vmInfo.dispatcher.column
      },
      breakpoint: {
        // Build condition using actual variable names
        condition: `${ip} === ${pc} && ${bytecodeArr}[${ip}] === ${opcode}`,
        logMessage: `PC:${pc} OP:${opcode} ${handler.name}`
      },
      semantic: handler.semantic
    });
    
    irLine++;
    pc += handler.size;
  }
  
  return disasmResult;
}

// Output files
fs.writeFileSync('output/main_disasm.asm', disasmResult.asm.join('\n'));
fs.writeFileSync('output/main_disasm.asm.map', JSON.stringify({
  version: 1,
  file: 'main_disasm.asm',
  sourceFile: 'source/main.js',
  vm: vmInfo,
  mappings: disasmResult.mappings,
  opcodeHandlers: disasmResult.opcodeHandlers
}, null, 2));
```

### 6.2 Sub-Agent Prompt Template

```markdown
## Task: Generate IR with Source Map

### Input
- VM info (from find_jsvmp_dispatcher):
  - Dispatcher location: L{line}:{column}
  - Registers: IP={ip}, SP={sp}, Stack={stack}, Bytecode={bytecode}
- Bytecode: raw/bytecode.json
- Constants: raw/constants.json

### Output
1. `output/{name}_disasm.asm` - IR assembly file (clean format)
2. `output/{name}_disasm.asm.map` - Source Map (JSON with all breakpoint mappings)

### IR Format Requirements
- Use `//` comments
- Function header has `Source: L{line}:{column}`
- Instruction lines have NO breakpoint info
- Reference: `#[[file:skills/jsvmp-ir-format.md]]`

### Source Map Format Requirements
- One mapping entry per instruction
- breakpoint.condition MUST use actual variable names from `find_jsvmp_dispatcher`
  - Get: `instructionPointer`, `bytecodeArray`, etc.
  - Build: `{ip} === {pc} && {bytecode}[{ip}] === {opcode}`
  - Names vary per target (could be `a2`, `_0x1234`, `ip`, etc.)
- Reference: `#[[file:skills/jsvmp-ir-sourcemap.md]]`
```

## 7. Utility Functions

### 7.1 Get Breakpoint Info from IR Line

```javascript
function getBreakpointForIRLine(sourceMapPath, irLine) {
  const map = JSON.parse(fs.readFileSync(sourceMapPath));
  const mapping = map.mappings.find(m => m.irLine === irLine);
  
  if (!mapping) return null;
  
  return {
    urlRegex: `.*${path.basename(map.sourceFile)}.*`,
    lineNumber: mapping.source.line,
    columnNumber: mapping.source.column,
    condition: mapping.breakpoint.condition  // Already has IP + opcode
  };
}
```

### 7.2 Get Breakpoint Info from PC

```javascript
function getBreakpointForPC(sourceMapPath, pc) {
  const map = JSON.parse(fs.readFileSync(sourceMapPath));
  const mapping = map.mappings.find(m => m.irAddr === pc);
  
  if (mapping) {
    // Use mapping's precise condition
    return {
      urlRegex: `.*${path.basename(map.sourceFile)}.*`,
      lineNumber: mapping.source.line,
      columnNumber: mapping.source.column,
      condition: mapping.breakpoint.condition
    };
  }
  
  // Fallback: use dispatcher entry with IP condition only
  const { ip, bytecode } = map.vm.registers;
  return {
    urlRegex: `.*${path.basename(map.sourceFile)}.*`,
    lineNumber: map.vm.dispatcher.line,
    columnNumber: map.vm.dispatcher.column,
    condition: `${ip.name} === ${pc}`
  };
}
```

### 7.3 Batch Set Breakpoints

```javascript
async function setBreakpointsFromSourceMap(sourceMapPath, filter = null) {
  const map = JSON.parse(fs.readFileSync(sourceMapPath));
  const breakpoints = [];
  
  for (const mapping of map.mappings) {
    if (filter && !filter(mapping)) continue;
    
    const bp = await set_breakpoint({
      urlRegex: `.*${path.basename(map.sourceFile)}.*`,
      lineNumber: mapping.source.line,
      columnNumber: mapping.source.column,
      condition: mapping.breakpoint.condition
    });
    
    breakpoints.push({
      irLine: mapping.irLine,
      irAddr: mapping.irAddr,
      breakpointId: bp.breakpointId
    });
  }
  
  return breakpoints;
}

// Example: Set breakpoints only for CALL instructions
await setBreakpointsFromSourceMap(
  'output/bdms_disasm.asm.map',
  m => m.opcodeName === 'CALL'
);
```

## 8. Integration with Existing Tools

### 8.1 Integration with Smart-FS

```javascript
// search_code_smart returns [Src L:col] which can be used directly for Source Map
const searchResult = await search_code_smart({
  file_path: "source/bdms.js",
  query: "var t4 = o2\\[a2\\+\\+\\]"
});

// Extract position info
// Output: [L:3298] [Src L1:12345]
// Use Src coordinates for breakpoint
```

### 8.2 Integration with find_jsvmp_dispatcher

```javascript
// find_jsvmp_dispatcher returns info that directly fills vm field
const dispatcherInfo = await find_jsvmp_dispatcher({
  filePath: "source/bdms.js"
});

// Convert to Source Map vm field
const vmInfo = {
  dispatcher: {
    function: dispatcherInfo.dispatcherFunction,
    line: dispatcherInfo.debuggingEntryPoint.line,
    column: dispatcherInfo.debuggingEntryPoint.column
  },
  registers: {
    ip: { name: dispatcherInfo.instructionPointer },
    sp: { name: dispatcherInfo.stackPointer },
    stack: { name: dispatcherInfo.virtualStack },
    bytecode: { name: dispatcherInfo.bytecodeArray }
  }
};
```

## 9. Complete Example

### 9.1 Source Map File Example

```json
{
  "version": 1,
  "file": "bdms_disasm.asm",
  "sourceFile": "source/bdms.js",
  "sourceFileUrl": "https://lf-cdn.example.com/bdms.js",
  
  "vm": {
    "dispatcher": {
      "function": "d2",
      "line": 3298,
      "column": 12,
      "description": "Main interpreter function with do-while loop"
    },
    "registers": {
      "ip": { "name": "a2", "description": "Instruction Pointer, initialized to 0" },
      "sp": { "name": "p2", "description": "Stack Pointer, initialized to -1" },
      "stack": { "name": "v2", "description": "Virtual Stack, initialized to []" },
      "bytecode": { "name": "o2", "description": "Bytecode Array, assigned from t4[0]" },
      "scope": { "name": "s2", "description": "Scope Chain Array" },
      "constants": { "name": "Z", "description": "Constants Pool" }
    },
    "entryPoint": {
      "line": 3298,
      "column": 12,
      "description": "var t4 = o2[a2++]; - opcode fetch point"
    }
  },
  
  "functions": [
    {
      "id": 0,
      "name": "main",
      "bytecodeRange": [0, 1903],
      "irLineRange": [10, 2500],
      "params": 0,
      "strict": true
    }
  ],
  
  "mappings": [
    {
      "irLine": 10,
      "irAddr": 0,
      "opcode": 17,
      "opcodeName": "PUSH_CONST",
      "source": { "line": 3298, "column": 12 },
      "breakpoint": {
        "condition": "a2 === 0 && o2[a2] === 17",
        "logMessage": "PC:0 OP:17 PUSH_CONST Z[134]",
        "watchExpressions": [
          { "name": "$pc", "expr": "a2" },
          { "name": "$opcode", "expr": "o2[a2]" },
          { "name": "$stack[0]", "expr": "v2[p2]" },
          { "name": "$stack[1]", "expr": "v2[p2-1]" },
          { "name": "$sp", "expr": "p2" },
          { "name": "$const[134]", "expr": "Z[134]" }
        ]
      },
      "semantic": "Push Z[134]=\"1.0.1.19\""
    },
    {
      "irLine": 11,
      "irAddr": 2,
      "opcode": 23,
      "opcodeName": "SET_SCOPE",
      "source": { "line": 3298, "column": 12 },
      "breakpoint": {
        "condition": "a2 === 2 && o2[a2] === 23",
        "logMessage": "PC:2 OP:23 SET_SCOPE depth=0 Z[8]",
        "watchExpressions": [
          { "name": "$pc", "expr": "a2" },
          { "name": "$opcode", "expr": "o2[a2]" },
          { "name": "$stack[0]", "expr": "v2[p2]" },
          { "name": "$stack[1]", "expr": "v2[p2-1]" },
          { "name": "$sp", "expr": "p2" },
          { "name": "$scope[0]", "expr": "s2[0]" }
        ]
      },
      "semantic": "scope[0][Z[8]] = pop()"
    }
  ],
  
  "opcodeHandlers": {
    "17": {
      "name": "PUSH_CONST",
      "handlerLine": 3350,
      "handlerColumn": 8,
      "stackEffect": "+1",
      "operands": ["constIndex"]
    },
    "18": {
      "name": "JMP",
      "handlerLine": 3354,
      "handlerColumn": 8,
      "stackEffect": "0",
      "operands": ["offset"]
    }
  }
}
```

### 9.2 Corresponding IR File

```javascript
// JSVMP Disassembly - douyin.com bdms.js        // Line 1
// Source Map: bdms_disasm.asm.map               // Line 2
// Total Functions: 1                            // Line 3
// Total Constants: 256                          // Line 4
                                                 // Line 5
// ========================================       // Line 6
// Function 0 (main)                             // Line 7
// Params: 0, Strict: true                       // Line 8
// Bytecode: [0, 1903]                           // Line 9
// Source: L3298:12                              // Line 10
// ========================================       // Line 11
                                                 // Line 12
    0: PUSH_CONST       134          // ...      // Line 13 → irLine: 13
    2: SET_SCOPE          0   8      // ...      // Line 14 → irLine: 14
   14: JMP                8          // ...      // Line 15 → irLine: 15
```

**Matching**: `irLine` in Source Map IS the actual file line number. Direct O(1) lookup.

## 10. Implementation Checklist

- [ ] IR file uses `//` comments
- [ ] IR file function header has `Source: L{line}:{column}`
- [ ] **Source Map `irLine` = actual file line number** (no special markers needed)
- [ ] Source Map contains all instruction mappings
- [ ] **Source Map `breakpoint.watchExpressions` generated for each instruction**
- [ ] **CRITICAL**: Call `find_jsvmp_dispatcher` first to get actual variable names
- [ ] Source Map breakpoint.condition uses actual variable names from dispatcher result
- [ ] Condition combines IP + opcode: `{ip} === {pc} && {bytecode}[{ip}] === {opcode}`
- [ ] Build line index for O(1) lookup: `lineIndex[irLine] = mapping`
