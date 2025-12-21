# Role: JSVMP Decompiler Specialist

> **Mission**: Statically decompile JSVMP bytecode to readable JavaScript via progressive IR lifting.
> **Approach**: Raw Bytecode → Low-Level IR → Mid-Level IR → High-Level IR → JavaScript AST
> **Output**: Decompiled `.js` file with reconstructed control flow.

---

## ⚠️ Large File Warning

> Decompiled JS files are 100KB-500KB+. **NEVER read entire files!**
> Use `grepSearch` first, then `readFile` with line range (50-100 lines max).

---

## Progressive Decompilation Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 0 | Obfuscated JS | bytecode, constants | Extract VM data |
| 1 | Raw bytecode | `_disasm.asm` | Disassembly with explicit stack ops |
| 2 | Low-Level IR | `_mir.txt` | Eliminate stack, build expression trees |
| 3 | Mid-Level IR | `_hir.txt` | CFG + data-flow + structure recovery |
| 4 | High-Level IR | `_decompiled.js` | Emit readable JavaScript |

---

## Phase 0: Extract VM Data

### Identify Core Components via AST

```javascript
let paramB = null;      // Encoded bytecode (Base64 string)
let paramD = null;      // Constants array
let fnList = null;      // Handler function array

traverse(ast, {
    ObjectExpression(path) {
        const props = path.node.properties;
        if (props.length === 2 && props[0].key.value === "b") {
            paramB = props[0].value.value;  // Base64 bytecode
            paramD = props[1].value.elements;  // Constants
            path.stop();
        }
    },
    ArrayExpression(path) {
        // Handler array: typically 50-100 FunctionExpressions
        if (path.node.elements.length > 50 && 
            path.node.elements.every(e => t.isFunctionExpression(e) || t.isNullLiteral(e))) {
            fnList = path.node.elements;
            path.stop();
        }
    }
});
```

### Decode Bytecode

```javascript
// Typical: Base64 → UTF-8 → 5-byte instruction groups
const decoded = decode(paramB);  // Custom decoder per target
const bytecode = decoded.split('').reduce((acc, char) => {
    if (!acc.length || acc[acc.length - 1].length === 5) acc.push([]);
    acc[acc.length - 1].push(char.charCodeAt(0) - 1);
    return acc;
}, []);
// Result: [[opcode, p0, p1, p2, p3], ...]
```

---

## Phase 1: Disassembly → Low-Level IR

Convert raw bytecode to assembly-like format with explicit stack operations.

### Output Format
```
0000: PUSH_CONST    #0          ; "window"
0001: GET_GLOBAL                ; stack: [window]
0002: PUSH_CONST    #1          ; "document"
0003: GET_PROP                  ; stack: [window.document]
0004: JZ            @0015       ; if falsy, jump
```

### Disassembler
```javascript
class Disassembler {
    disassemble() {
        for (let pc = 0; pc < this.bytecode.length; pc++) {
            const [op, p0, p1, p2, p3] = this.bytecode[pc];
            const handler = OPCODE_TABLE[op];
            this.output.push({
                pc,
                opcode: handler.mnemonic,
                operands: handler.getOperands(p0, p1, p2, p3, this.constants),
                stackEffect: handler.stackEffect
            });
        }
        return this.output;
    }
}
```

### Opcode Table
```javascript
const OPCODE_TABLE = {
    0:  { mnemonic: 'CALL', stackEffect: (p0) => [-(p0+1), 1] },
    9:  { mnemonic: 'RET_UNDEF', isTerminator: true },
    17: { mnemonic: 'PUSH_CONST', stackEffect: [0, 1] },
    18: { mnemonic: 'JMP', isTerminator: true, isBranch: true },
    30: { mnemonic: 'RET', stackEffect: [-1, 0], isTerminator: true },
    48: { mnemonic: 'JZ', isConditional: true, isTerminator: true },
    // ... define all opcodes
};
```

---

## Phase 2: Stack Analysis → Mid-Level IR

Eliminate stack operations, build expression trees using symbolic execution.

### Output Format
```
[0000-0003] t0 = window.document
[0004-0007] t1 = t0.getElementById("myId")
[0008]      if (!t1) goto @0015
```

### Stack Simulator
```javascript
class StackSimulator {
    processInstruction(ins, stack) {
        switch (ins.opcode) {
            case 'PUSH_CONST':
                stack.push(new Constant(ins.operands.value));
                return null;
            case 'GET_PROP': {
                const prop = stack.pop(), obj = stack.pop();
                const temp = this.newTemp();
                stack.push(new TempVar(temp));
                return new MIRAssign(ins.pc, temp, new MemberExpr(obj, prop));
            }
            case 'CALL': {
                const args = [], argc = ins.operands.argc;
                for (let i = 0; i < argc; i++) args.unshift(stack.pop());
                const callee = stack.pop(), temp = this.newTemp();
                stack.push(new TempVar(temp));
                return new MIRAssign(ins.pc, temp, new CallExpr(callee, args));
            }
            case 'JZ':
                return new MIRCondJump(ins.pc, stack.pop(), ins.operands.target);
            case 'RET':
                return new MIRReturn(ins.pc, stack.pop());
        }
    }
}
```

### MIR Nodes
```javascript
class MIRAssign { constructor(pc, lhs, rhs) { ... } }
class MIRCondJump { constructor(pc, cond, target) { ... } }
class MIRJump { constructor(pc, target) { ... } }
class MIRReturn { constructor(pc, value) { ... } }

// Expression nodes
class Constant, TempVar, LocalVar, MemberExpr, CallExpr, BinaryExpr, UnaryExpr
```

---

## Phase 3: CFG + Data-Flow → High-Level IR

Build CFG from MIR, apply data-flow analysis, recover structured control flow.

### Output Format
```
func_0():
    t0 = window.document
    if (t0) {
        return "found"
    } else {
        return "not found"
    }
```

### CFG Construction
```javascript
class CFGBuilder {
    build() {
        this.findLeaders();      // Jump targets + fall-throughs
        this.createBlocks();     // Group instructions into basic blocks
        this.connectBlocks();    // Add edges based on terminators
        return this.blocks;
    }
}
```

### Data-Flow Analysis
```javascript
// Reaching definitions (fixed-point iteration)
// IN[B] = ∪ OUT[P] for all predecessors
// OUT[B] = GEN[B] ∪ (IN[B] - KILL[B])

// Value propagation: inline single-use temps
```

### Structure Recovery
```javascript
class StructureRecovery {
    findLoops() {
        // Back edge detection: succ dominates pred
        // Classify: while (pre-test), do-while (post-test), infinite
    }
    
    findConditionals() {
        // Find follow node where branches converge
    }
}
```

---

## Phase 4: Code Generation → JavaScript AST

Convert structured HIR to Babel AST.

```javascript
class CodeGenerator {
    visitBlock(block, body) {
        if (this.loops.has(block.id)) {
            this.emitLoop(...);
        } else if (this.conditionals.has(block.id)) {
            this.emitConditional(...);
        } else {
            for (const ins of block.instructions) {
                body.push(this.insToAST(ins));
            }
        }
    }
    
    emitLoop(loop, body) {
        // while/do-while based on loop.type
    }
    
    emitConditional(cond, body) {
        // if/else with then/else branches
    }
}
```

---

## Example: Pipeline Walkthrough

**Input**: `[[17,0,5,0,0], [17,0,1,0,0], [23,0,0,0,0], [48,0,3,0,0], ...]`

| Phase | Output |
|-------|--------|
| 1 (LIR) | `0000: PUSH_CONST #0` / `0003: JZ @6` |
| 2 (MIR) | `t0 = window.document` / `if (!t0) goto @6` |
| 3 (HIR) | `if (t0) { return "found" } else { return "not found" }` |
| 4 (JS) | `function decompiled() { let t0 = window.document; if (t0) ... }` |

---

## Troubleshooting

| Issue | Phase | Solution |
|-------|-------|----------|
| Unknown opcode | 1 | Add to OPCODE_TABLE, trace with breakpoint |
| Stack imbalance | 2 | Check stackEffect definitions |
| Wrong CFG edges | 3 | Verify jump target resolution |
| Missing variables | 3 | Check def-use chain construction |
| Nested functions | 1-4 | Recursively process with bytecode slice |

---

## Browser Dynamic Analysis (Chrome DevTools MCP)

When static analysis hits obstacles, use browser debugging to understand VM behavior.

### Available Tools

| Tool | Purpose |
|------|---------|
| `navigate_page` | Navigate to target page |
| `set_breakpoint` | Set breakpoint at line |
| `get_debugger_status` | View call stack and variables |
| `step_over/step_into/step_out` | Single-step debugging |
| `evaluate_script` | Execute JS in page context |
| `search_script_content` | Search loaded scripts |
| `save_static_resource` | Save script to local file |

### Workflow

1. **Locate VM Entry**: `search_script_content` for "while"/"switch" → `set_breakpoint` at dispatcher
2. **Trace Opcodes**: Inject logging via `evaluate_script` at `bytecode[pc]`
3. **Extract Data**: `get_scope_variables` → `save_scope_variables` to JSON
4. **Differential Analysis**: Compare traces with different inputs to find divergence

### Breakpoint Strategy

| Scenario | Location |
|----------|----------|
| Find VM entry | `handlers[` or `switch` |
| Trace opcodes | `pc++` or `bytecode[pc]` |
| Capture result | `return` or before network request |

### Notes
- Some VMs detect DevTools - may need anti-debug bypass
- Use `get_scope_variables` for obfuscated variable names
