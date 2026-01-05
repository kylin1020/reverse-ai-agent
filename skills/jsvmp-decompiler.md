# JSVMP Decompiler Skill (Babel/Node.js)

> **Core Principle**: JSVMP decompilation MUST use Babel AST stack. **Python is prohibited**.
> **IR Format**: v1.1 self-contained format, see `skills/jsvmp-ir-format.md`

> **🚨 Code Generation Warning (Phase 7) - Most Error-Prone Phase!**
> 
> | Issue | Symptom | Root Cause |
> |-------|---------|------------|
> | Missing else branch | `if` without `else` | Shared visited set |
> | Incomplete loop body | Empty `while` body | Only processing header block |
> | Flattened nesting | Nested if → sequential if | Wrong merge point |
> 
> **Required Reading**: `skills/jsvmp-codegen.md` - Complete control flow recovery algorithm
> 
> **Validation**: `wc -l output/*.vmhir output/*_decompiled.js` (JS lines should be 50%-150% of HIR)

---

## 1. Tech Stack

```bash
npm install @babel/parser @babel/generator @babel/types @babel/traverse chevrotain graphviz lodash
```

---

## 2. Decompilation Pipeline (7 Phases)

| Phase | Input | Output | Description | Key Algorithm |
|-------|-------|--------|-------------|---------------|
| 1. Parsing | JS source | AST | `@babel/parser` | |
| 2. Extraction | AST | Parameters | Extract bytecode/constants | AST traversal |
| 3. LIR Gen | bytecode | `.vmasm` + `.vmap` | opcode → three-address code | Disassembly |
| 4. MIR Gen | `.vmasm` | `.vmir` | Eliminate stack ops | Stack simulation, BB partition |
| 5. HIR Gen | `.vmir` | `.vmhir` | Loop/conditional detection | Dominator tree, Interval graph |
| 6. Dataflow | `.vmhir` | `*_opt.vmhir` | Variable optimization (optional) | DU/UD chains, SSA |
| 7. CodeGen | `.vmhir` | `*_decompiled.js` | **⚠️ Most error-prone** | Region-based generation |

### Key Algorithms

| Algorithm | Purpose | Phase |
|-----------|---------|-------|
| **Lengauer-Tarjan** | Dominator tree computation | 5 |
| **Allen-Cocke** | Interval graph, natural loop detection | 5 |
| **Derived Sequence** | CFG reducibility check | 5 |
| **Reaching Definition** | Definition analysis | 6 |
| **DU/UD Chain** | Definition-use chains | 6 |

---

## 3. IR Output Formats (v1.1)

### 3.1 LIR (`.vmasm`)

```vmasm
@format v1.1
@reg ip=pc, sp=sp, stack=stk, bc=code, const=K

@section constants
@const K[0] = String("init")

@section code
@entry 0x00000000

0x0000: LOAD_CLOSURE K[0]  ; [sp:1 | <closure>]
0x0003: SET_SCOPE 0 K[0]   ; [sp:0 |]
0x0008: RET                ; [sp:0 |]
```

### 3.2 MIR (`.vmir`)

```
0x0000: [sp:0→1] t0 = closure(K[0])
0x0003: [sp:1→0] scope[0]["init"] = t0
0x0008: [sp:0→0] return
```

### 3.3 HIR (`.vmhir`)

```
BB0: [0x0000-0x0008] (return)
  0x0000: t0 = closure(K[0])
  0x0003: scope[0]["init"] = t0
  0x0008: return
```

---

## 4. Core Data Structures

### BasicBlock

```javascript
class BasicBlock {
    constructor(instructions, start, type) {
        this.preds = [];           // Predecessors
        this.sucs = [];            // Successors
        this.instructions = [];
        this.start = start;
        this.type = type;          // "statement" | "condition" | "return" | "throw"
        this.true = undefined;     // True branch target
        this.false = undefined;    // False branch target
    }
}
```

### CFG Node

```javascript
class Node {
    constructor(lins, type, children, pos) {
        this.lins = lins;              // IR instructions
        this.type = type;
        this.children = children;
        this.num = undefined;          // RPO number
        this.startloop = false;        // Is loop header
        this.latch = undefined;        // Loop latch node
        this.loop_type = undefined;    // "pre_test" | "post_test" | "end_less"
        this.follow = {};              // Follow nodes {if: node, loop: node}
    }
}
// Derived: StatementNode, ConditionNode, LoopNode, ReturnNode, ThrowNode, IntervalNode
```

### Graph

```javascript
class Graph {
    constructor() {
        this.entry = null;
        this.exit = null;
        this.nodes = [];
        this.edges = {};           // {from: [to1, to2]}
        this.rpo = [];             // Reverse post-order
    }
    
    add_node(node) { }
    add_edge(from, to) { }
    compute_rpo() { }      // Compute reverse post-order
    compute_idom() { }     // Compute immediate dominators
}
```

---

## 5. Phase 1-2: AST Parsing & Parameter Extraction

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ast = parser.parse(fs.readFileSync("./target.js", "utf-8"));
let paramB, paramDValues;

traverse(ast, {
    ObjectExpression: {
        enter(path) {
            const props = path.node.properties;
            if (props.length !== 2 || props[0].key.value !== "b") return;
            paramB = props[0].value.value;      // Encoded bytecode
            paramDValues = props[1].value.elements.map(e => /* extract value */);
            path.stop();
        }
    }
});
```

---

## 6. Phase 3: Basic Block Partitioning

```javascript
function getBasicBlocks(steps, start = 0, end = -1) {
    let paths = [[start, end, undefined]];
    let blocks = [];
    const block_start_to_block = {};
    
    while (paths.length) {
        let [pos, end, prev] = paths.pop();
        // ... create blocks at branch/jump/return instructions
        // Terminating opcodes: return (9,30,56), throw (4)
        // Branch opcodes: unconditional (18), conditional (13,48)
    }
    return blocks;
}
```

---

## 7. Phase 4-5: CFG Construction & Control Flow Analysis

### Dominator Tree (Lengauer-Tarjan)

```javascript
compute_idom() {
    const idoms = {};
    idoms[this.entry] = this.entry;
    let changed = true;
    while (changed) {
        changed = false;
        for (const n of this.rpo) {
            let new_idom = /* common dominator of predecessors */;
            if (idoms[n] !== new_idom) { idoms[n] = new_idom; changed = true; }
        }
    }
    return idoms;
}
```

### Loop Detection

```javascript
function loop_type(start, end, nodes_in_loop) {
    // Determine: "pre_test" (while), "post_test" (do-while), "end_less" (for(;;))
}

function loop_follow(start, end, nodes_in_loop) {
    // Find loop exit node based on loop_type
}
```

### Conditional Structure

```javascript
function if_struct(graph) {
    const idoms = graph.compute_idom();
    // Find merge points for if-else structures using dominance
}
```

---

## 8. Phase 6: Dataflow Analysis

### Reaching Definition & DU/UD Chains

```javascript
function reaching_definition_analysis(graph) {
    // Iterative dataflow: R[n] = ∪ A[pred], A[n] = (R[n] - kill[n]) ∪ DB[n]
}

function build_def_use(graph) {
    const [defs, def_to_loc, R] = reaching_definition_analysis(graph);
    // Build UD chains from reaching definitions
    // Build DU chains by inverting UD chains
    return [UD, DU, vars, def_to_loc];
}
```

### SSA Variable Splitting

```javascript
function split_variables(graph, def_uses, use_defs, vars, def_to_loc) {
    // Rename variables with multiple definitions: var → var_0, var_1, ...
}
```

---

## 9. Phase 7: Code Generation (Writer)

```javascript
class Writer {
    constructor(graph, function_name) {
        this.graph = graph;
        this.visited_nodes = new Set();
        this.indent = 0;
        this.buffer = [];
        this.loop_follow = [null];
        this.if_follow = [null];
    }
    
    visit_node(node) {
        // Skip if: at follow point, or already visited (except return)
        const jmp_nodes = [this.if_follow.at(-1), this.loop_follow.at(-1)];
        if (jmp_nodes.includes(node)) return;
        if (node.type !== "return" && this.visited_nodes.has(node)) return;
        this.visited_nodes.add(node);
        node.visit(this);
    }
    
    visit_condition_node(node) {
        const follow = node.follow["if"];
        this.if_follow.push(follow);
        this.write(`if(...) {\n`);
        this.visit_node(node.true);
        if (!this.visited_nodes.has(node.false)) {
            this.write(`} else {\n`);
            this.visit_node(node.false);
        }
        this.if_follow.pop();
        this.write(`}\n`);
        if (follow) this.visit_node(follow);
    }
    
    visit_loop_node(node) {
        // Handle pre_test (while), post_test (do-while), end_less (for(;;))
    }
}
```

---

## 10. Complete Pipeline

```javascript
function decompile(bytes_codes, start, end) {
    const graph = graph_construct(bytes_codes, start, end);  // Build CFG
    split_if_nodes(graph);                                    // Split condition nodes
    const [use_defs, def_uses, vars, def_to_loc] = build_def_use(graph);
    split_variables(graph, def_uses, use_defs, vars, def_to_loc);  // SSA
    replace_stack_var(graph, def_uses, use_defs, vars);       // Eliminate stack vars
    register_propagation(graph, def_uses, use_defs, vars);    // Constant propagation
    graph.compute_rpo();
    identify_structures(graph);                               // Loop/if detection
    return graph;
}

function main(bytes_codes, function_name) {
    const graph = decompile(bytes_codes);
    const writer = new Writer(graph, function_name);
    fs.writeFileSync("output.js", writer.output());
}
```

---

## 11. IR Instruction Classes

```javascript
class IRForm { get_lhs() {} get_rhs() {} get_used_vars() {} is_propagable() {} visit(v) {} }
class Constant extends IRForm { constructor(value, type) {} is_constant() { return true; } }
class Register extends IRForm { constructor(name, declared) {} }
class AssignExpression extends IRForm { constructor(lhs, rhs) {} is_propagable() { return true; } }
class BinaryExpression extends IRForm { constructor(op, arg1, arg2) {} }
class MemberExpression extends IRForm { constructor(object, property) {} }
class CalleeExpression extends IRForm { constructor(func, args) {} }
class ReturnExpression extends IRForm { constructor(arg) {} }
class CondExpression extends IRForm { constructor(op, arg1, arg2) {} neg() {} }
```

---

## 12. Project Structure

```
artifacts/jsvmp/{target}/
├── source/                    # Original JS files
├── transforms/                # Babel transform scripts
├── lib/                       # Decompiler core
│   ├── graph.js, basic_blocks.js, opcode_ins.js
│   ├── control_flow.js, dataflow.js, writer.js
│   └── decompiler.js
├── raw/                       # Extracted data (bytecode.json, constants.json)
├── output/                    # Output (*_disasm.vmasm, *_mir.vmir, *_hir.vmhir, *_decompiled.js)
└── NOTE.md
```

---

## 13. Troubleshooting

| Issue | Solution |
|-------|----------|
| Different bytecode format | Analyze `decode()` function, adjust decoding logic |
| Different handler count | Modify `fnList` extraction condition |
| Unknown opcode | Add to `INSTRUCTION_SET`, implement handler |
| Stack imbalance | Check `replace_stack_var` logic |
| Wrong loop detection | Check `loop_type` and `loop_follow` |
| Variable name conflict | Check `split_variables` SSA conversion |
