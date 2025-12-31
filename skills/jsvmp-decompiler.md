# JSVMP Decompiler Skill (Babel/Node.js)

> **核心原则**: JSVMP 反编译必须使用 Babel AST 技术栈，**禁止使用 Python**。
> **IR 格式**: v1.1 自包含格式，参见 `#[[file:skills/jsvmp-ir-format.md]]`

> **🚨 代码生成警告 (Phase 7) - 最易出错的阶段！**
> 
> | 问题 | 症状 | 根因 |
> |------|------|------|
> | else 分支丢失 | `if` 没有 `else` | 共享 visited 集合 |
> | 循环体不完整 | `while` 体为空 | 只处理 header 块 |
> | 嵌套结构扁平化 | 嵌套 if 变顺序 if | merge point 错误 |
> 
> **必读**: `#[[file:skills/jsvmp-codegen.md]]` - 完整的控制流恢复算法
> 
> **验证命令**:
> ```bash
> wc -l output/*.vmhir output/*_decompiled.js  # JS 行数应为 HIR 的 50%-150%
> ```

---

## 1. 技术栈要求

```bash
npm install @babel/parser @babel/generator @babel/types @babel/traverse chevrotain graphviz lodash
```

---

## 2. 反编译流程 (7 阶段)

| 阶段 | 输入 | 输出 | 描述 | 关键算法 |
|------|------|------|------|----------|
| 1. 句法分析 | JS 源码 | AST | `@babel/parser` | |
| 2. 语义分析 | AST | 参数提取 | 提取 bytecode/constants | AST 遍历 |
| 3. LIR 生成 | bytecode | `.vmasm` + `.vmap` | opcode → 三地址码 | 反汇编 |
| 4. MIR 生成 | `.vmasm` | `.vmir` | 消除栈操作 | 栈模拟、基本块划分 |
| 5. HIR 生成 | `.vmir` | `.vmhir` | 循环/条件识别 | 支配树、区间图 |
| 6. 数据流分析 | `.vmhir` | `*_opt.vmhir` | 变量优化 (可选) | DU/UD 链、SSA |
| 7. 代码生成 | `.vmhir` | `*_decompiled.js` | **⚠️ 最易出错** | 区域化生成 |

### 关键算法速查

| 算法 | 用途 | 阶段 |
|------|------|------|
| **Lengauer-Tarjan** | 支配树计算 | 5 |
| **Allen-Cocke** | 区间图构建，识别自然循环 | 5 |
| **Derived Sequence** | 导出序列，判断 CFG 可规约性 | 5 |
| **Reaching Definition** | 到达定义分析 | 6 |
| **DU/UD Chain** | 定义-使用链 | 6 |

---

## 3. IR 输出格式 (v1.1)

### 3.1 LIR 输出 (`.vmasm`)

```vmasm
;; JSVMP Disassembly - example.com main.js
@format v1.1
@domain example.com
@reg ip=pc, sp=sp, stack=stk, bc=code, storage=mem, const=K

@section constants
@const K[0] = String("init")
@const K[1] = String("window")
@const K[2] = Number(0)
@const K[3] = Boolean(true)
@const K[4] = Null

@section code
@entry 0x00000000

;; Function 0: Params=0, Strict=true, Bytecode=[0x0000, 0x0028]
0x0000: LOAD_CLOSURE K[0]  ; Create closure      [sp:1 | <closure>]
0x0003: SET_SCOPE 0 K[0]   ; scope[0]["init"]=   [sp:0 |]
0x0008: GET_GLOBAL K[1]    ; window              [sp:1 | <Global>]
0x000D: PUSH_CONST K[2]    ; 0                   [sp:2 | <Global>, 0]
0x0012: JMPIFNOT 0x0020    ; if (!top) goto      [sp:1 | <Global>]
0x0017: PUSH_CONST K[3]    ; true                [sp:2 | <Global>, true]
0x001C: JMP 0x0025         ; goto                [sp:2 | <Global>, true]
0x0020: PUSH_CONST K[4]    ; null                [sp:2 | <Global>, null]
0x0025: RET                ; return              [sp:0 |]
```

### 3.2 MIR 输出 (`.vmir`)

```
;; Function 0
0x0000: [sp:0→1] t0 = closure(K[0])
0x0003: [sp:1→0] scope[0]["init"] = t0
0x0008: [sp:0→1] t1 = global["window"]
0x000D: [sp:1→2] t2 = 0
0x0012: [sp:2→1] if (!t2) goto 0x0020
0x0017: [sp:1→2] t3 = true
0x001C: [sp:2→2] goto 0x0025
0x0020: [sp:1→2] t3 = null
0x0025: [sp:2→0] return t3
```

### 3.3 HIR 输出 (`.vmhir`)

```
;; Function 0: Params=0, Strict=true
;; Entry: BB0, Blocks: 4
;; Loops: 0, Conditionals: 1

BB0: [0x0000-0x0012] (condition)
  0x0000: t0 = closure(K[0])
  0x0003: scope[0]["init"] = t0
  0x0008: t1 = global["window"]
  0x000D: t2 = 0
  -> if (!t2) goto BB2 else goto BB1

BB1: [0x0017-0x001C]
  0x0017: t3 = true
  -> goto BB3

BB2: [0x0020-0x0020]
  0x0020: t3 = null
  -> BB3

BB3: [0x0025-0x0025] (return)
  0x0025: return t3
```

---

## 4. 核心数据结构

### 4.1 基本块 (BasicBlock)

```javascript
class BasicBlock {
    constructor(instructions, start, type) {
        this.preds = [];           // 前驱块
        this.sucs = [];            // 后继块
        this.instructions = [];    // 指令列表
        this.start = start;        // 起始地址
        this.type = type;          // "statement" | "condition" | "return" | "throw"
        this.true = undefined;     // 条件为真的跳转目标
        this.false = undefined;    // 条件为假的跳转目标
    }
}
```

### 4.2 CFG 节点 (Node)

```javascript
class Node {
    constructor(lins, type, children, pos) {
        this.lins = lins;              // IR 指令列表
        this.type = type;              // 节点类型
        this.children = children;      // 子节点
        this.num = undefined;          // RPO 编号
        this.startloop = false;        // 是否循环头
        this.latch = undefined;        // 循环尾节点
        this.loop_type = undefined;    // "pre_test" | "post_test" | "end_less"
        this.loop_nodes = [];          // 循环内节点
        this.follow = {};              // 后继节点 {if: node, loop: node}
    }
}

// 派生类: StatementNode, ConditionNode, LoopNode, ReturnNode, ThrowNode, IntervalNode
```

### 4.3 控制流图 (Graph)

```javascript
class Graph {
    constructor() {
        this.entry = null;
        this.exit = null;
        this.nodes = [];
        this.edges = {};           // {from: [to1, to2]}
        this.reverse_edges = {};
        this.rpo = [];             // 逆后序
    }
    
    // 核心方法
    add_node(node) { }
    add_edge(from, to) { }
    post_order() { }       // 后序遍历
    compute_rpo() { }      // 计算逆后序
    compute_idom() { }     // 计算直接支配点
}
```

---

## 5. 阶段 1-2: AST 解析与参数提取

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const types = require("@babel/types");
const fs = require("fs");

const code = fs.readFileSync("./target.js", "utf-8");
const ast = parser.parse(code);

let paramB, paramD, paramDValues;

// 提取 VM 参数 (通常是 {b: "...", d: [...]} 结构)
traverse(ast, {
    ObjectExpression: {
        enter(path) {
            const props = path.node.properties;
            if (props.length !== 2 || props[0].key.value !== "b") return;
            
            paramB = props[0].value.value;      // 编码字节码
            paramD = props[1].value.elements;   // 常量数组
            
            paramDValues = paramD.map(e => {
                if (types.isStringLiteral(e)) return e.value;
                if (types.isNumericLiteral(e)) return e.value;
                if (types.isNullLiteral(e)) return null;
                if (types.isBooleanLiteral(e)) return e.value;
            });
            path.stop();
        }
    }
});

// 字节码解码 (具体实现取决于目标 VM 的编码方式)
// 常见: Base64 + UTF-8, 每条指令 N 字节
```

---

## 5. 阶段 3: 基本块划分

### 5.1 识别基本块边界

```javascript
function getBasicBlocks(steps, start = 0, end = -1) {
    let paths = [[start, end, undefined]];
    let blocks = [];
    const block_start_to_block = {};
    
    while (paths.length) {
        let [pos, end, prev] = paths.pop();
        if (end === -1) end = steps.length - 1;
        
        // 已存在的块，添加前驱
        if (prev && block_start_to_block[pos]) {
            if (!block_start_to_block[pos].preds.includes(prev.start)) {
                block_start_to_block[pos].preds.push(prev.start);
            }
            continue;
        }
        
        const block = new BasicBlock([], pos, "statement");
        block_start_to_block[block.start] = block;
        if (prev) block.preds.push(prev.start);
        
        while (pos <= end) {
            const [opcode, p0, p1, p2, p3] = steps[pos];
            block.instructions.push([opcode, p0, p1, p2, p3, pos]);
            
            // 终止指令
            if ([9, 30, 56].includes(opcode)) {  // return 类
                block.type = "return";
                block.instruction_range = [block.start, pos];
                break;
            }
            else if (opcode === 4) {  // throw
                block.type = "throw";
                block.instruction_range = [block.start, pos];
                break;
            }
            else if (opcode === 18) {  // 无条件跳转
                const next = getArgByTypeAndIndex(p0, p1);
                block.sucs = [next];
                block.instruction_range = [block.start, pos];
                paths.push([next, end, block]);
                break;
            }
            else if (opcode === 13 || opcode === 48) {  // 条件跳转
                const next1 = getArgByTypeAndIndex(p0, p1);
                const next2 = pos + 1;
                block.sucs = [next1, next2];
                block.type = "condition";
                block.instruction_range = [block.start, pos];
                block.true = next1;
                block.false = next2;
                paths.push([next1, end, block]);
                paths.push([next2, end, block]);
                break;
            }
            else {
                pos++;
            }
        }
        blocks.push(block);
        block.instruction_range = [block.start, pos];
    }
    
    // 转换索引为块引用
    for (const block of blocks) {
        block.preds = block.preds.map(e => block_start_to_block[e]);
        block.sucs = block.sucs.map(e => block_start_to_block[e]);
        block.true = block.true && block_start_to_block[block.true];
        block.false = block.false && block_start_to_block[block.false];
    }
    return blocks;
}
```

### 5.2 BFS 遍历

```javascript
function bfs(blocks) {
    if (blocks.length === 0) return [];
    const to_visit = [blocks[0]];
    const visited = new Set([blocks[0].start]);
    const result = [];
    
    while (to_visit.length) {
        const block = to_visit.shift();
        result.push(block);
        for (const nextBlock of block.sucs) {
            if (nextBlock && !visited.has(nextBlock.start)) {
                to_visit.push(nextBlock);
                visited.add(nextBlock.start);
            }
        }
    }
    return result;
}
```

---

## 6. 阶段 4: 控制流图构建

### 6.1 构建 CFG

```javascript
function graph_construct(bytes_codes, start = 0, end = -1) {
    const blocks = getBasicBlocks(bytes_codes, start, end);
    const bfs_blocks = bfs(blocks);
    const graph = new Graph();
    const block_to_node = {};
    
    for (const block of bfs_blocks) {
        const node = make_node(graph, block, block_to_node);
        graph.add_node(node);
    }
    
    graph.set_entry(block_to_node[start]);
    graph.set_bytes_code(bytes_codes);
    graph.compute_rpo();
    graph.number_ins();
    
    // 设置出口节点
    const exit_nodes = graph.nodes.filter(e => e.type === "return");
    if (exit_nodes.length === 1) {
        graph.set_exit(exit_nodes[0]);
    } else if (exit_nodes.length > 1) {
        graph.set_exit(graph.rpo[graph.rpo.length - 1]);
    }
    return graph;
}
```

### 6.2 逆后序计算 (RPO)

```javascript
// Graph 类方法
post_order() {
    const visited = new Set();
    const result = [];
    const this_ = this;
    
    function visit(node) {
        visited.add(node);
        for (const suc of this_.all_sucs(node)) {
            if (!visited.has(suc)) visit(suc);
        }
        result.push(node);
    }
    visit(this.entry);
    return result;
}

compute_rpo() {
    const nodes = this.post_order();
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].set_num(nodes.length - i);
    }
    this.rpo = nodes.reverse();
}
```

### 6.3 支配树计算 (Lengauer-Tarjan)

```javascript
// 公共支配点
common_dominator(imediate_dominator, cur, pred) {
    while (cur.num !== pred.num) {
        while (cur.num > pred.num) cur = imediate_dominator[cur];
        while (pred.num > cur.num) pred = imediate_dominator[pred];
    }
    return cur;
}

// 计算直接支配点
compute_idom() {
    const idoms = {};
    for (const node of this.nodes) idoms[node] = null;
    idoms[this.entry] = this.entry;
    
    let changed = true;
    while (changed) {
        changed = false;
        for (const n of this.rpo) {
            let preds = this.all_preds(n).filter(pred => idoms[pred] !== null);
            let new_idom = preds.length > 0 ? preds[0] : n;
            
            for (let i = 1; i < preds.length; i++) {
                if (idoms[preds[i]] !== null) {
                    new_idom = this.common_dominator(idoms, new_idom, preds[i]);
                }
            }
            if (idoms[n] !== new_idom) {
                idoms[n] = new_idom;
                changed = true;
            }
        }
    }
    return idoms;
}
```

---

## 7. 阶段 5: 控制流分析

### 7.1 区间图计算

```javascript
function intervals(graph) {
    const interval_graph = new Graph();
    const heads = [graph.entry];
    const interv_heads = {};
    const processed = new Set();
    const edges = {};
    const interval_map = {};
    
    while (heads.length > 0) {
        const head = heads.pop();
        if (processed.has(head)) continue;
        processed.add(head);
        
        const interval = new IntervalNode(head);
        interv_heads[head] = interval;
        interval_map[interval] = interval;
        
        // 扩展区间
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 1; i < graph.rpo.length; i++) {
                const node = graph.rpo[i];
                if (graph.all_preds(node).every(p => interval.has(p))) {
                    changed = changed || interval.add_node(node);
                }
            }
        }
        
        // 发现新的区间头
        for (const node of graph.nodes) {
            if (!interval.has(node) && !heads.includes(node)) {
                for (const pred of graph.all_preds(node)) {
                    if (interval.has(pred)) {
                        if (!edges[interval]) edges[interval] = [];
                        edges[interval].push(node);
                        heads.push(node);
                        break;
                    }
                }
            }
        }
        interval_graph.add_node(interval);
        interval.compute_end(graph);
    }
    
    // 添加区间间的边
    for (const interval_key of Object.keys(edges)) {
        for (const head of edges[interval_key]) {
            interval_graph.add_edge(interval_map[interval_key], interv_heads[head]);
        }
    }
    
    interval_graph.entry = graph.entry.interval;
    if (graph.exit) interval_graph.exit = graph.exit.interval;
    interval_graph.compute_rpo();
    return [interval_graph, interv_heads];
}
```

### 7.2 导出序列 (Derived Sequence)

```javascript
function derived_sequence(graph) {
    const deriv_seq = [graph];
    const deriv_interv = [];
    let single_node = false;
    
    while (!single_node) {
        const [interval_graph, interval_heads] = intervals(graph);
        deriv_interv.push(interval_heads);
        single_node = interval_graph.nodes.length === 1;
        if (!single_node) deriv_seq.push(interval_graph);
        graph = interval_graph;
        graph.compute_rpo();
    }
    return [deriv_seq, deriv_interv];
}
```

### 7.3 循环识别

```javascript
// 循环类型
function loop_type(start, end, nodes_in_loop) {
    if (end.is_cond()) {
        if (start.is_cond()) {
            if (nodes_in_loop.includes(start.true) && nodes_in_loop.includes(start.false)) {
                start.loop_type = "post_test";  // do-while
            } else {
                start.loop_type = "pre_test";   // while
            }
        } else {
            start.loop_type = "post_test";
        }
    } else {
        if (start.is_cond()) {
            if (nodes_in_loop.includes(start.true) && nodes_in_loop.includes(start.false)) {
                start.loop_type = "end_less";   // for(;;)
            } else {
                start.loop_type = "pre_test";
            }
        } else {
            start.loop_type = "end_less";
        }
    }
}

// 循环后继
function loop_follow(start, end, nodes_in_loop) {
    let follow = null;
    if (start.loop_type === "pre_test") {
        follow = nodes_in_loop.includes(start.true) ? start.false : start.true;
    } else if (start.loop_type === "post_test") {
        follow = nodes_in_loop.includes(end.true) ? end.false : end.true;
    } else {
        // end_less: 找最小编号的出口
        let num_next = Infinity;
        for (const node of nodes_in_loop) {
            if (node.is_cond()) {
                if (node.true.num < num_next && !nodes_in_loop.includes(node.true)) {
                    follow = node.true;
                    num_next = follow.num;
                } else if (node.false.num < num_next && !nodes_in_loop.includes(node.false)) {
                    follow = node.false;
                    num_next = follow.num;
                }
            }
        }
    }
    start.follow["loop"] = follow;
    for (const node of nodes_in_loop) node.follow["loop"] = follow;
}
```

### 7.4 条件结构识别

```javascript
function if_struct(graph) {
    const idoms = graph.compute_idom();
    const unresolved = new Set();
    
    for (const node of graph.post_order()) {
        if (node.is_cond()) {
            // 找被当前节点支配且有多个前驱的节点
            let ldominates = [];
            for (const n of Object.keys(idoms)) {
                const idom = idoms[n];
                if (idom === node && graph.reverse_edges[n]?.length > 1) {
                    ldominates.push(n);
                }
            }
            
            if (ldominates.length > 0) {
                ldominates.sort((a, b) => a.num - b.num);
                const n = ldominates[ldominates.length - 1];
                node.follow["if"] = n;
                
                // 解决未决节点
                for (const x of [...unresolved]) {
                    if (node.num < x.num && x.num < n.num) {
                        x.follow["if"] = n;
                        unresolved.delete(x);
                    }
                }
            } else {
                unresolved.add(node);
            }
        }
    }
    return unresolved;
}
```

---

## 8. 阶段 6: 数据流分析

### 8.1 到达定义分析 (Reaching Definition)

```javascript
function reaching_definition_analysis(graph) {
    // 添加虚拟入口/出口
    const old_entry = graph.entry;
    const new_entry = new StatementNode([], "statement", [old_entry], -1, [-1, -1]);
    graph.add_node(new_entry);
    graph.add_edge(new_entry, old_entry);
    graph.entry = new_entry;
    
    const A = {}, R = {}, DB = {}, defs = {}, def_to_loc = {};
    
    // 初始化
    for (const node of graph.rpo) {
        A[node] = new Set();
        R[node] = new Set();
        DB[node] = new Set();
        defs[node] = {};
        
        const loc_with_ins = node.get_loc_with_ins() || [];
        for (let i of Object.keys(loc_with_ins)) {
            i = parseInt(i);
            const ins = loc_with_ins[i];
            const kill = ins.get_lhs();
            if (kill) {
                if (!defs[node][kill]) defs[node][kill] = new Set();
                defs[node][kill].add(i);
                if (!def_to_loc[kill]) def_to_loc[kill] = new Set();
                def_to_loc[kill].add(i);
            }
        }
        for (const values of Object.values(defs[node])) {
            DB[node].add(Math.max(...values));
        }
    }
    
    // 迭代求解
    const nodes = [...graph.rpo];
    while (nodes.length > 0) {
        const node = nodes.shift();
        
        // R[n] = ∪ A[pred] for all pred
        const newR = new Set();
        for (const pred of graph.all_preds(node)) {
            if (A[pred]) for (const v of A[pred]) newR.add(v);
        }
        
        if (!lodash.isEqual(newR, R[node])) {
            R[node] = newR;
            for (const succ of graph.all_sucs(node)) {
                if (!nodes.includes(succ)) nodes.push(succ);
            }
        }
        
        // A[n] = (R[n] - kill[n]) ∪ DB[n]
        const kill_locs = new Set();
        for (const reg of Object.keys(defs[node])) {
            for (const loc of def_to_loc[reg]) kill_locs.add(loc);
        }
        
        const curA = new Set();
        for (const loc of R[node]) {
            if (!kill_locs.has(loc)) curA.add(loc);
        }
        
        const newA = new Set([...curA, ...DB[node]]);
        if (!lodash.isEqual(newA, A[node])) {
            A[node] = newA;
            for (const succ of graph.all_sucs(node)) {
                if (!nodes.includes(succ)) nodes.push(succ);
            }
        }
    }
    
    // 恢复原图
    graph.remove_node(new_entry);
    graph.set_entry(old_entry);
    
    return [defs, def_to_loc, R];
}
```

### 8.2 构建 DU/UD 链

```javascript
function build_def_use(graph) {
    const [defs, def_to_loc, R] = reaching_definition_analysis(graph);
    const UD = {}, vars = {};
    
    for (const node of graph.rpo) {
        const loc_with_ins = node.get_loc_with_ins();
        for (let i of Object.keys(loc_with_ins)) {
            const ins = loc_with_ins[i];
            i = parseInt(i);
            
            for (const variable of ins.get_used_vars()) {
                if (!def_to_loc[variable]) continue;
                vars[variable] = variable;
                
                const ldefs = defs[node];
                let prior_def = -1;
                for (const v of (ldefs[variable] || [])) {
                    if (prior_def < v && v < i) prior_def = v;
                }
                
                if (!UD[variable]) UD[variable] = {};
                if (!UD[variable][i]) UD[variable][i] = [];
                
                if (prior_def >= 0) {
                    UD[variable][i].push(prior_def);
                } else {
                    const intersect = new Set(
                        lodash.intersection([...def_to_loc[variable]], [...R[node]])
                    );
                    for (const v of intersect) UD[variable][i].push(v);
                }
            }
        }
    }
    
    // 构建 DU 链 (从 UD 链反转)
    const DU = {};
    for (const variable of Object.keys(UD)) {
        for (const loc of Object.keys(UD[variable])) {
            for (const def_loc of UD[variable][loc]) {
                if (!DU[variable]) DU[variable] = {};
                if (!DU[variable][def_loc]) DU[variable][def_loc] = [];
                DU[variable][def_loc].push(parseInt(loc));
            }
        }
    }
    
    return [UD, DU, vars, def_to_loc];
}
```

### 8.3 SSA 变量分割

```javascript
function split_variables(graph, def_uses, use_defs, vars, def_to_loc) {
    const variables = group_variables(def_uses, use_defs);
    let nb_vars = 0;
    
    for (const v of Object.keys(variables)) {
        const versions = variables[v];
        if (versions.length === 1) continue;
        
        for (const n in versions) {
            const [defs, uses] = versions[n];
            const new_var = lodash.cloneDeep(vars[v]);
            new_var.name = `${new_var.name}_${n}`;
            vars[new_var] = new_var;
            nb_vars++;
            def_to_loc[new_var] = new Set();
            
            // 更新定义点
            for (const loc of defs) {
                if (!def_uses[new_var]) def_uses[new_var] = {};
                const ins = graph.get_ins_from_loc(loc);
                ins.replace_lhs(new_var);
                def_uses[new_var][loc] = def_uses[v][loc];
                delete def_uses[v][loc];
                def_to_loc[v].delete(loc);
                def_to_loc[new_var].add(loc);
            }
            
            // 更新使用点
            for (const loc of uses) {
                const ins = graph.get_ins_from_loc(loc);
                if (!use_defs[new_var]) use_defs[new_var] = {};
                ins.replace_var(vars[v], new_var);
                use_defs[new_var][loc] = use_defs[v][loc];
                delete use_defs[v][loc];
            }
        }
    }
    return nb_vars;
}
```

### 8.4 寄存器传播

```javascript
function register_propagation(graph, def_uses, use_defs, vars) {
    let changed = true;
    while (changed) {
        changed = false;
        for (const node of graph.rpo) {
            const loc_with_ins = node.get_loc_with_ins();
            for (let i of Object.keys(loc_with_ins)) {
                i = parseInt(i);
                const ins = loc_with_ins[i];
                
                for (const v of ins.get_used_vars()) {
                    if (!use_defs[v]) continue;
                    const locs = use_defs[v][i];
                    if (!locs || locs.length !== 1) continue;
                    
                    const loc = locs[0];
                    if (loc < 0) continue;
                    
                    const orig_ins = graph.get_ins_from_loc(loc);
                    if (!orig_ins.is_propagable()) continue;
                    
                    // 常量传播
                    if (orig_ins.get_rhs().is_constant()) {
                        ins.replace(vars[v], orig_ins.get_rhs());
                        // 更新链...
                        changed = true;
                    }
                }
            }
        }
    }
}
```

---

## 9. 阶段 7: 代码生成 (Writer)

### 9.1 Writer 类

```javascript
class Writer {
    constructor(graph, function_name) {
        this.graph = graph;
        this.function_name = function_name;
        this.visited_nodes = new Set();
        this.indent = 0;
        this.buffer = [];
        this.loop_follow = [null];
        this.if_follow = [null];
        this.switch_follow = [null];
        this.latch_node = [null];
        this.declared = new Set();
    }
    
    write(s) { this.buffer.push(s); }
    space() { return " ".repeat(this.indent); }
    end_ins() { this.write(";\n"); }
    inc_indent() { this.indent += 4; }
    dec_indent() { if (this.indent > 0) this.indent -= 4; }
    
    output() {
        if (!this.graph) return "";
        if (this.function_name) {
            this.write(`function ${this.function_name}() {\n`);
            this.inc_indent();
            this.visit_node(this.graph.entry);
            this.dec_indent();
            this.write(`${this.space()}}\n`);
        } else {
            this.visit_node(this.graph.entry);
        }
        return this.buffer.join("");
    }
}
```

### 9.2 节点访问

```javascript
// Writer 方法
visit_node(node) {
    const jmp_nodes = [
        this.if_follow[this.if_follow.length - 1],
        this.switch_follow[this.switch_follow.length - 1],
        this.loop_follow[this.loop_follow.length - 1],
        this.latch_node[this.latch_node.length - 1],
    ];
    if (jmp_nodes.includes(node)) return;
    if (node.type !== "return" && this.visited_nodes.has(node)) return;
    
    this.visited_nodes.add(node);
    node.visit(this);
}

visit_condition_node(node) {
    const follow = node.follow["if"];
    
    if (follow) {
        this.if_follow.push(follow);
        this.write(`${this.space()}if(`);
        node.visit_cond(this);
        this.write(") {\n");
        this.inc_indent();
        this.visit_node(node.true);
        this.dec_indent();
        
        if (![node.true, node.false].includes(follow) && !this.visited_nodes.has(node.false)) {
            this.write(`\n${this.space()}} else {\n`);
            this.inc_indent();
            this.visit_node(node.false);
            this.dec_indent();
        }
        this.if_follow.pop();
        this.write(`${this.space()}}\n`);
        this.visit_node(follow);
    } else {
        this.write(`${this.space()}if (`);
        node.visit_cond(this);
        this.write(") {\n");
        this.inc_indent();
        this.visit_node(node.true);
        this.dec_indent();
        this.write(`${this.space()} } else {\n`);
        this.inc_indent();
        this.visit_node(node.false);
        this.dec_indent();
        this.write(`${this.space()} }\n`);
    }
}

visit_loop_node(node) {
    const follow = node.follow["loop"];
    
    if (node.loop_type === "pre_test") {
        this.write(`${this.space()}while (`);
        node.visit_cond(this);
        this.write(") {\n");
    } else if (node.loop_type === "post_test") {
        this.write(`${this.space()}do {\n`);
        this.latch_node.push(node.latch);
    } else {
        this.write(`${this.space()}while(true) {\n`);
    }
    
    this.inc_indent();
    this.loop_follow.push(follow);
    this.visit_node(node.loop_type === "pre_test" ? node.true : node.cond);
    this.loop_follow.pop();
    this.dec_indent();
    
    if (node.loop_type === "post_test") {
        this.latch_node.pop();
        this.write(`${this.space()}} while(`);
        node.latch.visit_cond(this);
        this.write(");\n");
    } else {
        this.write(`${this.space()}}\n`);
    }
    
    if (follow) this.visit_node(follow);
}

visit_statement_node(node) {
    for (const ins of node.lins) this.visit_ins(ins);
    if (node.children.length === 1) {
        const suc = node.children[0];
        if (this.loop_follow[this.loop_follow.length - 1] === suc) {
            this.write(`${this.space()}break;\n`);
        } else {
            this.visit_node(suc);
        }
    }
}

visit_return_node(node) {
    for (const ins of node.lins) this.visit_ins(ins);
}
```

### 9.3 表达式访问

```javascript
visit_binary_expression(expr) {
    expr.arg1.visit(this);
    this.write(" " + expr.op + " ");
    expr.arg2.visit(this);
}

visit_assign(lhs, rhs) {
    this.write(this.space());
    if (lhs.declared && !this.declared.has(lhs.name)) {
        this.declared.add(lhs.name);
        this.write("var ");
    }
    lhs.visit(this);
    this.write(" = ");
    rhs.visit(this);
    this.end_ins();
}

visit_return_expression(expr) {
    this.write(this.space());
    this.write("return ");
    if (expr.arg) expr.arg.visit(this);
    this.end_ins();
}

visit_member_expression(expr) {
    expr.object.visit(this);
    this.write("[");
    expr.property.visit(this);
    this.write("]");
}

visit_callee_expression(expr) {
    expr.func.visit(this);
    this.write("(...");
    expr.args.visit(this);
    this.write(")");
}

visit_new_instance_expression(expr) {
    this.write("new ");
    expr.clazz.visit(this);
    this.write("(");
    // 参数...
    this.write(")");
}
```

---

## 10. 完整反编译流程

```javascript
function decompile(bytes_codes, start, end) {
    if (bytes_codes.length === 0) return;
    
    // 1. 构建 CFG
    const graph = graph_construct(bytes_codes, start, end);
    
    // 2. 拆分条件节点
    split_if_nodes(graph);
    
    // 3. 数据流分析
    const [use_defs, def_uses, vars, def_to_loc] = build_def_use(graph);
    
    // 4. SSA 变量分割
    split_variables(graph, def_uses, use_defs, vars, def_to_loc);
    
    // 5. 栈变量消除
    replace_stack_var(graph, def_uses, use_defs, vars);
    
    // 6. 寄存器传播
    register_propagation(graph, def_uses, use_defs, vars);
    
    // 7. 重新计算 RPO
    graph.compute_rpo();
    
    // 8. 结构识别
    identify_structures(graph);
    
    return graph;
}

function main(bytes_codes, function_name) {
    const graph = decompile(bytes_codes);
    
    // 可选: 输出 CFG 图
    // graph.draw("jsvmp.png");
    
    const writer = new Writer(graph, function_name);
    const content = writer.output();
    
    fs.writeFileSync("output.js", content, { encoding: "utf-8" });
    console.log("Decompilation complete: output.js");
}

// 使用示例
// main(paramBDecodeData.slice(79, 1903), "main");
```

---

## 11. IR 指令定义 (opcode_ins.js)

```javascript
// 基类
class IRForm {
    constructor() {
        this.pos = undefined;
        this.opcode = undefined;
    }
    get_lhs() { return null; }
    get_rhs() { return null; }
    get_used_vars() { return []; }
    is_propagable() { return false; }
    is_constant() { return false; }
    visit(visitor) { }
}

// 常量
class Constant extends IRForm {
    constructor(value, type) {
        super();
        this.value = value;
        this.type = type;
    }
    is_constant() { return true; }
    visit(visitor) { visitor.visit_constant(this); }
}

// 变量/寄存器
class Register extends IRForm {
    constructor(name, declared = false) {
        super();
        this.name = name;
        this.declared = declared;
    }
    equal(other) { return other instanceof Register && this.name === other.name; }
    visit(visitor) { visitor.visit_variable(this); }
}

// 赋值
class AssignExpression extends IRForm {
    constructor(lhs, rhs) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
    }
    get_lhs() { return this.lhs; }
    get_rhs() { return this.rhs; }
    get_used_vars() { return this.rhs.get_used_vars ? this.rhs.get_used_vars() : []; }
    is_propagable() { return true; }
    visit(visitor) { visitor.visit_assign(this.lhs, this.rhs); }
}

// 二元表达式
class BinaryExpression extends IRForm {
    constructor(op, arg1, arg2) {
        super();
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
    }
    get_used_vars() {
        return [...(this.arg1.get_used_vars?.() || []), ...(this.arg2.get_used_vars?.() || [])];
    }
    is_constant() { return this.arg1.is_constant() && this.arg2.is_constant(); }
    visit(visitor) { visitor.visit_binary_expression(this); }
}

// 成员访问
class MemberExpression extends IRForm {
    constructor(object, property) {
        super();
        this.object = object;
        this.property = property;
    }
    get_used_vars() {
        return [...(this.object.get_used_vars?.() || []), ...(this.property.get_used_vars?.() || [])];
    }
    visit(visitor) { visitor.visit_member_expression(this); }
}

// 函数调用
class CalleeExpression extends IRForm {
    constructor(func, args) {
        super();
        this.func = func;
        this.args = args;
    }
    visit(visitor) { visitor.visit_callee_expression(this); }
}

// 返回
class ReturnExpression extends IRForm {
    constructor(arg) {
        super();
        this.arg = arg;
    }
    visit(visitor) { visitor.visit_return_expression(this); }
}

// 条件表达式
class CondExpression extends IRForm {
    constructor(op, arg1, arg2) {
        super();
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
    }
    neg() {
        const negMap = { "==": "!=", "!=": "==", "<": ">=", ">=": "<", ">": "<=", "<=": ">" };
        this.op = negMap[this.op] || this.op;
    }
    visit(visitor) { visitor.visit_cond_expression(this); }
}

// 栈操作
class StackPushExpression extends IRForm {
    constructor(stack_name, value) {
        super();
        this.stack_name = stack_name;
        this.value = value;
    }
    visit(visitor) { visitor.visit_stack_push_expression(this); }
}

class StackPopExpression extends IRForm {
    constructor(stack_name, length, is_array = false) {
        super();
        this.stack_name = stack_name;
        this.length = length;
        this.is_array = is_array;
    }
    visit(visitor) { visitor.visit_stack_pop_expression(this); }
}

// 数组
class ArrayExpression extends IRForm {
    constructor(values) {
        super();
        this.values = values;
    }
    visit(visitor) { visitor.visit_array_expression(this); }
}

// 导出指令集
const INSTRUCTION_SET = {
    // opcode: handler function
    // 0: function call
    // 4: throw
    // 9, 30, 56: return
    // 13, 48: conditional jump
    // 17: load constant
    // 18: unconditional jump
    // ...
};

module.exports = { IRForm, Constant, Register, AssignExpression, BinaryExpression, /* ... */ };
```

---

## 12. CFG 可视化

```javascript
// Graph 方法
draw(output = "jsvmp.png") {
    const g = graphviz.digraph("G");
    g.setNodeAttribut("color", "lightgray");
    g.setNodeAttribut("style", "filled");
    g.setNodeAttribut("shape", "box");
    
    const node_map = {};
    for (const node of this.nodes) {
        node_map[node] = node.toString();
    }
    
    for (const node of this.rpo) {
        if (node instanceof ConditionNode) {
            g.addEdge(node_map[node], node_map[node.true], { color: "red", label: "true" });
            g.addEdge(node_map[node], node_map[node.false], { color: "green", label: "false" });
        } else {
            for (const suc of this.all_sucs(node)) {
                g.addEdge(node_map[node], node_map[suc], { color: "blue" });
            }
        }
    }
    g.output("png", output);
}
```

---

## 13. 项目结构

```
artifacts/jsvmp/{target}/
├── source/                    # 原始 JS 文件
├── transforms/                # Babel 转换脚本
│   ├── extract_params.js      # 提取 VM 参数
│   ├── deobfuscate.js         # 去混淆
│   └── ...
├── lib/                       # 反编译器核心
│   ├── graph.js               # CFG 类
│   ├── basic_blocks.js        # 节点类
│   ├── opcode_ins.js          # IR 指令
│   ├── control_flow.js        # 控制流分析
│   ├── dataflow.js            # 数据流分析
│   ├── writer.js              # 代码生成
│   └── decompiler.js          # 主入口
├── raw/                       # 提取的数据
│   ├── bytecode.json
│   ├── constants.json
│   └── handlers.json
├── output/                    # 输出文件
│   ├── *_disasm.asm           # LIR
│   ├── *_mir.txt              # MIR
│   ├── *_hir.txt              # HIR
│   └── *_decompiled.js        # 最终 JS
└── NOTE.md                    # 分析笔记
```

---

## 14. 常见问题

| 问题 | 解决方案 |
|------|----------|
| 字节码格式不同 | 分析 `decode()` 函数，调整解码逻辑 |
| Handler 数量不同 | 修改 `fnList` 提取条件 |
| 未知 opcode | 添加到 `INSTRUCTION_SET`，实现 handler |
| 栈不平衡 | 检查 `replace_stack_var` 逻辑 |
| 循环识别错误 | 检查 `loop_type` 和 `loop_follow` |
| 变量名冲突 | 检查 `split_variables` SSA 转换 |
