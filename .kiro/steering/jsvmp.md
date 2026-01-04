---
inclusion: manual
---

# JSVMP Decompilation (State-Driven)

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

> **⚠️ RULE #1**: Never use `read_file/readFile`, `cat`, `head`, `tail`, `grep`, or `rg`. ALWAYS use Smart-FS tools.

> **⚠️ RULE #2**: Use `find_jsvmp_dispatcher` for VM detection. NEVER use regex.

> **⚠️ RULE #3**: **ALL file paths MUST be ABSOLUTE**. Run `pwd` first, then use full paths everywhere.

> **⚠️ RULE #4**: STATIC EXTRACTION FIRST. Browser is LAST RESORT.

> **⚠️ RULE #5**: **NEVER use regex to parse IR files** (`.vmasm`, `.vmir`, `.vmhir`). ALWAYS use Chevrotain parser from `jsvmp-ir-extension/src/utils/`.

---

## 🗂️ WORKSPACE STRUCTURE

```
artifacts/jsvmp/{domain}/
├── source/         # Original JS (from browser download)
├── output/         # ALL generated files (*_deob.js, *.vmasm, *.vmir, *.vmhir, etc.)
├── transforms/     # Babel transform scripts
├── raw/            # Extracted data (bytecode.json, constants.json)
├── lib/            # Python implementation
├── tests/          # Test files (test_*.py)
└── TODO.md, NOTE.md, README.md
```

**File Placement Rules:**
- `source/` → Original JS only
- `output/` → Deobfuscated JS, IR/ASM, decompiled JS
- `tests/` → All test files (NOT in `lib/`)

---

## 🗂️ WORKSPACE INIT (MANDATORY FIRST STEP)

**On session start, run `pwd` and use absolute paths for ALL operations:**

```javascript
// ✅ CORRECT - ALWAYS use absolute paths like these:
read_code_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js" })
search_code_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/output/main_deob.js", query: "debugger" })
find_usage_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/output/main_deob.js", identifier: "_0xabc", line: 105 })
find_jsvmp_dispatcher({ filePath: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/output/main_deob.js" })
apply_custom_transform({ target_file: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js", script_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/transforms/fix.js" })
invokeSubAgent({ prompt: `Workspace: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/` })

// ❌ WRONG - NEVER use relative paths:
read_code_smart({ file_path: "source/main.js" })  // ❌ WILL FAIL
```

---

## 🛑 SAFETY PROTOCOL (READ FIRST)

### ⚠️ MANDATORY FIRST ACTION ON EVERY TURN
```
0. IF this is a new session → readFile("skills/sub_agent.md") + readFile("skills/sub-agent-jsvmp.md")
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

> **📚 Detailed examples**: See `skills/jsvmp-phase-guide.md`

---

## 🛠️ SMART-FS TOOLKIT

**Concept**: You work with a **Virtual View**. Read `source/main.js` (minified) → Tool shows beautified view.

**⚠️ ALL file_path/filePath parameters MUST be ABSOLUTE paths starting with `/`**

| Action | Tool | Usage (ABSOLUTE PATH REQUIRED) |
|--------|------|--------------------------------|
| Read Code | `read_code_smart` | `file_path="/abs/path/source/main.js", start_line=1, end_line=50` |
| Search Text | `search_code_smart` | `file_path="/abs/path/source/main.js", query="debugger"` |
| Trace Var | `find_usage_smart` | `file_path="/abs/path/source/main.js", identifier="_0xabc", line=105` |
| Deobfuscate | `apply_custom_transform` | `target_file="/abs/path/source/main.js", script_path="/abs/path/transforms/fix.js"` |
| Find JSVMP | `find_jsvmp_dispatcher` | `filePath="/abs/path/source/main.js"` ⚠️ **MUST VERIFY** |

### ⚠️ CRITICAL: Verify `find_jsvmp_dispatcher` Results

**`find_jsvmp_dispatcher` is AI-powered and OFTEN returns WRONG coordinates. ALWAYS verify!**

#### 🚨 THE MOST COMMON BUG: Beautified vs Original Coordinates

**`find_jsvmp_dispatcher` often returns BEAUTIFIED line numbers (e.g., `line=5866`) instead of ORIGINAL coordinates!**

**How to detect this bug:**
```
find_jsvmp_dispatcher output: loop_entry line=5866, column=0
                                         ^^^^
                                         This looks like a beautified line number!
                                         
Minified files are typically 1-10 lines. If line > 10, it's probably WRONG.
```

**The CORRECT format for minified files:**
```
@loop_entry line=2, column=131626    ← Original: line 2, column 131626
                                       (minified JS is usually on line 1 or 2)
```

#### 📋 MANDATORY Verification Workflow

```javascript
// STEP 1: Call find_jsvmp_dispatcher
find_jsvmp_dispatcher({ filePath: "/abs/path/source/main.js" })
// Output example: loop_entry line=5866, column=0

// STEP 2: IMMEDIATELY check if coordinates look suspicious
// ⚠️ If line > 10 for a minified file → LIKELY WRONG (beautified line number)

// STEP 3: Use search_code_smart to find the ACTUAL code pattern
search_code_smart({ 
  file_path: "/abs/path/source/main.js", 
  query: "var t = o\\[a\\+\\+\\]"  // Search for opcode read pattern
})

// STEP 4: Read the [Src L:col] from search results
// Example output:
//   5866 L2:131626   var t = o[a++];
//        ^^^^^^^^^^
//        [Src L2:131626] = ORIGINAL coordinates: line=2, column=131626
//   5866
//   ^^^^
//   This is the BEAUTIFIED line number (WRONG for @loop_entry)

// STEP 5: Extract CORRECT coordinates from [Src L:col]
// Format: L{line}:{column}
// L2:131626 → line=2, column=131626

// STEP 6: Write to vmasm with CORRECT coordinates
@loop_entry line=2, column=131626    ← CORRECT (from [Src L:col])
// NOT: @loop_entry line=5866, column=0  ← WRONG (beautified line)
```

#### 🔍 How to Read Smart-FS Output

```
Output format:
  {beautified_line} L{original_line}:{original_column}   {code}

Example:
  5866 L2:131626              var t = o[a++];
  ^^^^                        ^^^^^^^^^^^^^^
  |                           Code content
  |
  +-- Beautified line number (for reading, NOT for breakpoints)
  
       L2:131626
       ^^  ^^^^^^
       |   |
       |   +-- Original column (USE THIS for @loop_entry column=)
       |
       +-- Original line (USE THIS for @loop_entry line=)
```

#### ✅ Verification Checklist (MANDATORY)

Before writing ANY coordinates to `.vmasm`:

- [ ] **LINE CHECK**: Is `line` ≤ 10 for minified files? (If > 10, probably beautified line)
- [ ] **COLUMN CHECK**: Is `column` > 0 for minified files? (column=0 is suspicious)
- [ ] **SEARCH VERIFY**: Used `search_code_smart` to find actual `[Src L:col]`?
- [ ] **PATTERN CHECK**: Code at location matches expected pattern?
  - `@dispatcher`: `for(;;)` loop
  - `@loop_entry`: opcode read (e.g., `var t = o[a++]`)
  - `@breakpoint`: right after opcode read
  - `@global_bytecode var=X`: X is actual bytecode variable
  - `@bytecode_transform expr=...`: extracts pure bytecode from mixed variable
  - `@reg ip=X, bc=Y, ...`: X, Y match actual VM register names

#### 🛠️ Quick Fix Template

If `find_jsvmp_dispatcher` returns wrong coordinates:

```javascript
// 1. Search for the actual pattern
search_code_smart({ file_path: "...", query: "var t = o\\[a\\+\\+\\]" })

// 2. From output like "5866 L2:131626 var t = o[a++];"
//    Extract: line=2, column=131626

// 3. Update vmasm with CORRECT coordinates:
@loop_entry line=2, column=131626
```

#### ❌ Common Mistakes

| Wrong | Correct | Why |
|-------|---------|-----|
| `line=5866, column=0` | `line=2, column=131626` | 5866 is beautified line, not original |
| `line=1, column=0` | `line=2, column=131626` | column=0 is suspicious for minified code |
| Using `[L:5866]` | Using `[Src L2:131626]` | `[L:]` is beautified, `[Src L:col]` is original |

**Example with real workspace:**
```javascript
// After running pwd → /Users/xxx/reverse-ai-agent
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com";

read_code_smart({ file_path: `${WORKSPACE}/source/main.js`, start_line: 1, end_line: 50 })
search_code_smart({ file_path: `${WORKSPACE}/source/main.js`, query: "for\\(;;\\)" })
find_usage_smart({ file_path: `${WORKSPACE}/source/main.js`, identifier: "_0xabc", line: 105 })
find_jsvmp_dispatcher({ filePath: `${WORKSPACE}/source/main.js` })
apply_custom_transform({ target_file: `${WORKSPACE}/source/main.js`, script_path: `${WORKSPACE}/transforms/fix.js` })
```

---

## 🧩 IR PARSER (Chevrotain)

> **⛔ NEVER regex parse `.vmasm`/`.vmir`/`.vmhir`. Use `jsvmp-ir-extension/src/utils/vmasm-*.ts`**

```javascript
// 编译后路径: jsvmp-ir-extension/out/utils/
const { VmasmLexer } = require('../../jsvmp-ir-extension/out/utils/vmasm-lexer');
const { vmasmParser } = require('../../jsvmp-ir-extension/out/utils/vmasm-parser');
const { vmasmVisitor } = require('../../jsvmp-ir-extension/out/utils/vmasm-visitor');

function parseVmasm(content) {
    const lexResult = VmasmLexer.tokenize(content);
    vmasmParser.input = lexResult.tokens;
    return vmasmVisitor.visit(vmasmParser.program());
}
// → { format, domain, registers, constants[], instructions[], scopeSlots[], lineToAddr, addrToLine }
```

> **📚 详细 AST 结构**: See `skills/jsvmp-ir-parser.md`

---

## 🔧 @reg 变量用于调试表达式

`@reg` 指令定义了 VM 运行时变量的映射，用于生成正确的调试表达式：

```vmasm
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s
```

### 调试表达式生成规则

| 访问类型 | 表达式格式 | 示例 (@reg scope=s, const=Z) |
|----------|-----------|------------------------------|
| 作用域槽位 | `{scope}[depth][index]` | `s[0][12]` |
| 常量池 | `{const}[index]` | `Z[132]` |
| 栈顶 | `{stack}[{sp}-1]` | `v[p-1]` |
| 当前指令 | `{bc}[{ip}]` | `o[a]` |

### VSCode Extension Hover Provider

**作用域引用悬停** (LOAD_SCOPE, STORE_SCOPE, LOAD_SCOPE_REF):
```
Scope Reference: s[0][8]
Variable Name: result (if @scope_slot mapping exists)
Debug Expression: s[0][8]
```

**K_Reference 悬停** (K[n]):
```
Constant K[132]
Type: String
Value: "window"
Debug Expression: Z[132]
```

### @scope_slot 指令 (可选)

用于映射作用域槽位到原始 JS 变量名：

```vmasm
@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=8, name="result", first_use="STORE_SCOPE at 0x0010"
```

当悬停在 `LOAD_SCOPE 0 8` 时，Extension 会显示映射的变量名 "result"。

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
// 1. Search in Virtual View (ABSOLUTE PATH!)
search_code_smart({ file_path: "/abs/path/source/main.js", query: "for\\(;;\\)" })
// Output: [Src L1:15847]

// 2. Set Breakpoint using [Src] coordinates
set_breakpoint({ urlRegex: ".*main.js.*", lineNumber: 1, columnNumber: 15847 })
```

> **📚 More techniques**: See `skills/jsvmp-phase-guide.md`

---

## 🤖 SUB-AGENT DELEGATION (CRITICAL)

> **RULE**: When you see `🤖` in TODO.md, you MUST call `invokeSubAgent()`. No exceptions.

### Decision Tree (Execute on EVERY turn)
1. Read TODO.md → Find ALL unchecked `[ ] 🤖` tasks in current phase
2. Analyze dependencies between tasks
3. **INVOKE ALL INDEPENDENT TASKS IN PARALLEL** (single turn, multiple `invokeSubAgent` calls)
4. Wait for all sub-agents to complete → Check NOTE.md for results
5. Update TODO.md `[x]` for completed tasks

### � PARALLEML EXECUTION (MANDATORY)

**⚠️ ALWAYS maximize parallelism! Sub-agents run concurrently — use this!**

**Dependency Analysis:**
```
Independent (✅ PARALLEL):
- Tasks that read different files
- Tasks that write to different output files
- Tasks that don't need each other's results

Dependent (❌ SEQUENTIAL):
- Task B needs Task A's output (e.g., "Extract handler" needs "Locate dispatcher")
- Task B reads file that Task A writes
```

**Example - Phase 2 Parallel Execution:**
```javascript
// ✅ CORRECT: Invoke ALL independent tasks in ONE turn
// These 4 tasks can run in parallel:
invokeSubAgent({ prompt: "🤖 定位 VM 调度器..." })
invokeSubAgent({ prompt: "🤖 定位字节码来源..." })
invokeSubAgent({ prompt: "🤖 定位常量池..." })
invokeSubAgent({ prompt: "🤖 分析操作码语义..." })

### 🚨 COMMON MISTAKES
```
❌ WRONG: See "🤖 Locate VM dispatcher" → Open browser → Analyze yourself
✅ RIGHT: See "🤖 Locate VM dispatcher" → invokeSubAgent() → Wait for NOTE.md

✅ RIGHT: Invoke ALL independent sub-agents in ONE turn (parallel)
```

### Prompt Template
```python
invokeSubAgent(
  name="general-task-execution",
  prompt="""
## 🎯 TASK
{exact task text from TODO.md}

## 📚 MANDATORY FIRST STEP (BEFORE ANY OTHER ACTION!)
**You MUST execute these readFile calls FIRST, before doing anything else:**
```
readFile({ path: "skills/sub_agent.md" })
readFile({ path: "skills/sub-agent-jsvmp.md" })
```
**If task involves IR/decompiler, ALSO read:**
```
readFile({ path: "skills/jsvmp-ir-format.md" })
readFile({ path: "skills/jsvmp-decompiler.md" })
```
**⛔ DO NOT PROCEED until you have read these files!**

## 📍 Context
- Domain: {domain}
- Workspace (ABSOLUTE PATH): /Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}/
- NOTE.md: artifacts/jsvmp/{domain}/NOTE.md

## ⚠️ ABSOLUTE PATH RULE (CRITICAL)
ALL Smart-FS tool calls MUST use ABSOLUTE paths:
- Source file: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}/source/main.js
- Transforms: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}/transforms/
- Output: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}/output/

Example:
```javascript
read_code_smart({{ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}/source/main.js" }})
```

## ⛔ RULES
- Complete ONLY this task, then STOP
- Write findings to NOTE.md with [L:line] [Src L:col]
- Flag new discoveries in "Pending Discoveries" section
- **NEVER use relative paths for Smart-FS tools**
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
- [ ] 🤖 检测混淆类型(不包括JSVMP) → NOTE.md
- [ ] 编写去混淆脚本 (Babel Visitor)
- [ ] 应用去混淆: `apply_custom_transform` → output/*_deob.js

## 阶段 2: VM 结构分析 (⛔ 需要完成阶段 1)
> **📚 参考**: `skills/jsvmp-decompiler.md` 第 4 节
> **⚠️ 核心原则**: 先分析代码逻辑，再提取数据。禁止猜测！
> **🚀 并行提示**: 前 3 个任务可并行执行，最后 1 个需等待前面完成
- [ ] 🤖 定位 VM 调度器 (`find_jsvmp_dispatcher`) → NOTE.md  ⚡可并行
- [ ] 🤖 **分析**字节码来源：读取代码找到字节码变量，追踪其定义 → NOTE.md  ⚡可并行
- [ ] 🤖 **分析**操作码语义：读取 switch/if-else 分支，记录每个 opcode 的实际处理逻辑 → NOTE.md  ⚡可并行
- [ ] 🤖 **根据分析结果**提取/解码字节码和常量池 → raw/bytecode.json, raw/constants.json (⏳依赖上面的分析)

## 阶段 3: 句法分析 + 中间代码生成 (LIR) - 反汇编器
> **📚 参考**: `skills/jsvmp-ir-format.md` (v1.2) + `skills/jsvmp-ir-sourcemap.md` + `skills/jsvmp-ir-parser.md`
> **⚠️ 开始此阶段前必须执行**: `readFile("skills/jsvmp-ir-format.md")` + `readFile("skills/jsvmp-decompiler.md")`
> **目标**: 将字节码转换为低级中间表示 (LIR)，保留显式栈操作
> **理论基础**: 句法分析将字节码序列解析为指令流，中间代码生成将其转换为三地址码形式
> **v1.2 格式**: 自包含 `.vmasm` 文件，内嵌常量池、寄存器映射、注入点元数据和作用域槽位映射
- [ ] 🤖 编写反汇编器 (lib/disassembler.js)
  - 输入: raw/bytecode.json + raw/constants.json + NOTE.md (VM 结构信息)
  - 输出: output/*_disasm.vmasm (LIR v1.2)
  - **v1.2 格式要求**:
    ```vmasm
    @format v1.2
    @domain {target-domain}
    @source source/{filename}.js
    @url https://*.{domain}/*/{filename}.js
    @reg ip={ip_var}, sp={sp_var}, stack={stack_var}, bc={bc_var}, storage={storage_var}, const={const_var}, scope={scope_var}
    
    ;; 注入点元数据 (用于 VSCode Extension 自动设置断点)
    @dispatcher line={src_line}, column={src_column}
    @global_bytecode var={bytecode_var}, line={src_line}, column={src_column}
    @bytecode_transform expr="{transform_expr}"
    @loop_entry line={src_line}, column={src_column}
    @breakpoint line={src_line}, column={src_column}
    
    ;; 作用域槽位映射 (可选，用于变量名推断)
    @section scope_slots
    @scope_slot depth=0, index=0, name="arguments"
    @scope_slot depth=0, index=8, name="?", first_use="STORE_SCOPE at 0x0010"
    
    @section constants
    @const K[0] = String("...")
    @const K[1] = Number(...)
    
    @section code
    @entry 0x{entry_addr}
    
    ;; v1.2 简化注释格式:
    0x0000: STORE_SCOPE        0 12            ; scope[0][12] = val
    0x0003: GET_GLOBAL         K[132]          ; window
    0x0006: GET_PROP_CONST     K[277]          ; .onwheelx
    0x0009: CALL               2               ; fn(2 args)
    ```
  - **⚠️ INJECTION POINT VALIDATION (MANDATORY)**:
    After generating vmasm, MUST verify all injection point coordinates:
    1. Use `search_code_smart` to find actual code at each location
    2. Verify `@dispatcher` points to `for(;;)` loop
    3. Verify `@global_bytecode var=X` - X must be the actual bytecode variable name
    4. Verify `@bytecode_transform expr=...` - expression must extract pure bytecode from mixed variable
    5. Verify `@loop_entry` points to opcode read (e.g., `var t = o[a++]`)
    6. Verify `@breakpoint` is right after opcode read
    7. Verify `@reg` mappings match actual VM register variables
    
    **Validation commands:**
    ```javascript
    // Verify loop_entry points to opcode read
    search_code_smart({ file_path: "source/main.js", query: "var t = o\\[a\\+\\+\\]" })
    // Check [Src L:col] matches @loop_entry coordinates
    
    // Verify global_bytecode variable
    search_code_smart({ file_path: "source/main.js", query: "z\\s*=" })
    // Check variable name and [Src L:col] match @global_bytecode
    ```
  - **v1.2 注释格式变更**:
    - 作用域指令: `; scope[0][12] = val` (具体值，非占位符)
    - GET_GLOBAL: `; window` (直接显示值)
    - GET_PROP_CONST: `; .propertyName` (带点前缀)
    - PUSH_STR: `; "stringValue"` (带引号)
    - CALL: `; fn(N args)` (简化格式，不猜测函数名)
  - 关键: 十六进制地址，类型化常量池，保留栈操作语义，包含注入点元数据

> **⚠️ IR Parsing**: Use Chevrotain for ALL IR parsing (LIR/MIR/HIR). See `skills/jsvmp-ir-parser.md`
> **📦 Parser Location**: `jsvmp-ir-extension/src/utils/vmasm-*.ts` (Lexer, Parser, Visitor)

## 阶段 4: 语义分析 + 基本块划分 (MIR) - 栈分析器
> **📚 参考**: `skills/jsvmp-decompiler.md` 第 5 节
> **⚠️ 开始此阶段前必须执行**: `readFile("skills/jsvmp-decompiler.md")` + `readFile("skills/jsvmp-ir-parser.md")`
> **目标**: 消除栈操作，构建表达式树，划分基本块
> **⚠️ 输入解析**: 使用 Chevrotain 解析 `.vmasm`，禁止 regex
- [ ] 🤖 栈分析 + 基本块划分 (lib/stack_analyzer.js)
  - 输入: output/*_disasm.vmasm (用 Chevrotain 解析)
  - 输出: output/*.vmir
  - 关键: 消除栈操作，生成 `t0 = a + b` 形式的三地址码

## 阶段 5: 控制流图生成 + 控制流分析 (HIR) - CFG 分析器
> **📚 参考**: `skills/jsvmp-decompiler.md` 第 6-7 节
> **⚠️ 开始此阶段前必须执行**: `readFile("skills/jsvmp-decompiler.md")`
> **目标**: 构建 CFG，识别循环和条件结构，恢复高级控制流
> **理论基础** (参考 androguard dad 反编译器):
>   - **支配树 (Dominator Tree)**: Lengauer-Tarjan 算法，O(n·α(n)) 复杂度
>   - **区间图 (Interval Graph)**: Allen-Cocke 算法，识别自然循环
>   - **导出序列 (Derived Sequence)**: 迭代构建区间图直到单节点，判断 CFG 可规约性
>   - **循环类型识别**: 
>     - pre_test (while): header 是条件节点，条件在循环体前
>     - post_test (do-while): latch 是条件节点，条件在循环体后
>     - end_less (for(;;)): header 和 latch 都不是条件节点
>   - **条件结构识别**: 找 follow 节点 (if-else 汇合点)，使用 IPDOM
> **关键算法**:
>   - 逆后序 (RPO): 支配树计算的基础
>   - 回边检测: 识别循环的 latch → header 边
>   - 循环节点收集: 从 latch 反向 BFS 到 header
- [ ] 🤖 CFG 构建 + 结构识别 (lib/cfg_analyzer.js)
  - 输入: output/*.vmir
  - 输出: output/*.vmhir
  - 格式: 带循环/条件标注的结构化 CFG
  - 关键: 正确识别循环类型和 follow 节点

## 阶段 6: 数据流分析 - 变量优化器
> **📚 参考**: `skills/jsvmp-decompiler.md` 第 8 节
> **目标**: 构建 DU/UD 链，进行变量优化，提高代码可读性
> **理论基础** (参考 androguard dad 反编译器):
>   - **到达定义分析 (Reaching Definition)**: 数据流方程迭代求解
>     - R[n] = ∪ A[pred] (所有前驱的出口定义)
>     - A[n] = (R[n] - kill[n]) ∪ gen[n]
>   - **DU/UD 链构建**: 
>     - UD 链: 每个使用点 → 可能的定义点集合
>     - DU 链: 每个定义点 → 所有使用点集合
>   - **SSA 变量分割 (split_variables)**: 
>     - 基于 DU/UD 链的连通分量分析
>     - 同一变量的不同"版本"重命名为 x_0, x_1, ...
>   - **寄存器传播 (register_propagation)**: 
>     - 单定义点的变量可以内联替换
>     - 常量传播: 将常量值直接替换到使用点
>   - **死代码消除 (dead_code_elimination)**: 
>     - 移除无使用点的定义
- [ ] 🤖 数据流分析 + 变量优化 (lib/dataflow.js) [可选]
  - 输入: output/*.vmhir
  - 输出: output/*_opt.vmhir (优化后的 HIR)
  - 关键: 正确处理 φ 函数和循环中的变量

## 阶段 7: 代码生成 (HIR → JS) - 代码生成器
> **📚 参考**: `skills/jsvmp-codegen.md` ⚠️ **必读**
> **⚠️ 开始此阶段前必须执行**: `readFile("skills/jsvmp-codegen.md")` + `readFile("skills/jsvmp-decompiler.md")`
> **目标**: 将 HIR 转换为可读的 JavaScript 代码
> **理论基础**:
>   - **区域化生成**: 每个控制结构 (if-else, loop) 是独立区域
>   - **结构化输出**: 使用 follow 节点确定控制结构边界
>   - **代码排序**: 按基本块地址排序，保持原始代码顺序
> **⚠️ 最易出错的阶段！常见问题**:
>   - else 分支丢失 → 分离 then/else 的 visited 集合
>   - 循环体不完整 → 遍历所有 loop nodes，不只是 header
>   - 嵌套结构扁平化 → 计算正确的 merge point (IPDOM)
>   - 代码顺序错乱 → 按 block.startAddr 排序
- [ ] 🤖 代码生成 (lib/codegen.js)
  - 输入: output/*.vmhir (或 *_opt.vmhir)
  - 输出: output/*_decompiled.js
  - **验证**: JS 行数应为 HIR 行数的 50%-150%，低于 50% 表示代码丢失
  - 关键: 正确处理嵌套控制结构，避免代码丢失

## 阶段 8-9: 实现与验证
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

Use IR debugger tools to debug JSVMP at IR level instead of raw JS. Requires Source Map (`.vmap`).

### Workflow
```javascript
// 1. Load IR source map (can be done before script loads)
load_ir_source_map(sourceMapPath="output/main_disasm.vmap")
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
| IR parse error | Use Chevrotain parser from `jsvmp-ir-extension/src/utils/`. NEVER use regex. |
| Regex breaks on edge case | Migrate to Chevrotain. See `skills/jsvmp-ir-parser.md`. |

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
- **CHEVROTAIN FOR IR**: Use `jsvmp-ir-extension/src/utils/vmasm-*.ts` for ALL IR parsing. NEVER regex.
- **STATIC EXTRACTION FIRST**: For bytecode/constants, use AST transform before browser
- **NEVER EMBED LARGE DATA**: Save arrays/strings to `raw/*.json`, never write directly
- **PHASE 1 GATE**: MUST complete deobfuscation before ANY VM analysis
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [L:line] [Src L:col] references** — future sessions depend on this
