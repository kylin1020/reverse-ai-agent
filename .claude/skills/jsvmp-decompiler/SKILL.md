# JSVMP Decompiler Skill (Babel/Node.js)

**Core Principle**: JSVMP decompilation MUST use Babel AST stack. **Python is prohibited**.
**IR Format**: v1.1 self-contained format, see `skills/jsvmp-ir-format.md`

**Code Generation Warning (Phase 7) - Most Error-Prone Phase!**

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| Missing else branch | `if` without `else` | Shared visited set |
| Incomplete loop body | Empty `while` body | Only processing header block |
| Flattened nesting | Nested if → sequential if | Wrong merge point |

**Required Reading**: `skills/jsvmp-codegen.md` - Complete control flow recovery algorithm

**Validation**: `wc -l output/*.vmhir output/*_decompiled.js` (JS lines should be 50%-150% of HIR)

## Tech Stack

```bash
npm install @babel/parser @babel/generator @babel/types @babel/traverse chevrotain graphviz lodash
```

## Decompilation Pipeline (7 Phases)

| Phase | Input | Output | Description | Key Algorithm |
|-------|-------|--------|-------------|---------------|
| 1. Parsing | JS source | AST | `@babel/parser` | |
| 2. Extraction | AST | Parameters | Extract bytecode/constants | AST traversal |
| 3. LIR Gen | bytecode | `.vmasm` + `.vmap` | opcode → three-address code | Disassembly |
| 4. MIR Gen | `.vmasm` | `.vmir` | Eliminate stack ops | Stack simulation, BB partition |
| 5. HIR Gen | `.vmir` | `.vmhir` | Loop/conditional detection | Dominator tree, Interval graph |
| 6. Dataflow | `.vmhir` | `*_opt.vmhir` | Variable optimization (optional) | DU/UD chains, SSA |
| 7. CodeGen | `.vmhir` | `*_decompiled.js` | **Most error-prone** | Region-based generation |

### Key Algorithms

| Algorithm | Purpose | Phase |
|-----------|---------|-------|
| **Lengauer-Tarjan** | Dominator tree computation | 5 |
| **Allen-Cocke** | Interval graph, natural loop detection | 5 |
| **Derived Sequence** | CFG reducibility check | 5 |
| **Reaching Definition** | Definition analysis | 6 |
| **DU/UD Chain** | Definition-use chains | 6 |

## IR Output Formats (v1.1)

### LIR (`.vmasm`)

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

### MIR (`.vmir`)

```
0x0000: [sp:0→1] t0 = closure(K[0])
0x0003: [sp:1→0] scope[0]["init"] = t0
0x0008: [sp:0→0] return
```

### HIR (`.vmhir`)

```
BB0: [0x0000-0x0008] (return)
  0x0000: t0 = closure(K[0])
  0x0003: scope[0]["init"] = t0
  0x0008: return
```

## Core Data Structures

### BasicBlock

```javascript
class BasicBlock {
    preds = [];           // Predecessors
    sucs = [];            // Successors
    instructions = [];
    start = start;
    type = type;          // "statement" | "condition" | "return" | "throw"
    true = undefined;     // True branch target
    false = undefined;    // False branch target
}
```

### CFG Node

```javascript
class Node {
    lins = lins;              // IR instructions
    type = type;
    children = children;
    num = undefined;          // RPO number
    startloop = false;        // Is loop header
    latch = undefined;        // Loop latch node
    loop_type = undefined;    // "pre_test" | "post_test" | "end_less"
    follow = {};              // Follow nodes {if: node, loop: node}
}
// Derived: StatementNode, ConditionNode, LoopNode, ReturnNode, ThrowNode, IntervalNode
```

### Graph

```javascript
class Graph {
    entry = null;
    exit = null;
    nodes = [];
    edges = {};           // {from: [to1, to2]}
    rpo = [];             // Reverse post-order

    add_node(node) { }
    add_edge(from, to) { }
    compute_rpo() { }      // Compute reverse post-order
    compute_idom() { }     // Compute immediate dominators
}
```

## Phase 1-2: AST Parsing & Parameter Extraction

Pattern: Use `@babel/parser` and `@babel/traverse` to extract bytecode and constants from AST

## Phase 3: Basic Block Partitioning

Pattern: Create blocks at branch/jump/return instructions
- Terminating opcodes: return (9,30,56), throw (4)
- Branch opcodes: unconditional (18), conditional (13,48)

## Phase 4-5: CFG Construction & Control Flow Analysis

### Dominator Tree (Lengauer-Tarjan)

Pattern: Iterative algorithm to compute immediate dominators

### Loop Detection

Pattern: Determine loop type: "pre_test" (while), "post_test" (do-while), "end_less" (for(;;))

### Conditional Structure

Pattern: Find merge points for if-else structures using dominance

## Phase 6: Dataflow Analysis

### Reaching Definition & DU/UD Chains

Pattern: Iterative dataflow: R[n] = ∪ A[pred], A[n] = (R[n] - kill[n]) ∪ DB[n]

### SSA Variable Splitting

Pattern: Rename variables with multiple definitions: var → var_0, var_1, ...

## Phase 7: Code Generation (Writer)

Pattern: Visit nodes in order, track follow points for if/loop, skip already visited nodes

## Complete Pipeline

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

## IR Instruction Classes

Pattern: IRForm base class with get_lhs(), get_rhs(), get_used_vars(), is_propagable(), visit()
- Constant, Register, AssignExpression, BinaryExpression, MemberExpression
- CalleeExpression, ReturnExpression, CondExpression

## Project Structure

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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Different bytecode format | Analyze `decode()` function, adjust decoding logic |
| Different handler count | Modify `fnList` extraction condition |
| Unknown opcode | Add to `INSTRUCTION_SET`, implement handler |
| Stack imbalance | Check `replace_stack_var` logic |
| Wrong loop detection | Check `loop_type` and `loop_follow` |
| Variable name conflict | Check `split_variables` SSA conversion |
