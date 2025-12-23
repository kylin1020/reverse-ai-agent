---
inclusion: manual
---

# jsvmp (State-Driven Edition)

> **Mission**: Statically decompile JSVMP bytecode to readable JavaScript via progressive IR lifting.
> **Approach**: Raw JS → Beautified → Deobfuscated → VM Extraction → IR Lifting → Decompiled JS
> **Output**: Decompiled `.js` file with reconstructed control flow.

---

## ⛔ STATE PROTOCOL

**You are an execution engine for `artifacts/jsvmp/{target}/TODO.md`.**

### 🔄 EXECUTION LOOP (Every Interaction)

1. **READ**: `TODO.md` + `NOTE.md` (create if missing)
2. **IDENTIFY**: First unchecked `[ ]` item = CURRENT TASK
3. **CHECK PHASE**: See PHASE GATE below
4. **EXECUTE**: One step to advance current task
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md`(in chinese) with findings

---

## 📝 NOTE.md — Analysis Memory

**Path**: `artifacts/jsvmp/{target}/NOTE.md`

Maintain this file to preserve analysis context across sessions.

### ⚠️ MANDATORY: File & Action Tracking

**Every NOTE.md entry MUST include:**
1. **Source file path** — where the function/data was found
2. **Line numbers** — exact location in file
3. **Action taken** — what you did to discover this
4. **Session timestamp** — when this was discovered

### Required Sections
```markdown
## Session Log
<!-- Append each session's work here -->
### [YYYY-MM-DD HH:MM] Session Summary
**Task**: What was being worked on
**Files Analyzed**:
- `path/to/file.js` (lines X-Y) — what was found
**Actions Taken**:
1. Action description → Result
**Outcome**: What was accomplished
**Next**: What should be done next

## File Index
<!-- Quick reference to all analyzed files -->
| File | Purpose | Key Lines | Status |
|------|---------|-----------|--------|
| `source/main.js` | Raw script | - | ✅ Downloaded |
| `source/main_beautified.js` | Beautified | - | ✅ Formatted |
| `output/main_deob.js` | Deobfuscated | - | ✅ Primary |

## VM Structure
- Bytecode location: {file}:{line}
- Constants array: {count} items
- Handler count: {count} functions
- Instruction format: [opcode, p0, p1, p2, p3]

## Opcode Mapping
| Opcode | Mnemonic | Stack Effect | Notes |
|--------|----------|--------------|-------|
| 0 | CALL | -(argc+1), +1 | Call function |
| 17 | PUSH_CONST | 0, +1 | Push constant |
| 18 | JMP | 0, 0 | Unconditional jump |
| ... | ... | ... | ... |

## Key Functions (Decompiled)
- `func_0` (pc 0-50) — `output/main_deob.js:123-145`
  - Purpose: entry point, initializes globals
  - Discovered: [date] via [method]

## Data Structures
- Stack: array-based, grows upward
- Locals: indexed by p1 parameter
- Constants: string/number literals

## Verified Facts
- [x] Opcode 17 = PUSH_CONST (verified via trace)
- [x] Bytecode encoding: Base64 → UTF-8 → 5-byte groups
- [ ] Opcode 23 semantics unknown

## Open Questions
- What does opcode 42 do?
- How are nested functions handled?
```

**UPDATE NOTE.md when you:**
- Discover a new opcode's semantics
- Map a handler function to its purpose
- Identify a key decompiled function
- Verify bytecode encoding/decoding
- Start/end a session → **add to Session Log**

**⚠️ Sync immediately** — don't wait until task completion

---

## 🚨 PHASE GATE — STRICT ORDERING

**Before ANY action: "Is current phase complete?"**

| Phase Status | Allowed Actions |
|--------------|-----------------|
| Phase 1 incomplete | Beautify/Deobfuscate ONLY |
| Phase 2 incomplete | Extract VM data ONLY: bytecode, constants, handlers |
| Phase 3 incomplete | Disassembly ONLY: opcode mapping, LIR generation |
| Phase 4 incomplete | Stack analysis ONLY: expression trees, MIR generation |
| Phase 5 incomplete | CFG/Data-flow ONLY: structure recovery, HIR generation |
| All phases done | Code generation, output JS |

**❌ FORBIDDEN while earlier phases incomplete:**
- Skipping to VM extraction without beautification
- Skipping to code generation without proper IR
- Guessing opcode semantics without verification
- Emitting JS without CFG analysis

**🔥 PERSISTENCE**: Complex VMs are expected. Escalation: Static analysis → ASK HUMAN. Never skip phases.

---

## 🎯 STATIC ANALYSIS PRIORITY (CRITICAL)

**⚠️ MANDATORY: Static analysis is the PRIMARY and PREFERRED approach. Browser is AUXILIARY TOOL ONLY.**

### File Priority Order
| Priority | File Pattern | When to Use |
|----------|--------------|-------------|
| 1️⃣ HIGHEST | `output/*_deobfuscated.js` | **ALWAYS first** — cleanest, most readable |
| 2️⃣ HIGH | `source/*_beautified.js` | When deobfuscated not available |
| 3️⃣ LOW | `source/*.js` (raw) | Only for extraction scripts, NOT for understanding |

### Static Analysis Strategy (PRIMARY)
1. **CHECK for deobfuscated files FIRST**: `ls output/*_deobfuscated.js source/*_beautified.js`
2. **READ deobfuscated code** — understand VM structure from clean code
3. **Use `sg` or `rg` on local files** — pattern matching and code search
4. **Trace function calls statically** — map VM components step by step
5. **Write analysis scripts** — automate extraction and transformation

---

## 🌐 BROWSER AUXILIARY TOOLS

**浏览器是辅助工具，用于验证静态分析结论、获取运行时值、定位难以静态分析的代码。**

### 使用场景

| 场景 | 工具 | 说明 |
|------|------|------|
| 定位 VM Dispatcher | Performance Profiler | 找到 Self Time 最长的函数 |
| 验证 Opcode 语义 | 日志断点 | 差分分析不同输入的执行轨迹 |
| 获取运行时值 | `get_scope_variables` | 静态无法确定的动态值 |
| 绕过反调试 | `replace_script` | 移除 debugger 语句 |
| 打印函数源码 | `evaluate_script` | 快速定位函数定义位置 |

### 核心技巧

#### 1. 调用栈追踪 (Call Stack First)

**有目标请求？→ 先追踪调用栈，搜索是辅助。**

```javascript
// 1. 设置断点，让人类触发
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
// 2. 人类触发后，读取调用栈
get_debugger_status(maxCallStackFrames=20)
// 3. 调用栈显示: file + line + function → 这就是目标
// 4. 检查变量
get_scope_variables(frameIndex=N, searchTerm="key")
```

#### 2. 打印函数源码 (快速定位)

```javascript
// 直接输入函数名查看定义和位置
evaluate_script(script="targetFunc")
// Response: function _0x1b01d3(){...}  📍 VM24:1:37477

// 打印函数源码 (限制长度)
evaluate_script(script="targetFunc.toString().slice(0, 2000)")

// 探索对象结构
evaluate_script(script="JSON.stringify(Object.keys(vmContext)).slice(0,1000)")
```

#### 3. 断点策略

```javascript
// 日志断点 (不暂停) — 末尾 ", false" 是关键！
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log(`[TRACE] PC:${pc} OP:${op} STACK:${JSON.stringify(stack.slice(-3))}`), false')

// 暂停断点 — 需要人类触发
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=12345)
// ⚠️ 设置后不要调用 navigate_page，会死锁！让人类刷新页面
```

#### 4. 深度函数追踪

```javascript
// Hook 函数获取调用栈和参数
evaluate_script(script=`
    const orig = window.targetFunc;
    window.targetFunc = function(...args) {
        console.log('[HOOK] args:', JSON.stringify(args).slice(0,500));
        console.log('[HOOK] stack:', new Error().stack);
        return orig.apply(this, args);
    };
    'hooked'
`)

// 从调用栈找到内层函数 → 打印其源码
evaluate_script(script="innerFunc.toString().slice(0, 2000)")
```

#### 5. 反调试绕过

```javascript
// 1. 已暂停在 debugger，查看调用栈
get_debugger_status(contextLines=5)

// 2. 从调用栈找到源文件，替换反调试代码
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")

// 3. 刷新验证 (用短超时，如果没绕过会再次暂停)
navigate_page(type="reload", timeout=3000)
```

**常见反调试模式**:
| 模式 | 替换策略 |
|------|----------|
| `debugger;` | 直接删除 |
| `setInterval(()=>{debugger},100)` | 删除整个 setInterval |
| `constructor("debugger")()` | 替换为空函数 |

#### 6. 持久化 Hook (跨刷新存活)

**⚠️ `evaluate_script` 注入的 Hook 不能跨刷新存活！**

```javascript
// ❌ 错误: evaluate_script hook 刷新后丢失
evaluate_script(script="window.hook = ...") 
navigate_page(type="reload")  // Hook 没了！

// ✅ 正确: 使用 set_breakpoint (CDP 级别，跨刷新存活)
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log("VAL:", someVar), false')

// ✅ 正确: 使用 replace_script (修改源码本身)
replace_script(urlPattern=".*vm.js.*",
    oldCode="function dispatch(op)",
    newCode="function dispatch(op){console.log('OP:',op);")
// 刷新后修改后的脚本加载 → hook 生效
```

#### 7. 大数据输出保存

`evaluate_script` 返回值会被截断，大数据用控制台输出：

```javascript
// Step 1: 输出到控制台 (不截断)
evaluate_script(script="console.log(JSON.stringify(largeObject))")

// Step 2: 保存控制台输出到文件
list_console_messages(savePath="artifacts/jsvmp/{target}/raw/data.txt")
```

### VM 分析专用技巧

#### Dispatcher 定位 (Performance Profiler)

1. Chrome DevTools → Performance → Record
2. 触发 VM 执行
3. 找到 Self Time 最长的函数 (通常是黄色实心条)
4. 进入该函数，找到最内层循环结构

#### Opcode 语义验证 (差分分析)

```javascript
// 1. 输入 AAAA → 运行 → 保存 trace_A.log
// 2. 输入 AAAB → 运行 → 保存 trace_B.log
// 3. 比较: 第一个不同的行就是输入被读取和处理的位置

// 日志断点记录执行轨迹
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=XXX,
    condition='console.log(`[TRACE] PC:${pc} OP:${bytecode[pc]} STACK:${JSON.stringify(stack.slice(-5))}`), false')
```

### ⚠️ 浏览器使用规则

1. **静态分析优先** — 浏览器是辅助，不是主力
2. **调用栈是真相** — 不要盲目搜索，先看调用栈
3. **日志断点优先** — 能用日志断点就不用暂停断点
4. **暂停断点需人类触发** — 设置后不要自动刷新，会死锁
5. **Hook 跨刷新用 set_breakpoint** — evaluate_script 不能存活
6. **大数据用控制台** — evaluate_script 返回值会截断
7. **清理断点** — 调试完成后 `clear_all_breakpoints()`

---

## 📋 TODO.md TEMPLATE

```markdown
# JSVMP Decompilation Plan: {target}

## Target
- URL: {target_url}
- Script: {script_path}
- VM Type: {vm_type_if_known}

## Phase 1: Code Preprocessing (Beautify & Deobfuscate)
- [ ] Download target script to source/
- [ ] **Beautify code** (mandatory): `npx js-beautify -f source/main.js -o source/main_beautified.js`
- [ ] **Obfuscation audit**: Detect obfuscation patterns
    - String array / hex variables (`var _0x...`)
    - Control flow flattening (switch-case)
    - String encoding (XOR, Base64, custom)
    - *If found → add specific deobfuscation tasks*
- [ ] Identify decoder functions (if obfuscated)
- [ ] Extract string arrays (if obfuscated)
- [ ] Generate output/*_deobfuscated.js (if obfuscated) or copy beautified version

## Phase 2: VM Data Extraction (⛔ REQUIRES Phase 1)
- [ ] Locate VM dispatcher (see Dispatcher Patterns below)
- [ ] Extract bytecode (Base64/encoded string)
- [ ] Extract constants array
- [ ] Extract handler function array
- [ ] Decode bytecode to instruction array
- [ ] Save to source/bytecode.json

## Phase 3: Disassembly → Low-Level IR (⛔ REQUIRES Phase 2)
- [ ] Map opcodes to handlers (static analysis)
- [ ] Define OPCODE_TABLE with mnemonics
- [ ] Implement disassembler
- [ ] Generate output/{target}_disasm.asm
- [ ] Verify: all opcodes recognized, no unknowns

## Phase 4: Stack Analysis → Mid-Level IR (⛔ REQUIRES Phase 3)
- [ ] Implement stack simulator
- [ ] Build expression trees from stack ops
- [ ] Eliminate explicit stack references
- [ ] Generate output/{target}_mir.txt
- [ ] Verify: stack balanced at block boundaries

## Phase 5: CFG + Data-Flow → High-Level IR (⛔ REQUIRES Phase 4)
- [ ] Build CFG (leaders, blocks, edges)
- [ ] Reaching definitions analysis
- [ ] Value propagation (inline single-use temps)
- [ ] Loop detection (back edges)
- [ ] Conditional structure recovery
- [ ] Generate output/{target}_hir.txt

## Phase 6: Code Generation (⛔ REQUIRES Phase 5)
- [ ] Convert HIR to Babel AST
- [ ] Emit structured control flow (if/while/for)
- [ ] Generate output/{target}_decompiled.js
- [ ] Verify: syntactically valid JS

## Phase 7: Verification & Cleanup
- [ ] Compare behavior with original (browser test)
- [ ] Rename variables where semantics clear
- [ ] Document VM quirks in README.md
```

---

## ⚠️ Large File Warning

> Decompiled JS files are 100KB-500KB+. **NEVER read entire files!**
> Use `grepSearch` first, then `readFile` with line range (50-100 lines max).

---

## PHASE GUIDES

### Phase 1: Code Preprocessing (Beautify & Deobfuscate)

**⚠️ Beautification is mandatory** — minified code cannot be effectively analyzed

```bash
# Step 1: Download script (curl or save from browser)

# Step 2: Beautify code (mandatory)
npx js-beautify -f source/main.js -o source/main_beautified.js

# Step 3: Check obfuscation type
head -c 2000 source/main_beautified.js
```

**Obfuscation Detection Checklist:**
| Pattern | Obfuscation Type | Handling |
|---------|------------------|----------|
| `var _0x...` + large array | String array obfuscation | Extract array, inline strings |
| `switch(state)` loop | Control flow flattening | AST reconstruction |
| `atob()`, XOR operations | String encoding | Decode and replace |
| `debugger;` statements | Anti-debug | Remove |
| No obvious obfuscation | Minified only | Beautify is sufficient |

**Deobfuscation Workflow (if needed):**

**⚠️ MANDATORY**: Before deobfuscation, load skill file:
```
read_file("skills/js_deobfuscation.md")
```

1. Identify obfuscation type
2. Apply corresponding technique (refer to skill file)
3. Write extraction script to `scripts/`
4. Generate `output/*_deobfuscated.js`

**If no obfuscation:**
```bash
cp source/main_beautified.js output/main_deob.js
```

---

## Progressive Decompilation Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 1 | Raw JS | `*_beautified.js` / `*_deob.js` | Beautify & deobfuscate |
| 2 | Clean JS | bytecode, constants | Extract VM data |
| 3 | Raw bytecode | `_disasm.asm` | Disassembly with explicit stack ops |
| 4 | Low-Level IR | `_mir.txt` | Eliminate stack, build expression trees |
| 5 | Mid-Level IR | `_hir.txt` | CFG + data-flow + structure recovery |
| 6 | High-Level IR | `_decompiled.js` | Emit readable JavaScript |

---

## Phase 2: Extract VM Data

### ⚠️ JSVMP Core Concept: State Machine Analysis

> **Trigger**: Infinite Loop Logic (any syntax) + Bytecode Array + Virtual Instruction Pointer (VIP)  
> **Goal**: Map Virtual Opcodes to Real Logic & Reconstruct Algorithms  
> **Core Principle**: JSVMP is a **State Machine**. Focus on **Data Flow** (Stack/Context changes) rather than **Control Flow** (Loop syntax).

#### 🔑 The 3 Forms of Dispatchers

Do not limit your search to `switch` statements. A VM Dispatcher is simply a mechanism mapping `Opcode -> Handler`. There are three common implementations:

1. **Switch-Case (Classic)**:
   - **Pattern**: `switch(op) { case 1: ... case 2: ... }`
   - **Weakness**: Structurally obvious; easily reconstructed via AST.

2. **If-Else Chain (Flattened)**:
   - **Pattern**: `if(op == 1) ... else if(op == 2) ...` (often nested or using binary search).
   - **Weakness**: High code volume, lower execution efficiency, but functionality is identical to switch.

3. **Direct Threading / Lookup Table (Advanced)**:
   - **Pattern**: `handlers[op](context)` or `funcs[instruction & 255].apply(...)`.
   - **Stealth**: No `switch`, no `if`. Just a single array access and function call.
   - **Weakness**: Requires maintaining a large function array in memory.

#### 🎯 Locate the VM Core via Runtime Behavior

**Do not search for keywords.** Locate the VM based on **Runtime Behavior**.

**Feature 1: Massive Instruction Set (Bytecode)**
- Look for unusually long `Strings` (Base64) or `Integer Arrays` (Hex) in the source code.

**Feature 2: Virtual Instruction Pointer (VIP/PC)**
- Inside a loop, identify a variable that strictly increments or jumps (e.g., `pc++`, `pc += 3`, `pc = target`).

**Feature 3: Virtual Stack/Register Context**
- An array defined *outside* the loop that is frequently accessed *inside* the loop using `push`, `pop`, or `stack[sp--]`.

**Universal Location Strategy (Timeline Analysis)**:
1. Record a session in the Chrome DevTools **Performance** tab.
2. Find the function with the longest "Self Time" (usually a solid yellow bar).
3. Dive into that function and look for the **innermost loop structure** (whether it's `for`, `while`, `do-while`, or recursive calls).

#### 🔍 Instrumentation Strategy

The injection point depends on the Dispatcher structure.

**Scenario A: Classic Switch or If-Else**
```javascript
// Pseudo-code
while (true) { // or for(;;)
    var op = bytecode[pc++]; // <--- GOLDEN POINT: Fetch
    // INJECT HERE: log(pc, op, stack_snapshot)
    
    if (op == 1) { ... }
    else if (op == 2) { ... }
}
```

**Scenario B: Function Array (Lookup Table)**
```javascript
// Pseudo-code
var op = bytecode[pc++];

// Original: handlers[op](ctx);

// INJECTED:
(function(){
    console.log(`[VM] PC:${pc-1} OP:${op} Stack:${ctx.stack.slice(-5)}`);
    return handlers[op](ctx); 
})();
```

#### 🔍 Dispatcher Pattern Recognition

**VM Dispatcher 是 JSVMP 的核心循环，负责读取 opcode 并分发到对应 handler。**

#### Common Dispatcher Patterns

| Pattern | Structure | Example |
|---------|-----------|---------|
| **while-switch** | `while(1) { switch(op) {...} }` | 经典模式 |
| **for-switch** | `for(;;) { switch(op) {...} }` | 等价无限循环 |
| **for-if-chain** | `for(;;) { if(op<X) {...} else {...} }` | 二分查找式 |
| **while-if-chain** | `while(1) { if(op===0){...} else if... }` | 线性查找 |
| **recursive** | `function d() { ... d() ... }` | 递归调度 |

#### 🎯 Dispatcher 识别特征

```javascript
// Pattern 1: while-switch (经典)
while (true) {
    var op = bytecode[pc++];
    switch (op) {
        case 0: /* handler */ break;
        case 1: /* handler */ break;
    }
}

// Pattern 2: for-switch (等价)
for (;;) {
    var op = o[a++];
    switch (op) { ... }
}

// Pattern 3: for + nested if (二分查找式，如抖音 bdms)
for (;;) {
    var t = o[a++];  // 读取 opcode
    if (t < 38) {
        if (t < 19) {
            if (t < 9) {
                if (t === 0) { /* handler 0 */ }
                else if (t === 1) { /* handler 1 */ }
                // ...
            } else { /* t >= 9 && t < 19 */ }
        } else { /* t >= 19 && t < 38 */ }
    } else { /* t >= 38 */ }
}

// Pattern 4: while + if-else chain
while (running) {
    var op = code[ip++];
    if (op === 0) { ... }
    else if (op === 1) { ... }
    else if (op === 2) { ... }
}
```

#### 🔎 Search Patterns for Dispatcher

```bash
# 查找无限循环结构
rg "for\s*\(\s*;;\s*\)" source/*_beautified.js -n
rg "while\s*\(\s*(true|1|!0)\s*\)" source/*_beautified.js -n

# 查找 opcode 读取模式 (数组索引递增)
rg "\w+\[\w+\+\+\]" source/*_beautified.js -n -A 3

# 查找嵌套 if 结构 (二分查找式)
rg "if\s*\(\w+\s*<\s*\d+\)" source/*_beautified.js -n

# 查找 switch 语句
rg "switch\s*\(" source/*_beautified.js -n

# AST pattern (sg) - 查找 for(;;) 循环
sg -p 'for (;;) { $$$BODY }' source/*_beautified.js
```

#### ⚠️ Dispatcher 识别要点

1. **循环类型不重要** — `while(1)`, `for(;;)`, `while(!0)` 都是无限循环
2. **关键是 opcode 读取** — 寻找 `arr[index++]` 或 `arr[index]; index++` 模式
3. **分发方式多样** — switch、if-else chain、嵌套 if (二分) 都是有效分发
4. **嵌套 if 是优化** — 二分查找比线性 switch 更快，常见于大型 VM
5. **handler 内联 vs 数组** — handler 可能内联在 dispatcher 中，或存储在函数数组中

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

#### 🔬 Smart Tracing & Analysis

Logging simple Opcodes is often insufficient. You must record **Side Effects**.

**Recommended Log Format**:
```json
{
  "PC": 1024,
  "OP": 35,
  "Stack_Top": [10, 20], 
  "Action": "Unknown" 
}
```

**Technique: Differential Analysis**
1. Input `AAAA` → Run → Save `trace_A.log`
2. Input `AAAB` → Run → Save `trace_B.log`
3. **Compare**: The first line where the logs diverge is exactly where the **input is read** and **processed**.

#### 🔄 Reconstruction Strategy

**Phase 4a: Identify Control Flow (Jumps)**
In a VM, `if-else` logic usually manifests as manipulating the `PC`.
- **JUMP**: `PC` changes abruptly (not `+1` or `+instruction_length`).
- **CONDITIONAL JUMP (JZ/JNZ)**: `if (Stack.pop() == true) PC = target`.

**Phase 4b: Identify Cryptography (Bitwise Signatures)**
Standard crypto algorithms rely on bitwise operations. Search your logs for:
- **Hash Signatures**: `>>> 0` (Unsigned Right Shift), `& 0xFFFFFFFF`.
- **Encryption (AES/DES)**: Frequent `XOR` operations and S-Box lookups (manifests as `Array[Index]` reads).

**Phase 4c: Handling Nested VMs**
Advanced protectors (e.g., Akamai) may nest VMs.
- **Symptom**: The decoded Opcode instruction seems to be manipulating *another* Bytecode array.
- **Solution**: Ignore the outer interpreter. Focus on the data flow of the **inner** VM.

#### 📝 Python Implementation Example

Your goal is to write a Python emulator, not to beautify the JS.

```python
class SimpleVM:
    def __init__(self, bytecode):
        self.pc = 0
        self.bytecode = bytecode
        self.stack = []

    def step(self):
        op = self.bytecode[self.pc]
        self.pc += 1
        
        if op == 0x01: # PUSH
            val = self.bytecode[self.pc]
            self.stack.append(val)
            self.pc += 1
        elif op == 0x02: # ADD
            b = self.stack.pop()
            a = self.stack.pop()
            self.stack.append(a + b)
        elif op == 0x03: # JNZ (Jump if Not Zero)
            target = self.bytecode[self.pc]
            cond = self.stack.pop()
            if cond != 0:
                self.pc = target
            else:
                self.pc += 1
```

---

## Phase 3: Disassembly → Low-Level IR

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

## Phase 4: Stack Analysis → Mid-Level IR

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

## Phase 5: CFG + Data-Flow → High-Level IR

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

## Phase 6: Code Generation → JavaScript AST

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

**Input**: Minified/obfuscated JS with JSVMP

| Phase | Output |
|-------|--------|
| 1 (Preprocess) | `main_beautified.js` → `main_deob.js` |
| 2 (Extract) | bytecode.json, constants, handlers |
| 3 (LIR) | `0000: PUSH_CONST #0` / `0003: JZ @6` |
| 4 (MIR) | `t0 = window.document` / `if (!t0) goto @6` |
| 5 (HIR) | `if (t0) { return "found" } else { return "not found" }` |
| 6 (JS) | `function decompiled() { let t0 = window.document; if (t0) ... }` |

---

## Troubleshooting

| Issue | Phase | Solution |
|-------|-------|----------|
| Minified code | 1 | Run js-beautify first |
| String array obfuscation | 1 | Extract array, inline strings |
| Control flow flattening | 1 | AST reconstruction |
| Unknown opcode | 3 | Analyze handler function statically, compare with known patterns |
| Stack imbalance | 4 | Check stackEffect definitions |
| Wrong CFG edges | 5 | Verify jump target resolution |
| Missing variables | 5 | Check def-use chain construction |
| Nested functions | 3-6 | Recursively process with bytecode slice |

---

## ⚠️ OUTPUT LIMITS

| Command | Limit |
|---------|-------|
| `rg` | `-M 200 -m 10` |
| `sg --json` | `\| head -c 3000` |
| `head/tail` | `-c 2000` or `-n 50` |
| `cat` on JS | ❌ NEVER |

```bash
# ❌ FORBIDDEN
node -e "..."
python -c "..."

# ✅ USE scripts/
node scripts/disassemble.js
node scripts/decompile.js
```

---

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need to analyze handler function."
- **Stack Imbalance**: "🆘 Stack imbalance, need to check stackEffect definitions."
- **Complex Control Flow**: "🆘 Control flow too complex, need assistance."
- **Heavy Obfuscation**: "🆘 Obfuscation too complex, need assistance."
- **Stuck**: "🆘 Decompilation blocked, need assistance."

---

## TOOL QUICK REF

| Task | Tool | Priority |
|------|------|----------|
| **Code search** | `sg`, `rg` on local files | 1️⃣ PRIMARY |
| **Read function** | `rg -A 30` or `head` on deobfuscated | 1️⃣ PRIMARY |
| **Beautify code** | `npx js-beautify` | Phase 1 mandatory |
| **AST analysis** | Write script with `@babel/parser` | Phase 2+ |
| **Pattern matching** | `sg` with AST patterns | All phases |

### Static Analysis Workflow
```
Download → Beautify → Check obfuscation → Deobfuscate (if needed)
                                              ↓
                      sg/rg search → Trace VM structure → Extract bytecode
                                                              ↓
                                    Write scripts → Disassemble → Decompile
```

---

## ⛔ RULES

- **STATIC ANALYSIS FIRST**: Always use local file analysis before any browser interaction
- **LOCAL FILES FIRST**: Always check `output/*_deobfuscated.js` and `source/*_beautified.js`
- **BEAUTIFY FIRST**: Never analyze minified code — run js-beautify as Phase 1 first step
- NEVER `read_file` on .js files — use `head`, `sg`, `rg`, or line-range
- **PHASE 1 GATE**: If obfuscation detected, MUST `read_file("skills/js_deobfuscation.md")` before deobfuscation
- **VM is a State Machine**: Focus on data flow (Stack/Context changes), not control flow syntax
- **Dispatcher is Key**: Locate via Performance tools, not keywords. Can be switch/if-else/lookup table
- **Differential Analysis**: Compare traces with different inputs to find fork points
- **Verify Opcode Semantics**: Never guess — use tracing and differential analysis
- Always verify opcode semantics before proceeding to next phase
- Keep intermediate outputs (LIR/MIR/HIR) for debugging
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include file:line references** — future sessions depend on this
- **LOG every session** — append to Session Log section
- **MINIMIZE BROWSER USE** — browser is last resort, not primary tool
