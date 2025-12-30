# JSVMP Code Generation Guide (HIR → JavaScript)

> **⚠️ 这是 JSVMP 反编译中最容易出错的阶段！**
> 
> **核心问题**: HIR → JS 转换中最常见的错误是**控制流代码丢失**。
> **根因**: 递归处理基本块时，已访问的块返回空数组，导致 else 分支和循环体丢失。
> 
> **真实案例**: func_150 在 HIR 中有 1022 行，但错误的代码生成器只输出 274 行 (丢失 73% 代码！)

---

## 0. 快速检查清单 (MUST READ FIRST)

在编写或修改代码生成器之前，确保你理解以下关键点：

### ❌ 绝对不要这样做

```javascript
// 错误 1: 共享 visited 集合
function processBlock(blockId, visited) {
    if (visited.has(blockId)) return [];  // ← 这会导致 else 分支丢失!
    visited.add(blockId);
    // ...
    const thenStmts = processBlock(cf.trueTarget, visited);  // then 先访问
    const elseStmts = processBlock(cf.falseTarget, visited); // else 可能为空!
}

// 错误 2: 只处理循环头
function generateLoop(headerBlockId) {
    const headerBlock = this.blockMap.get(headerBlockId);
    return this.generateBlockInstructions(headerBlock);  // ← 只有头部，没有循环体!
}

// 错误 3: 没有找 merge point
if (block.controlFlow.type === 'conditional') {
    const thenStmts = processBlock(cf.trueTarget, visited);
    const elseStmts = processBlock(cf.falseTarget, visited);
    // 然后呢？从哪里继续？← 没有 merge point 会导致代码重复或丢失
}
```

### ✅ 正确的做法

```javascript
// 正确 1: 分离 visited 集合
const thenVisited = new Set(visited);
const elseVisited = new Set(visited);
const thenStmts = this.generateRegion(cf.trueTarget, mergePoint, thenVisited);
const elseStmts = this.generateRegion(cf.falseTarget, mergePoint, elseVisited);
// 合并 visited
for (const v of thenVisited) visited.add(v);
for (const v of elseVisited) visited.add(v);

// 正确 2: 处理所有循环节点
const orderedNodes = [...loopNodeSet].sort((a, b) => a - b);
for (const nodeId of orderedNodes) {
    const block = this.blockMap.get(nodeId);
    bodyStmts.push(...this.generateBlockInstructions(block));
}

// 正确 3: 找到 merge point 并从那里继续
const mergePoint = this.findMergePoint(cf.trueTarget, cf.falseTarget, visited);
// ... 生成 if-else ...
currentBlockId = mergePoint;  // 从 merge point 继续
```

---

## 1. 常见代码丢失问题

### 1.1 症状识别

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| 函数行数大幅减少 (如 HIR 1000行 → JS 300行) | 控制流处理错误 | 使用区域化生成 |
| `if` 语句没有 `else` 分支 | 递归访问时 else 目标已被标记为已访问 | 分离 visited 集合 |
| 循环体为空或只有部分代码 | 循环节点简单堆叠，未处理内部控制流 | 正确处理循环内 CFG |
| 嵌套 `if` 结构扁平化 | 未正确识别 merge point | 计算支配树找 IPDOM |

### 1.2 错误代码模式

```javascript
// ❌ 错误: 递归处理导致代码丢失
function processBlock(blockId, visited) {
    if (visited.has(blockId)) return [];  // 问题: 已访问就返回空!
    visited.add(blockId);
    
    // ... 处理指令 ...
    
    if (block.controlFlow.type === 'conditional') {
        const thenStmts = processBlock(cf.trueTarget, visited);  // then 分支
        const elseStmts = processBlock(cf.falseTarget, visited); // else 可能为空!
        // 因为 then 分支可能已经访问了 else 的目标块
    }
}
```

---

## 2. 正确的控制流恢复算法

### 2.1 核心原则

1. **区域化生成**: 每个控制结构（if-else, loop）是一个独立区域
2. **分离 visited 集合**: then/else 分支使用独立的 visited 集合
3. **找 merge point**: if-else 的汇合点是两个分支的公共后继
4. **循环边界**: 循环内的块不应该"逃逸"到循环外

### 2.2 算法框架

```javascript
class ControlFlowGenerator {
    constructor(func) {
        this.blockMap = new Map(func.blocks.map(b => [b.id, b]));
        this.loopHeaders = new Set();
        this.loopNodes = new Map();  // header -> Set of node ids
        this.loopExits = new Map();  // header -> exit block id
        
        // 预处理循环信息
        for (const loop of func.loops) {
            this.loopHeaders.add(loop.header);
            this.loopNodes.set(loop.header, new Set(loop.nodes));
            // 找循环出口
            const headerBlock = this.blockMap.get(loop.header);
            if (headerBlock.controlFlow?.type === 'conditional') {
                const nodeSet = new Set(loop.nodes);
                const cf = headerBlock.controlFlow;
                const exit = !nodeSet.has(cf.trueTarget) ? cf.trueTarget :
                             !nodeSet.has(cf.falseTarget) ? cf.falseTarget : null;
                if (exit) this.loopExits.set(loop.header, exit);
            }
        }
    }
    
    generate() {
        const entry = this.func.entry ?? this.func.blocks[0]?.id;
        if (entry === null) return [];
        return this.generateRegion(entry, null, new Set());
    }
    
    // 核心: 区域化生成
    generateRegion(startBlockId, endBlockId, visited) {
        const statements = [];
        let currentBlockId = startBlockId;
        
        while (currentBlockId !== null && 
               currentBlockId !== endBlockId && 
               !visited.has(currentBlockId)) {
            
            const block = this.blockMap.get(currentBlockId);
            if (!block) break;
            
            visited.add(currentBlockId);
            
            // 1. 检查是否是循环头
            if (this.loopHeaders.has(currentBlockId)) {
                statements.push(...this.generateLoop(currentBlockId, visited));
                currentBlockId = this.loopExits.get(currentBlockId) ?? null;
                continue;
            }
            
            // 2. 生成块指令
            statements.push(...this.generateBlockInstructions(block));
            
            // 3. 处理控制流
            if (!block.controlFlow) {
                currentBlockId = null;
            } else if (block.controlFlow.type === 'conditional') {
                // ⚠️ 关键: 分离 visited 集合!
                const cf = block.controlFlow;
                const condition = this.extractCondition(block);
                
                const thenVisited = new Set(visited);
                const elseVisited = new Set(visited);
                
                // 找 merge point (两个分支的公共后继)
                const mergePoint = this.findMergePoint(cf.trueTarget, cf.falseTarget, visited);
                
                // 递归生成 then/else 分支，到 merge point 为止
                const thenStmts = this.generateRegion(cf.trueTarget, mergePoint, thenVisited);
                const elseStmts = this.generateRegion(cf.falseTarget, mergePoint, elseVisited);
                
                // 合并 visited
                for (const v of thenVisited) visited.add(v);
                for (const v of elseVisited) visited.add(v);
                
                // 生成 if-else
                statements.push(t.ifStatement(
                    condition,
                    t.blockStatement(thenStmts.length > 0 ? thenStmts : [t.emptyStatement()]),
                    elseStmts.length > 0 ? t.blockStatement(elseStmts) : null
                ));
                
                // 从 merge point 继续
                currentBlockId = mergePoint;
            } else {
                // jump/fallthrough
                currentBlockId = block.controlFlow.target;
            }
        }
        
        return statements;
    }
    
    // 循环生成
    generateLoop(headerBlockId, visited) {
        const loopNodeSet = this.loopNodes.get(headerBlockId);
        const headerBlock = this.blockMap.get(headerBlockId);
        
        // 标记所有循环节点为已访问
        for (const nodeId of loopNodeSet) {
            visited.add(nodeId);
        }
        
        // 生成循环体
        const bodyStmts = [];
        const orderedNodes = [...loopNodeSet].sort((a, b) => a - b);
        
        for (const nodeId of orderedNodes) {
            const block = this.blockMap.get(nodeId);
            if (!block) continue;
            
            bodyStmts.push(...this.generateBlockInstructions(block));
            
            // 处理循环内的条件分支
            if (block.controlFlow?.type === 'conditional' && nodeId !== headerBlockId) {
                const cf = block.controlFlow;
                const trueInLoop = loopNodeSet.has(cf.trueTarget);
                const falseInLoop = loopNodeSet.has(cf.falseTarget);
                
                if (!trueInLoop || !falseInLoop) {
                    // 有一个分支跳出循环 -> break
                    const condition = this.extractCondition(block);
                    const breakCond = !trueInLoop ? condition : t.unaryExpression('!', condition);
                    bodyStmts.push(t.ifStatement(breakCond, t.blockStatement([t.breakStatement()]), null));
                }
            }
        }
        
        // 创建 while 循环
        const loopCondition = this.extractCondition(headerBlock) ?? t.booleanLiteral(true);
        return [t.whileStatement(loopCondition, t.blockStatement(bodyStmts))];
    }
    
    // 找 merge point (IPDOM)
    findMergePoint(trueTarget, falseTarget, visited) {
        const trueReachable = this.getReachable(trueTarget, visited);
        const falseReachable = this.getReachable(falseTarget, visited);
        
        // 找第一个公共可达块
        for (const blockId of trueReachable) {
            if (falseReachable.has(blockId)) {
                return blockId;
            }
        }
        return null;
    }
    
    getReachable(startBlockId, visited) {
        const reachable = new Set();
        const queue = [startBlockId];
        
        while (queue.length > 0) {
            const blockId = queue.shift();
            if (reachable.has(blockId) || visited.has(blockId)) continue;
            
            reachable.add(blockId);
            
            const block = this.blockMap.get(blockId);
            if (!block?.controlFlow) continue;
            
            const cf = block.controlFlow;
            if (cf.type === 'conditional') {
                queue.push(cf.trueTarget, cf.falseTarget);
            } else if (cf.type === 'jump' || cf.type === 'fallthrough') {
                queue.push(cf.target);
            }
        }
        
        return reachable;
    }
}
```

---

## 3. HIR 格式要求

### 3.1 HIR 必须包含的信息

```
// Function {id}
// Params: {n}, Strict: {true|false}
// Bytecode: [{start}, {end}]
// Entry: BB{id}
// Blocks: {count}
// Loops: {count}
//   {type} loop: header=BB{h}, latch=BB{l}, nodes=[BB{n1}, BB{n2}, ...]
// Conditionals: {count}

BB{id}: [{start_addr}-{end_addr}] ({type}) [{loop_info}]
  {addr}: {MIR_statement}
  ...
  -> {control_flow}
```

### 3.2 控制流标注

| 类型 | 格式 | 说明 |
|------|------|------|
| 条件分支 | `-> if (cond) goto BB{x} else goto BB{y}` | 必须有 else |
| 无条件跳转 | `-> goto BB{x}` | 单目标 |
| 顺序执行 | `-> BB{x}` | fall-through |
| 返回 | (无) | 函数结束 |

### 3.3 循环信息

```
// Loops: 3
//   while loop: header=BB25, latch=BB29, nodes=[BB25, BB26, BB27, BB28, BB29]
//   do-while loop: header=BB33, latch=BB37, nodes=[BB33, BB34, BB35, BB36, BB37]
//   endless loop: header=BB41, latch=BB45, nodes=[BB41, BB42, BB43, BB44, BB45]
```

- **header**: 循环入口块
- **latch**: 回边源块（跳回 header 的块）
- **nodes**: 循环内所有块

---

## 4. 验证清单

### 4.1 生成前检查

- [ ] HIR 包含完整的循环信息 (header, latch, nodes)
- [ ] 每个条件块都有 true/false 目标
- [ ] 基本块按地址排序

### 4.2 生成后验证

```bash
# 1. 行数对比
echo "HIR lines:" && wc -l output/bdms_hir.txt
echo "JS lines:" && wc -l output/bdms_decompiled.js

# 2. 函数行数对比 (关键函数)
awk '/^\/\/ Function 150$/,/^\/\/ Function 151$/' output/bdms_hir.txt | wc -l
awk '/^function func_150\(/,/^function func_151\(/' output/bdms_decompiled.js | wc -l

# 3. 控制结构数量
grep -c "while" output/bdms_decompiled.js
grep -c "if (" output/bdms_decompiled.js
```

### 4.3 预期比例

| 指标 | 预期范围 | 异常信号 |
|------|----------|----------|
| JS行数 / HIR行数 | 0.5 - 1.5 | < 0.3 表示代码丢失 |
| while 数量 | ≈ HIR 中 Loops 数量 | 差距 > 20% 需检查 |
| if 数量 | ≈ HIR 中 Conditionals 数量 | 差距 > 30% 需检查 |

---

## 5. 常见修复模式

### 5.1 else 分支丢失

**问题**: `if (cond) { ... }` 没有 else

**修复**: 检查 `generateRegion` 中 else 分支的 visited 集合是否独立

```javascript
// ❌ 错误: 共享 visited
const thenStmts = this.generateRegion(cf.trueTarget, mergePoint, visited);
const elseStmts = this.generateRegion(cf.falseTarget, mergePoint, visited);

// ✅ 正确: 分离 visited
const thenVisited = new Set(visited);
const elseVisited = new Set(visited);
const thenStmts = this.generateRegion(cf.trueTarget, mergePoint, thenVisited);
const elseStmts = this.generateRegion(cf.falseTarget, mergePoint, elseVisited);
```

### 5.2 循环体不完整

**问题**: while 循环体只有部分代码

**修复**: 确保循环内所有节点都被处理

```javascript
// ❌ 错误: 只处理 header
for (const instr of headerBlock.instructions) { ... }

// ✅ 正确: 处理所有循环节点
const orderedNodes = [...loopNodeSet].sort((a, b) => a - b);
for (const nodeId of orderedNodes) {
    const block = this.blockMap.get(nodeId);
    for (const instr of block.instructions) { ... }
}
```

### 5.3 嵌套结构扁平化

**问题**: 嵌套的 if-else 变成顺序的 if

**修复**: 正确计算 merge point

```javascript
// 使用支配树计算 IPDOM (Immediate Post-Dominator)
findMergePoint(trueTarget, falseTarget, visited) {
    // 方法1: 简单的可达性分析
    const trueReachable = this.getReachable(trueTarget, visited);
    const falseReachable = this.getReachable(falseTarget, visited);
    for (const blockId of trueReachable) {
        if (falseReachable.has(blockId)) return blockId;
    }
    
    // 方法2: 使用支配树 (更精确)
    // const idoms = this.computeImmediateDominators();
    // return this.findIPDOM(trueTarget, falseTarget, idoms);
}
```

---

## 6. 调试技巧

### 6.1 打印控制流

```javascript
// 在 generateRegion 开头添加
console.log(`Entering region: start=${startBlockId}, end=${endBlockId}, visited=${[...visited]}`);

// 在处理条件分支时
console.log(`Conditional at BB${currentBlockId}: true=${cf.trueTarget}, false=${cf.falseTarget}, merge=${mergePoint}`);
```

### 6.2 可视化 CFG

```javascript
// 使用 graphviz 输出 CFG
function drawCFG(func, outputPath) {
    const dot = ['digraph G {'];
    for (const block of func.blocks) {
        dot.push(`  BB${block.id} [label="BB${block.id}\\n${block.type}"];`);
        if (block.controlFlow?.type === 'conditional') {
            dot.push(`  BB${block.id} -> BB${block.controlFlow.trueTarget} [label="T"];`);
            dot.push(`  BB${block.id} -> BB${block.controlFlow.falseTarget} [label="F"];`);
        } else if (block.controlFlow?.target) {
            dot.push(`  BB${block.id} -> BB${block.controlFlow.target};`);
        }
    }
    dot.push('}');
    fs.writeFileSync(outputPath, dot.join('\n'));
}
```

### 6.3 对比 HIR 和 JS

```bash
# 提取 func_150 的 HIR
awk '/^\/\/ Function 150$/,/^\/\/ Function 151$/' output/bdms_hir.txt > /tmp/func150_hir.txt

# 提取 func_150 的 JS
awk '/^function func_150\(/,/^function func_151\(/' output/bdms_decompiled.js > /tmp/func150_js.txt

# 对比行数
wc -l /tmp/func150_hir.txt /tmp/func150_js.txt
```

---

## 7. 完整示例

### 7.1 输入 HIR

```
// Function 10
// Params: 2, Strict: true
// Entry: BB0
// Blocks: 5
// Loops: 1
//   while loop: header=BB2, latch=BB3, nodes=[BB2, BB3]
// Conditionals: 2

BB0: [0-10] (condition)
  0: t0 = arg0
  5: t1 = t0 > 0
  -> if (cond) goto BB1 else goto BB4

BB1: [12-20]
  12: t2 = 0
  -> BB2

BB2: [22-30] (condition) [while loop header]
  22: t3 = t2 < t0
  -> if (cond) goto BB3 else goto BB4

BB3: [32-40] [loop latch -> BB2]
  32: t4 = t2 + 1
  35: t2 = t4
  -> goto BB2

BB4: [42-50]
  42: return t2
```

### 7.2 期望输出 JS

```javascript
function func_10(arg0, arg1) {
  "use strict";
  var t0 = arg0;
  var t1 = t0 > 0;
  if (t1) {
    var t2 = 0;
    while (t2 < t0) {
      var t4 = t2 + 1;
      t2 = t4;
    }
  }
  return t2;
}
```

### 7.3 错误输出 (代码丢失)

```javascript
// ❌ 错误: 循环体丢失
function func_10(arg0, arg1) {
  "use strict";
  var t0 = arg0;
  var t1 = t0 > 0;
  if (t1) {
    var t2 = 0;
    while (t2 < t0) {
      // 循环体为空!
    }
  }
  return t2;
}
```

---

## 8. 总结

| 问题 | 根因 | 解决方案 |
|------|------|----------|
| else 分支丢失 | 共享 visited 集合 | 分离 then/else 的 visited |
| 循环体不完整 | 只处理 header 块 | 遍历所有 loop nodes |
| 嵌套结构扁平化 | 未找到正确的 merge point | 计算 IPDOM |
| 代码顺序错乱 | 未按地址排序 | 按 block.startAddr 排序 |

**核心原则**: 
1. **区域化生成** - 每个控制结构是独立区域
2. **分离 visited** - then/else 使用独立集合
3. **正确的边界** - 找到 merge point 和 loop exit

---

## 9. 参考实现

### 9.1 已验证的实现

- **文件**: `artifacts/jsrev/douyin.com/lib/hir_to_js_v2.js`
- **输入**: `output/bdms_hir.txt` (46,432 行)
- **输出**: `output/bdms_decompiled_v2.js` (29,209 行)
- **改进**: 从 25,957 行提升到 29,209 行 (+12.5%)

### 9.2 关键类

```javascript
class ControlFlowGenerator {
    constructor(func) {
        // 构建 block map
        this.blockMap = new Map(func.blocks.map(b => [b.id, b]));
        
        // 预处理循环信息
        this.loopHeaders = new Set();
        this.loopNodes = new Map();   // header -> Set of node ids
        this.loopExits = new Map();   // header -> exit block id
        
        for (const loop of func.loops) {
            this.loopHeaders.add(loop.header);
            this.loopNodes.set(loop.header, new Set(loop.nodes));
            // 找循环出口...
        }
    }
    
    generate() {
        return this.generateRegion(entry, null, new Set());
    }
    
    generateRegion(startBlockId, endBlockId, visited) {
        // 核心: 区域化生成，分离 visited
    }
    
    generateLoop(headerBlockId, visited) {
        // 核心: 处理所有循环节点
    }
    
    findMergePoint(trueTarget, falseTarget, visited) {
        // 核心: 找 IPDOM
    }
}
```

### 9.3 验证命令

```bash
# 运行代码生成器
node lib/hir_to_js_v2.js

# 验证输出
wc -l output/bdms_hir.txt output/bdms_decompiled_v2.js

# 对比特定函数
awk '/^\/\/ Function 150$/,/^\/\/ Function 151$/' output/bdms_hir.txt | wc -l
awk '/^function func_150\(/,/^function func_151\(/' output/bdms_decompiled_v2.js | wc -l
```

---

## 10. 常见错误模式速查

| 症状 | 可能原因 | 检查点 |
|------|----------|--------|
| JS 行数 < HIR 行数的 50% | 控制流处理错误 | 检查 visited 集合是否分离 |
| `if` 没有 `else` | else 分支被跳过 | 检查 generateRegion 的 visited 参数 |
| `while` 体为空 | 只处理了 header | 检查 generateLoop 是否遍历所有 nodes |
| 嵌套 `if` 变成顺序 `if` | merge point 计算错误 | 检查 findMergePoint 实现 |
| 代码重复 | 没有正确标记 visited | 检查 visited 合并逻辑 |
| 无限循环 | 循环出口计算错误 | 检查 loopExits 计算 |

---

## 11. 调试流程

当代码生成出现问题时，按以下步骤调试：

1. **对比行数**: `wc -l output/bdms_hir.txt output/bdms_decompiled.js`
2. **定位问题函数**: 找到 HIR 行数多但 JS 行数少的函数
3. **提取 HIR**: `awk '/^\/\/ Function N$/,/^\/\/ Function N+1$/' output/bdms_hir.txt`
4. **添加日志**: 在 generateRegion 开头打印 `startBlockId, endBlockId, visited.size`
5. **检查控制流**: 确认每个条件分支的 then/else 都被处理
6. **检查循环**: 确认循环内所有节点都被处理
