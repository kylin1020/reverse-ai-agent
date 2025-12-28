---
inclusion: manual
---

# JSVMP Decompilation (State-Driven)

> **⚠️ RULE #1**: Never use `read_file/readFile`, `cat`, `head`, `tail`, `grep`, or `rg`. ALWAYS use Smart-FS tools.

> **⚠️ RULE #2**: Use `find_jsvmp_dispatcher` for VM detection. NEVER use regex.

> **⚠️ RULE #3**: **ALL file paths MUST be ABSOLUTE**. Run `pwd` first, then use full paths everywhere.

> **⚠️ RULE #4**: STATIC EXTRACTION FIRST. Browser is LAST RESORT.

---

## 🗂️ WORKSPACE INIT (MANDATORY FIRST STEP)

**On session start, run `pwd` and use absolute paths for ALL operations:**

```javascript
// ✅ CORRECT
read_code_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js" })
fsWrite({ path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/raw/bytecode.json" })
invokeSubAgent({ prompt: `Workspace: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/` })
```

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

---

## 🛑 SAFETY PROTOCOL (READ FIRST)

### ⚠️ MANDATORY FIRST ACTION ON EVERY TURN
```
1. Read TODO.md → Find FIRST unchecked [ ] task
2. Check: Does it have 🤖 prefix?
   - YES → STOP. Call invokeSubAgent(). Do NOT proceed manually.
   - NO  → Execute the task yourself.
3. After task completion:
   a. Read NOTE.md → Check "Pending Discoveries" section
   b. If new discoveries exist → Add corresponding tasks to TODO.md
   c. Clear processed items from "Pending Discoveries"
   d. Update TODO.md [x] → STOP turn.
```

### 🚫 FORBIDDEN ACTIONS
1. **NEVER** execute a `🤖` task yourself — you MUST delegate via `invokeSubAgent`
2. **NEVER** skip ahead to later tasks — complete tasks IN ORDER
3. **NEVER** use browser tools for `🤖` reconnaissance tasks
4. **NEVER** analyze VM handlers if Phase 1 (Beautify/Deobfuscate) is unchecked

### ✅ YOUR RESPONSIBILITIES (Main Agent)
- Create/update TODO.md and NOTE.md
- Write deobfuscation scripts (transforms/*.js)
- Write Python implementation (lib/*.py)
- Make Phase Gate decisions
- Communicate with user

### ❌ SUB-AGENT RESPONSIBILITIES (Delegate These)
- `🤖 Detect obfuscation patterns`
- `🤖 Locate VM dispatcher`
- `🤖 Extract bytecode/constants`
- `🤖 Trace handler functions`
- `🤖 Extract runtime values`
- `🤖 Capture real request`
- `🤖 Run tests`

### PENALTY
- If you open browser or read JS files when current task is `🤖`-prefixed → **SESSION INVALID**
- If you output analyzed code when you should delegate → **SESSION INVALID**

---

## ⛔ CRITICAL RULES

### 1. Smart-FS as DEFAULT File Access

| File Type | Capabilities |
|-----------|-------------|
| `.js`, `.ts`, `.jsx`, `.tsx` | Full: AST + Beautify + Source Map |
| `.json`, `.html`, `.xml`, `.css` | Beautify |
| Other text files | Smart truncation |

**Output format**: `[L:xxx]` = beautified line, `[Src Lx:xxx]` = original line:col (for Chrome breakpoint)

### 2. String/Array Length Limits (CRITICAL)
**NEVER output, write, or embed large strings/arrays in code or responses:**
- `read_code_smart` handles truncation automatically
- `evaluate_script` results: limit to 2000 chars (`.slice(0, 2000)`)
- Large data: save to file via `savePath` or `fs` tools

### 3. ⚠️ Large Data Extraction (STATIC FIRST)

**FORBIDDEN:**
```javascript
// ❌ NEVER DO THIS
const constants = ["str1", "str2", ... /* 1000+ items */];
fsWrite("raw/data.json", JSON.stringify(hugeArray)); // ❌ Don't embed in code
```

**Extraction Priority:**

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1️⃣ | AST Transform | Array/object is statically defined |
| 2️⃣ | Smart-FS + Script | Need to locate first, then extract |
| 3️⃣ | Browser savePath | Runtime-generated or encrypted data |
| 4️⃣ | Browser scope dump | Complex nested objects at breakpoint |

> **📚 Detailed examples**: See `#[[file:skills/jsvmp-phase-guide.md]]`

---

## 🛠️ SMART-FS TOOLKIT

**Concept**: You work with a **Virtual View**. Read `source/main.js` (minified) → Tool shows beautified view.

| Action | Tool | Usage |
|--------|------|-------|
| Read Code | `read_code_smart` | `file="source/main.js", start=1, end=50` |
| Search Text | `search_code_smart` | `file="source/main.js", query="debugger"` |
| Trace Var | `find_usage_smart` | `file="...", identifier="_0xabc", line=105` |
| Deobfuscate | `apply_custom_transform` | `target="...", script="transforms/fix.js"` |
| Find JSVMP | `find_jsvmp_dispatcher` | `filePath="source/main.js"` |

---

## 🔄 STATE PROTOCOL

### Execution Loop
1. **READ**: `TODO.md` + `NOTE.md` (create if missing)
2. **IDENTIFY**: First unchecked `[ ]` = current task
3. **CHECK**: Is current phase complete? (see Phase Gate)
4. **EXECUTE**: One step to advance
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md`
6. **PLAN**: If new discoveries → Add new tasks to TODO.md

### Phase Gate
| Phase Status | Allowed Actions |
|--------------|-----------------|
| Phase 1 incomplete | `read_code_smart` / `apply_custom_transform` ONLY |
| Phase 2 incomplete | Extract VM data ONLY |
| Phase 3 incomplete | Disassembly ONLY |
| Phase 4 incomplete | Stack analysis ONLY |
| Phase 5 incomplete | CFG/Data-flow ONLY |
| All phases done | Code generation |

---

## 📊 DYNAMIC TODO PLANNING

**TODO.md is a LIVING DOCUMENT — update it as analysis reveals new work items.**

### After each `🤖` task completes:
1. Check NOTE.md "Pending Discoveries" section
2. Convert discoveries to new TODO tasks: `- [ ] 🤖 NEW: {task} (from: {source task})`
3. Clear processed items

### Common discoveries to add:
- New param found → `- [ ] 🤖 Trace param: {name}`
- New handler found → `- [ ] 🤖 Analyze handler: {name} @ [L:line] [Src L:col]`
- Unknown opcode → `- [ ] 🤖 Trace opcode: {opcode} @ [L:line] [Src L:col]`

---

## 🌐 BROWSER AUXILIARY TOOLS

**Browser is for: validating static analysis, getting runtime values, locating hard-to-analyze code.**

| Scenario | Tool |
|----------|------|
| Locate VM Dispatcher | `find_jsvmp_dispatcher` |
| Verify Opcode | Log breakpoint |
| Get runtime values | `get_scope_variables` |
| Bypass anti-debug | `replace_script` |

### Key Technique: Locate Code Position
```javascript
// 1. Search in Virtual View
search_code_smart(file="source/main.js", query="for\\(;;\\)")
// Output: [Src L1:15847]

// 2. Set Breakpoint using [Src] coordinates
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
```

> **📚 More techniques**: See `#[[file:skills/jsvmp-phase-guide.md]]`

---

## 🤖 SUB-AGENT DELEGATION (CRITICAL)

> **RULE**: When you see `🤖` in TODO.md, you MUST call `invokeSubAgent()`. No exceptions.

### Decision Tree (Execute on EVERY turn)
1. Read TODO.md → Find first `[ ]` task
2. Does task have 🤖 prefix?
   - YES → STOP! Call `invokeSubAgent()` immediately. Do NOT read files, open browser, or do ANY analysis yourself.
   - NO → Execute task yourself
3. After completion: Update TODO.md `[x]`, then STOP

### 🚨 COMMON MISTAKE
```
❌ WRONG: See "🤖 Locate VM dispatcher" → Open browser → Analyze yourself
✅ RIGHT: See "🤖 Locate VM dispatcher" → invokeSubAgent() → Wait for NOTE.md
```

### 🚀 PARALLEL EXECUTION
Scan ALL unchecked `🤖` tasks → If no data dependency → Invoke ALL in ONE turn:
```
✅ PARALLEL: Extract bytecode + Extract constants (independent)
❌ SEQUENTIAL: Locate dispatcher → Extract handler (handler needs dispatcher)
```

### Prompt Template
```python
invokeSubAgent(
  name="general-task-execution",
  prompt="""
## 🎯 YOUR SINGLE TASK (DO NOT DEVIATE)
{exact task text from TODO.md}

## ⛔ CRITICAL CONSTRAINTS
1. **ONLY** complete the single task above
2. **STOP IMMEDIATELY** after completing this one task
3. **DO NOT** look at TODO.md or try to do other tasks
4. **DO NOT** proceed to "next steps"

## 🚫 LARGE DATA HANDLING
**NEVER write or output large constant arrays or strings directly!**
1. Use Smart-FS tools to LOCATE the data
2. Save to file: `evaluate_script(..., savePath="raw/data.json")`
3. Reference by path in NOTE.md, NOT actual contents

## 📚 MANDATORY: READ SKILL FILES FIRST!
**⚠️ Use `readFile` to read these BEFORE starting work:**
- `skills/jsvmp-phase-guide.md` - Phase workflow
- `skills/jsvmp-ir-format.md` - IR output format
- `skills/jsvmp-ir-sourcemap.md` - Source Map format
- `skills/jsvmp-decompiler.md` - Decompiler implementation

## 🗺️ SOURCE MAP REQUIREMENTS (For IR Generation Tasks)
When generating IR/ASM output, you MUST also generate a Source Map:
1. Output files: `output/{name}_disasm.asm` + `output/{name}_disasm.asm.map`
2. IR file format:
   - Clean format with `//` comments
   - Function header has `Source: L{line}:{column}`
   - **No special markers** - Source Map `irLine` IS the actual file line number
3. Source Map: One mapping entry per instruction with irLine (= actual line number), irAddr, source, breakpoint

### ⚠️ CRITICAL: Original Source Coordinates Workflow
**`find_jsvmp_dispatcher` returns BEAUTIFIED line numbers. To get ORIGINAL coordinates for Source Map, you MUST use `read_code_smart` to read the relevant code!**

**Workflow:**
1. Call `find_jsvmp_dispatcher` → Get dispatcher location (beautified line numbers)
2. Use `read_code_smart` to read the relevant code sections → Output includes `[Src Lx:xxx]` markers
3. Extract ORIGINAL coordinates from `[Src Lx:xxx]` in `read_code_smart` output
4. Use these ORIGINAL coordinates in Source Map `source.line` and `source.column`

```javascript
// Step 1: find_jsvmp_dispatcher returns beautified lines
// dispatcher at [L:150] (beautified)

// Step 2: read_code_smart to get original coordinates
read_code_smart(file="source/main.js", start=148, end=155)
// Output:
// [L:148] [Src L1:28400]  function interpret() {
// [L:149] [Src L1:28420]    var pc = 0;
// [L:150] [Src L1:28456]    for (;;) {
//                           ^^^^^^^^^ ORIGINAL coordinate for breakpoint!

// Step 3: Extract and use in Source Map
{
  "source": { 
    "line": 1,      // ← From [Src L1:xxx] - the line number
    "column": 28456 // ← From [Src L1:28456] - the column number
  }
}
```

**Why This Matters:**
- Minified JS files are typically 1 line with thousands of columns
- Chrome DevTools breakpoints require exact `lineNumber` + `columnNumber`
- Using beautified line numbers will set breakpoints at wrong locations
- **ALWAYS** use `read_code_smart` to verify and extract original coordinates

4. **CRITICAL**: Breakpoint conditions MUST use actual variable names from `find_jsvmp_dispatcher`:
   - Get `instructionPointer`, `bytecodeArray`, `stackPointer`, `virtualStack`, `scopeChain`, `constantsPool` names
   - Build condition like: `{ip} === {pc} && {bytecode}[{ip}] === {opcode}`
   - Variable names vary per target (e.g., `a2`, `_0x1234`, `ip`, etc.)
5. **watchExpressions**: Generate for each instruction to enable VM state extraction during debugging:
   - Standard watches: `$pc`, `$opcode`, `$stack[0..2]`, `$sp`
   - Opcode-specific: `$scope[depth]` for scope ops, `$fn`/`$this`/`$args` for CALL/NEW, `$const[x]` for constant ops
   - See `#[[file:skills/jsvmp-ir-sourcemap.md]]` Section 3.4 for details

## Context
- Domain: {domain}
- Workspace: artifacts/jsvmp/{domain}/
- NOTE.md: artifacts/jsvmp/{domain}/NOTE.md

## Instructions
1. Read `skills/sub_agent.md` first (tool rules)
2. Execute ONLY the task stated above
3. Write findings to NOTE.md with [L:line] [Src L:col] coordinates
4. **FLAG NEW DISCOVERIES** in "Pending Discoveries" section
5. **STOP** — do not continue to other work

## 🚫 FORBIDDEN ACTIONS
- Reading TODO.md
- Using `read_file`/`cat`/`grep`/`rg` (use Smart-FS tools)
- Writing large arrays/strings directly
- Using evaluate_script without savePath for large data
- Continuing work after completing the assigned task
""",
  explanation="Delegate 🤖 task: {task summary}"
)
```

### Responsibility Matrix

| Task Type | Who Executes | Tools Allowed |
|-----------|--------------|---------------|
| `🤖 Detect...` | Sub-agent | Browser, Smart-FS, `find_jsvmp_dispatcher` |
| `🤖 Locate...` | Sub-agent | Smart-FS, `find_jsvmp_dispatcher`, Browser |
| `🤖 Extract...` | Sub-agent | Smart-FS, Browser |
| `🤖 Capture...` | Sub-agent | Browser network |
| `🤖 Run tests...` | Sub-agent | Bash, Python |
| Write deobfuscation script | Main agent | fsWrite |
| Apply deobfuscation | Main agent | apply_custom_transform |
| Python implementation | Main agent | fsWrite |
| Update TODO/NOTE | Main agent | fsWrite, strReplace |

---

## 📋 TODO.md 模板

> **`🤖` = 委托给子代理执行 `invokeSubAgent`。子代理将发现写入 NOTE.md。**

```markdown
# JSVMP 反编译计划: {target}

## 目标
- URL: {target_url}
- API: (待发现)
- 参数: (待发现)

## 阶段 1: 代码预处理
- [ ] 初始化工作区（创建目录）
- [ ] 🤖 浏览器侦察: 访问 URL，捕获请求，识别 API 和参数，下载 JS 文件 → NOTE.md
- [ ] 🤖 检测混淆类型 → NOTE.md
- [ ] 编写去混淆脚本 (Babel Visitor)
- [ ] 应用去混淆: `apply_custom_transform` → output/*_deob.js

## 阶段 2: VM 结构分析 (⛔ 需要完成阶段 1)
> **📚 参考**: `#[[file:skills/jsvmp-decompiler.md]]` 第 4 节
- [ ] 🤖 定位 VM 调度器 (`find_jsvmp_dispatcher`) → NOTE.md
- [ ] 🤖 分析调度器结构 → NOTE.md
- [ ] 🤖 定位字节码来源 → NOTE.md
- [ ] 🤖 分析字节码格式 → NOTE.md
- [ ] 提取/解码字节码 → raw/bytecode.json (⚠️ 禁止直接输出)
- [ ] 🤖 定位常量池 → NOTE.md
- [ ] 提取常量池 → raw/constants.json (⚠️ 禁止直接输出)
- [ ] 🤖 分析操作码语义 → NOTE.md

## 阶段 3-6: 反编译流水线
> **📚 参考**: `#[[file:skills/jsvmp-decompiler.md]]` + `#[[file:skills/jsvmp-ir-format.md]]` + `#[[file:skills/jsvmp-ir-sourcemap.md]]`
- [ ] 🤖 编写反汇编器 (lib/decompiler.js)，生成 LIR + Source Map: output/*_disasm.asm + output/*_disasm.asm.map
- [ ] 验证 Source Map: 测试断点映射是否正确
- [ ] 🤖 栈分析 → output/*_mir.txt
- [ ] 🤖 CFG 分析 → output/*_hir.txt
- [ ] 🤖 代码生成 → output/*_decompiled.js

## 阶段 7-9: 实现与验证
- [ ] Python 骨架代码 (lib/*.py)
- [ ] 核心算法实现
- [ ] 🤖 捕获真实请求 → raw/reference.txt
- [ ] 🤖 单元测试: 对比生成结果与参考值
- [ ] 🤖 集成测试: 发起真实 API 请求
```

---

## 📝 NOTE.md 模板

```markdown
## 会话日志
### [YYYY-MM-DD HH:MM] 摘要
**任务**: 当前任务
**发现**: ...
**新增待办**: 🆕 需要追踪参数 `x` / 🆕 需要分析处理器 `y`

## 参数追踪
| 参数 | 生成器 | 状态 |
|------|--------|------|
| `_signature` | (待分析) | 🔍 |

## VM 结构
- 调度器: [L:line] [Src L1:col]
- 处理器表: [L:line] [Src L1:col]

## 待处理发现
> 主代理: 转换为 TODO 任务后删除
- [ ] 🆕 {描述} @ [L:line] [Src L:col] (来源:col] (from: {task})
```

---

## Phase 8-9: Validation Guide

### Phase 8: Validation
**⚠️ Validation is MANDATORY — NEVER skip this phase**

1. **Capture Reference**: Sub-agent captures real request with known input/output
2. **Unit Test**: Generate signature with same input → must match exactly
3. **Integration Test**: Make actual API request → must return 200 OK

### Phase 9: Verification Loop
1. Run tests
2. Pass? → Write README.md → Done ✅
3. Fail? → Debug: What's different?
   - Algorithm error → Phase 3-6
   - Implementation error → Phase 7

**Debug Checklist:**
- [ ] Byte-by-byte comparison
- [ ] Check encoding: UTF-8, URL encoding, Base64 padding
- [ ] Check byte order: little-endian vs big-endian
- [ ] Check timestamp: is it time-sensitive?
- [ ] Check random values: is there a nonce/salt?

---

## 🔧 IR Debugging Tools

Use IR debugger tools to debug JSVMP at IR level instead of raw JS. Requires Source Map (`.asm.map`).

### Workflow
```javascript
// 1. Load IR source map (can be done before script loads)
load_ir_source_map(sourceMapPath="output/main_disasm.asm.map")
// Returns: irId

// 2. Set breakpoint at IR line (will resolve when script loads)
ir_set_breakpoint(irId="...", irLine=15)

// 3. Trigger action in browser, then get IR state when paused
ir_get_state(irId="...")  // irId is optional - auto-detected from paused location
// Returns: $pc, $opcode, $stack[0..2], $sp, IR context lines

// 4. Step/resume as needed
step_over() / step_into() / resume_execution()

// 5. Cleanup
ir_clear_breakpoints(irId="...") // or unload_ir_source_map(irId="...")
```

### Key Tools
| Tool | Purpose |
|------|---------|
| `load_ir_source_map` | Load source map, returns irId for subsequent operations |
| `ir_set_breakpoint` | Set breakpoint at IR line (resolves when script loads) |
| `ir_get_state` | Get VM state in IR form when paused (irId optional, auto-detected) |
| `ir_remove_breakpoint` | Remove single IR breakpoint |
| `ir_clear_breakpoints` | Clear all breakpoints for an irId |
| `list_ir_source_maps` | List all loaded source maps with irId, paths, breakpoint counts |
| `unload_ir_source_map` | Unload source map and clear all its breakpoints |

### Integration with Standard Debugger
- `get_debugger_status` now shows IR context when paused at an IR breakpoint (auto-detected)
- `list_breakpoints` shows IR metadata (irId, irLine, opcode) for IR breakpoints

---

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need handler analysis."
- **Stack Imbalance**: "🆘 Stack imbalance at PC {pc}."
- **Complex Control Flow**: "🆘 Control flow too complex."
- **CAPTCHA**: "🆘 Encountered CAPTCHA, please complete manually."
- **Login**: "🆘 Please log in."
- **Trigger**: "🆘 Please click button to trigger request."

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| File too big | `read_code_smart` handles this. Do NOT use `read_file`. |
| Variable soup | Use `find_usage_smart(..., line=X)` to trace specific scope. |
| Line mismatch | Trust the `[L:line] [Src L:col]` in Smart Tool output. |
| Unknown opcode | Trace handler using `set_breakpoint` at `[Src]` location. |
| Can't find dispatcher | Use `find_jsvmp_dispatcher` instead of regex. |

---

## ⛔ FINAL RULES CHECKLIST

### Before EVERY action:
- [ ] Did I read TODO.md first?
- [ ] Is the current task marked with `🤖`?
- [ ] If `🤖`: Am I calling `invokeSubAgent()`? (If not, STOP!)
- [ ] If not `🤖`: Am I allowed to do this task myself?

### After EVERY task completion:
- [ ] Did I check NOTE.md for "Pending Discoveries"?
- [ ] Did I convert pending discoveries to TODO.md tasks?
- [ ] Did I mark the current task `[x]`?

### Absolute Rules
- **🤖 = DELEGATE**: See `🤖`? Call `invokeSubAgent()`. Period.
- **DYNAMIC PLANNING**: After each task, check for new discoveries and update TODO.md
- **SMART-FS DEFAULT**: Use `read_code_smart`/`search_code_smart` for ALL file reading
- **STATIC EXTRACTION FIRST**: For bytecode/constants, use AST transform before browser
- **NEVER EMBED LARGE DATA**: Save arrays/strings to `raw/*.json`, never write directly
- **PHASE 1 GATE**: MUST complete deobfuscation before ANY VM analysis
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [L:line] [Src L:col] references** — future sessions depend on this
