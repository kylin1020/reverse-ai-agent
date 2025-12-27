---
inclusion: manual
---

# JSVMP Decompilation (State-Driven)

> **⚠️ RULE #0: 反编译器必须使用 Babel/Node.js 技术栈实现，禁止使用 Python！**
> - 核心依赖: `@babel/parser`, `@babel/generator`, `@babel/types`, `@babel/traverse`
> - 参考实现: `#[[file:skills/jsvmp-decompiler.md]]`
> - 理论基础: [编译与反编译原理实战之dad反编译器浅析](https://www.anquanke.com/post/id/266930)

> **⚠️ RULE #1: Never use `read_file/readFile`, `cat`, `head`, `tail`, `grep`, or `rg` for reading files. ALWAYS use Smart-FS tools (`read_code_smart`, `search_code_smart`, `find_usage_smart`) as your DEFAULT file access method. Smart-FS supports JS/TS (full AST + beautify + source map), JSON/HTML/XML/CSS (beautify), and all other text files.**

> **⚠️ RULE #2: For JSVMP dispatcher detection, ALWAYS use `find_jsvmp_dispatcher` tool (AI-powered LLM analysis). NEVER rely on simple regex patterns like `while(true)` or `switch` — these miss obfuscated dispatchers and produce false positives.**

> **⚠️ RULE #3: All file save tools (`fsWrite`, `save_*`, `savePath`, etc.) require ABSOLUTE paths.**

> **⚠️ RULE #4: STATIC EXTRACTION FIRST. Extract bytecode/constants/handlers from source code using Smart-FS + AST transforms. Browser is LAST RESORT for runtime-only data (encrypted strings, dynamic values).**

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
   a. Read NOTE.md → Check "待处理发现" section for new items
   b. If new discoveries exist → Add corresponding tasks to TODO.md
   c. Clear processed items from "待处理发现"
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
**ALWAYS use Smart-FS tools as your primary file access method.**

| File Type | Smart-FS Capabilities | Tools |
|-----------|----------------------|-------|
| `.js`, `.mjs`, `.cjs`, `.jsx` | Full: AST + Beautify + Source Map | `read_code_smart`, `search_code_smart`, `find_usage_smart`, `apply_custom_transform` |
| `.ts`, `.tsx`, `.mts`, `.cts` | Full: AST + Beautify + Source Map | Same as above |
| `.json` | Beautify | `read_code_smart`, `search_code_smart` |
| `.html`, `.htm` | Beautify | `read_code_smart`, `search_code_smart` |
| `.xml`, `.svg` | Beautify | `read_code_smart`, `search_code_smart` |
| `.css` | Beautify | `read_code_smart`, `search_code_smart` |
| Other text files | Basic reading with smart truncation | `read_code_smart`, `search_code_smart` |

**Why Smart-FS?**
- **Auto-beautifies** minified/compressed code
- **Intelligent truncation** prevents context overflow
- **Source mapping** (`[L:line] [Src L:col]`) for JS/TS enables precise breakpoint setting
  - `[L:xxx]` = beautified view line (for read_code_smart)
  - `[Src Lx:xxx]` = original file line:col (for Chrome breakpoint)
- **AST analysis** for JS/TS enables variable tracing

### 2. When to Use Traditional Tools (Rare Cases)
Only use `read_file`/`rg` when:
- Binary file inspection (though Smart-FS handles text gracefully)
- Specific line range extraction from very large non-code files
- Performance-critical batch operations on simple text files

### 3. String/Array Length Limits (CRITICAL)
**NEVER output, write, or embed large strings/arrays in code or responses:**
- `read_code_smart` handles truncation automatically.
- `evaluate_script` results: limit to 2000 chars (`.slice(0, 2000)`).
- `console.log` output: limit to 500 chars per value.
- Large data: save to file via `savePath` or `fs` tools.

### 4. ⚠️ Large Data Extraction (STATIC FIRST)

**FORBIDDEN: Writing constant arrays or long strings directly**
```javascript
// ❌ NEVER DO THIS — wastes tokens, causes truncation, corrupts data
const constants = ["str1", "str2", ... /* 1000+ items */];
const bytecode = [0x01, 0x02, ... /* huge array */];
fsWrite("raw/data.json", JSON.stringify(hugeArray)); // ❌ Don't embed in code
```

**Extraction Priority (Static > Dynamic):**

| Priority | Method | When to Use | Tools |
|----------|--------|-------------|-------|
| 1️⃣ | AST Transform | Array/object is statically defined in source | `apply_custom_transform` |
| 2️⃣ | Smart-FS + Script | Need to locate first, then extract | `search_code_smart` → Node.js script |
| 3️⃣ | Browser savePath | Runtime-generated or encrypted data | `evaluate_script(..., savePath=...)` |
| 4️⃣ | Browser scope dump | Complex nested objects at breakpoint | `save_scope_variables` |

**✅ CORRECT: Static Extraction via AST Transform**
```javascript
// Step 1: Locate the array using Smart-FS
search_code_smart(file="source/main.js", query="var\\s+_0x[a-f0-9]+\\s*=\\s*\\[")
// Output: [L:150] [Src L1:8234] var _0xabc123 = ["function", "Symbol", ...]

// Step 2: Write extraction transform (transforms/extract_constants.js)
module.exports = function({ types: t }) {
  return {
    visitor: {
      VariableDeclarator(path) {
        if (path.node.id.name === '_0xabc123' && 
            t.isArrayExpression(path.node.init)) {
          const elements = path.node.init.elements.map(e => {
            if (t.isStringLiteral(e)) return e.value;
            if (t.isNumericLiteral(e)) return e.value;
            return null;
          });
          require('fs').writeFileSync(
            'artifacts/jsvmp/{target}/raw/constants.json',
            JSON.stringify(elements, null, 2)
          );
          console.log(`✅ Extracted ${elements.length} elements`);
        }
      }
    }
  };
};

// Step 3: Run extraction
apply_custom_transform(target="source/main.js", script="transforms/extract_constants.js")
// Output file: raw/constants.json (NOT in chat output!)
```

**✅ CORRECT: Browser Extraction (when static fails)**
```javascript
// ALWAYS use savePath — NEVER output large data to chat
evaluate_script(
  script="JSON.stringify(window._0xabc123 || targetArray)",
  savePath="artifacts/jsvmp/{target}/raw/constants.json",
  maxOutputChars=100  // Only show confirmation, not data
)

// For scope variables at breakpoint
save_scope_variables(
  filePath="artifacts/jsvmp/{target}/raw/scope_dump.json",
  frameIndex=0,
  includeGlobal=false
)
```

**Common Extraction Targets:**
| Data Type | Static Method | Dynamic Method |
|-----------|---------------|----------------|
| String lookup table | AST: find ArrayExpression | `evaluate_script` + savePath |
| Bytecode array | AST: find large NumericLiteral[] | `evaluate_script` + savePath |
| Opcode handlers | AST: find switch cases | `get_scope_variables` at dispatcher |
| Encrypted strings | N/A (runtime only) | `evaluate_script` after decryption |

**Sub-Agent Extraction Rules:**
When delegating `🤖 提取...` tasks, sub-agent MUST:
1. Use `search_code_smart` to locate the target first
2. Prefer AST extraction script over browser
3. Save to `raw/*.json` — NEVER output array contents
4. Report only: variable name, location, element count

---

## 🛠️ SMART-FS TOOLKIT (Virtual Filesystem)

**Concept**: You are working with a **Virtual View**.
- You read `source/main.js` (Minified) -> Tool shows **Virtual Beautified View**.
- Output format: `[L:{current_line}] [Src L:C]`
  - `[L:xxx]` = beautified view line (for read_code_smart)
  - `[Src Lx:xxx]` = original file line:col (for Chrome breakpoint)
- **Rule**: NEVER look for `main.beautified.js`. It does not exist for you. Just read `main.js`.

| Action | Tool | Usage |
|--------|------|-------|
| **Read Code** | `read_code_smart` | `file="source/main.js", start=1, end=50` |
| **Search Text** | `search_code_smart` | `file="source/main.js", query="debugger"` |
| **Trace Var** | `find_usage_smart` | `file="...", identifier="_0xabc", line=105` |
| **Deobfuscate** | `apply_custom_transform` | `target="...", script="transforms/fix.js"` |
| **Find JSVMP** | `find_jsvmp_dispatcher` | `filePath="source/main.js"` — AI-powered dispatcher detection |

---

## 🔄 STATE PROTOCOL

**You are an execution engine for `artifacts/jsvmp/{target}/TODO.md`.**

### Execution Loop
1. **READ**: `TODO.md` + `NOTE.md` (create if missing).
2. **IDENTIFY**: First unchecked `[ ]` = current task.
3. **CHECK**: Is current phase complete? (see Phase Gate).
4. **EXECUTE**: One step to advance (Use Smart Tools for JS).
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md`.
6. **PLAN**: If new discoveries require follow-up → Add new tasks to TODO.md (see Dynamic Planning).

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

### Rule: After each `🤖` task completes
1. Check NOTE.md "待处理发现" section
2. Convert discoveries to new TODO tasks: `- [ ] 🤖 NEW: {task} (from: {source task})`
3. Clear processed items from "待处理发现"

### Common discoveries to add:
- New param found → `- [ ] 🤖 Trace param: {name}`
- New handler found → `- [ ] 🤖 Analyze handler: {name} @ [L:line] [Src L:col]`
- New bytecode array → `- [ ] 🤖 Extract bytecode: {name}`
- Unknown opcode → `- [ ] 🤖 Trace opcode: {opcode} @ [L:line] [Src L:col]`

---

## 📝 NOTE.md 模板

**路径**: `artifacts/jsvmp/{target}/NOTE.md`

```markdown
## 会话日志
### [YYYY-MM-DD HH:MM] 会话摘要
**任务**: 当前任务
**发现**: ...
**新增待办**: 🆕 需追踪参数 `x` / 🆕 需分析 handler `y`

## 参数追踪
| 参数名 | 生成函数 | 状态 |
|--------|----------|------|
| `_signature` | (待分析) | 🔍 |

## VM 结构
- Dispatcher: [L:line] [Src L1:col]
- Handler 表: [L:line] [Src L1:col]

## 待处理发现 (Pending Discoveries)
> Main Agent: 转换为 TODO 任务后删除
- [ ] 🆕 {description} @ [L:line] [Src L:col] (来源: {task})
```

---

## 🌐 BROWSER AUXILIARY TOOLS

**Browser is for: validating static analysis, getting runtime values, locating hard-to-analyze code.**

### Use Cases
| Scenario | Tool | Note |
|----------|------|------|
| Locate VM Dispatcher | `find_jsvmp_dispatcher` | AI-powered, returns confidence + line numbers |
| Verify Opcode | Log breakpoint | Differential analysis |
| Get runtime values | `get_scope_variables` | When static analysis fails |
| Bypass anti-debug | `replace_script` | Remove debugger statements |
| Print function source | `evaluate_script` | Quick location |

### Key Techniques

#### 0. Locate Code Position (The Smart Way)
**Do NOT use `rg` on minified JS.** Use `search_code_smart` to get the Chrome-compatible position.
```javascript
// 1. Search in Virtual View
search_code_smart(file="source/main.js", query="for\\(;;\\)")
// Output: 
//   15 | [Src L1:15847] | for(;;) { ... }

// 2. Set Breakpoint using [Src] coordinates
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
```

#### 1. Call Stack Tracing (Priority)
```javascript
// 1. Set breakpoint, let human trigger
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
// 2. After trigger, read call stack
get_debugger_status(maxCallStackFrames=20)
// 3. Call stack shows: file + line + function → target found
```

#### 2. Print Function Source (Limit Output)
```javascript
// ⚠️ ALWAYS limit output or use savePath
evaluate_script(script="targetFunc.toString().slice(0, 2000)")
evaluate_script(script="JSON.stringify(largeData)", savePath="artifacts/jsvmp/{target}/raw/data.json")
```

#### 3. Breakpoint Strategies
```javascript
// Log breakpoint (no pause) — ", false" is key!
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log(`PC:${pc} OP:${op}`), false')

// Pause breakpoint
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123)
```

#### 4. Anti-Debug Bypass
```javascript
// 1. Check call stack at debugger
get_debugger_status(contextLines=5)
// 2. Replace anti-debug logic
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
// 3. Reload
navigate_page(type="reload", timeout=3000)
```

#### 5. Runtime Value Extraction
**Prefer breakpoint over evaluate_script** — most vars/functions are NOT global:
```javascript
// ✅ PREFERRED: Breakpoint near target, then inspect scope
// Use find_usage_smart to locate where to break
find_usage_smart(file="source/main.js", identifier="targetVar", line=100)
// -> Definition at [Src L1:5000]
set_breakpoint(..., lineNumber=1, columnNumber=5000)
get_scope_variables()
```

---

## 📋 TODO.md 模板

**`🤖` = 委托给子代理执行 (`invokeSubAgent`)。子代理将发现写入 NOTE.md。**

```markdown
# JSVMP 反编译计划: {target}

## 目标
- URL: {target_url}
- API: (待浏览器侦察发现)
- 参数: (待浏览器侦察发现)

## 阶段 1: 代码预处理
- [ ] 初始化工作区 (创建目录)
- [ ] 🤖 浏览器侦察: 访问目标 URL, 捕获网络请求, 识别目标 API 和参数.下载所有可疑的 JS 文件和其他资源到 source/ (包括主要脚本、依赖库、静态资源等) → 更新 NOTE.md
- [ ] 🤖 检测混淆类型 → 更新 NOTE.md
- [ ] 编写去混淆脚本 (Babel Visitor)
- [ ] 应用去混淆: `apply_custom_transform` → output/*_deob.js

## 阶段 2: VM 结构分析 (⛔ 需完成阶段 1)
> **📚 技能引用**: 参考 `#[[file:skills/jsvmp-decompiler.md]]` 第 4 节
- [ ] 🤖 定位 VM dispatcher (`find_jsvmp_dispatcher`) → 更新 NOTE.md
- [ ] 🤖 分析 dispatcher 结构 (switch/if-else/函数表) → 记录 opcode 分发机制到 NOTE.md
- [ ] 🤖 定位字节码来源 (可能是数组、字符串、或动态生成) → 记录位置到 NOTE.md
- [ ] 🤖 分析字节码格式 (指令长度、操作数编码方式) → 记录到 NOTE.md
- [ ] 提取/解码字节码 → 保存到 raw/bytecode.json (⚠️ 禁止直接输出内容)
- [ ] 🤖 定位常量池 (如有) → 记录位置到 NOTE.md
- [ ] 提取常量池 (如有) → 保存到 raw/constants.json (⚠️ 禁止直接输出内容)
- [ ] 🤖 分析 opcode 语义 (通过 dispatcher 分支逻辑) → 记录 opcode 含义到 NOTE.md

## 阶段 3: 反汇编 (⛔ 需完成阶段 2)
> **📚 技能引用**: 阅读 `#[[file:skills/jsvmp-decompiler.md]]` 获取 Babel 反编译器实现指南
- [ ] 分析 opcode 格式 (参考 skill 第 11 节)
- [ ] 编写反汇编器 (lib/decompiler.js)
- [ ] 生成 LIR: output/*_disasm.asm

## 阶段 4: 栈分析 (⛔ 需完成阶段 3)
> **📚 技能引用**: 参考 `#[[file:skills/jsvmp-decompiler.md]]` 第 8 节数据流分析
- [ ] 分析栈操作 (replace_stack_var)
- [ ] 生成 MIR: output/*_mir.txt

## 阶段 5: 控制流分析 (⛔ 需完成阶段 4)
> **📚 技能引用**: 参考 `#[[file:skills/jsvmp-decompiler.md]]` 第 6-7 节
- [ ] 构建 CFG (graph_construct)
- [ ] 区间图分析 (intervals, derived_sequence)
- [ ] 循环/条件识别 (loop_struct, if_struct)
- [ ] 生成 HIR: output/*_hir.txt

## 阶段 6: 代码生成 (⛔ 需完成阶段 5)
> **📚 技能引用**: 参考 `#[[file:skills/jsvmp-decompiler.md]]` 第 9 节 Writer
- [ ] 实现 Writer 类
- [ ] 生成可读 JS: output/*_decompiled.js

## 阶段 7: 实现 (⛔ 需完成阶段 6)
- [ ] Python 骨架 (lib/*.py)
- [ ] 核心算法
- [ ] 参数构建器

## 阶段 8: 验证 (⛔ 需完成阶段 7)
- [ ] 🤖 捕获真实请求 → 保存到 raw/reference.txt
- [ ] 🤖 单元测试: 使用相同输入生成签名 → 与参考值对比
- [ ] 🤖 集成测试: 使用生成的签名发起真实 API 请求 → 验证 200 OK

## 阶段 9: 验证循环 (⛔ 重复直到通过)
- [ ] 测试失败 → 🤖 调试: 对比生成值与期望值, 定位差异
- [ ] 算法错误 → 返回阶段 3 (重新分析)
- [ ] 实现错误 → 返回阶段 7 (修复代码)
- [ ] ✅ 所有测试通过 → 编写 README.md
```

---

## PHASE GUIDES

### Phase 1: Preprocessing (Smart Mode)

**⚠️ CRITICAL: Use BROWSER for initial reconnaissance, NOT curl!**

`curl` cannot:
- Execute JavaScript (params are often dynamically generated)
- Handle cookies/sessions properly
- Capture XHR/Fetch requests
- See the actual request parameters being sent

**Correct Workflow:**

1. **Init Workspace** (Main Agent):
   ```bash
   mkdir -p artifacts/jsvmp/{target}/{source,transforms,output,raw,lib,repro}
   ```

2. **🤖 Browser Recon** (Sub-Agent via `invokeSubAgent`):
   - Navigate to target URL in browser
   - Open Network tab, filter by XHR/Fetch
   - Trigger the target action (search, login, etc.)
   - Identify:
     - Target API endpoint
     - Request method (GET/POST)
     - Headers (especially custom ones)
     - Request body/params (which ones look encrypted/signed?)
   - Save findings to NOTE.md

3. **🤖 Download JS Files** (Sub-Agent):
   - From Network tab, identify JS files loaded
   - Download relevant ones to `source/` directory
   - Note: Look for files containing VM code (large switch statements, bytecode arrays)

4. **🤖 检测混淆类型** (Sub-Agent):
   - Use `read_code_smart` on downloaded files
   - Identify: VM dispatcher, bytecode arrays, string obfuscation, etc.

**DO NOT use `head` or `cat` on JS files.**

5.  **Inspect** (after download):
    ```javascript
    read_code_smart(file_path="source/main.js", start_line=1, end_line=50)
    ```
    *Check output for: `var _0x...`, flattened control flow, etc.*

6.  **Search**:
    ```javascript
    search_code_smart(file_path="source/main.js", query="debugger")
    ```

7.  **Deobfuscate (If needed)**:
    *   Create transform script: `artifacts/jsvmp/{target}/transforms/fix_strings.js`
    *   Apply:
        ```javascript
        apply_custom_transform(target_file="source/main.js", script_path="transforms/fix_strings.js")
        ```
    *   Verify: `read_code_smart("source/main_deob.js")`

### Phase 2: VM Data Extraction

#### Locate Dispatcher
```javascript
// PRIMARY: AI-powered detection (handles obfuscation, returns confidence + line numbers)
find_jsvmp_dispatcher(filePath="source/main.js")

// FALLBACK: Simple regex if AI detection fails
search_code_smart(query="while\\s*\\(\\s*true")
search_code_smart(query="switch\\s*\\(")
```

#### Extract Data (Static-First Approach)

**⚠️ PRIORITY: Static extraction > Browser extraction**

1. **Locate via Smart-FS** (ALWAYS first):
   ```javascript
   // Find array definitions
   search_code_smart(query="\\[\\s*['\"].*['\"]\\s*,")  // String arrays
   search_code_smart(query="\\[\\s*\\d+\\s*,")          // Number arrays
   
   // Trace variable to definition
   find_usage_smart(file="source/main.js", identifier="bytecodeArray", line=100)
   ```

2. **Extract via AST Transform** (PREFERRED for static data):
   ```javascript
   // Create transforms/extract_constants.js:
   // module.exports = function({ types: t }) {
   //   return {
   //     visitor: {
   //       ArrayExpression(path) {
   //         if (path.node.elements.length > 100) {
   //           // Save to file, replace with require()
   //         }
   //       }
   //     }
   //   };
   // };
   apply_custom_transform(target="source/main.js", script="transforms/extract_constants.js")
   ```

3. **Browser extraction** (ONLY when runtime evaluation needed):
   ```javascript
   // ⚠️ ALWAYS use savePath — NEVER output large arrays
   evaluate_script(
     script="JSON.stringify(window.bytecodeArray || _0x1234)",
     savePath="raw/bytecode.json"
   )
   ```

**❌ NEVER DO:**
- Copy array contents into responses or code
- Use `evaluate_script` without `savePath` for large data
- Skip static analysis and go straight to browser

### Phase 3-6: IR Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 3 (LIR) | bytecode | `_disasm.asm` | Explicit stack ops |
| 4 (MIR) | LIR | `_mir.txt` | Expression trees |
| 5 (HIR) | MIR | `_hir.txt` | CFG + structure |
| 6 (JS) | HIR | `_decompiled.js` | Readable code |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **File too big** | `read_code_smart` handles this. Do NOT use `read_file`. |
| **Variable soup** | Use `find_usage_smart(..., line=X)` to trace specific scope. |
| **Line mismatch** | Trust the `[L:line] [Src L:col]` in Smart Tool output. |
| **Unknown opcode** | Trace handler using `set_breakpoint` at `[Src]` location. |
| **Can't find dispatcher** | Use `find_jsvmp_dispatcher` instead of regex. |

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
❌ WRONG: See "🤖 定位 VM dispatcher" → Open browser → Analyze yourself
✅ RIGHT: See "🤖 定位 VM dispatcher" → invokeSubAgent() → Wait for NOTE.md
```

### 🚀 PARALLEL EXECUTION

**`invokeSubAgent` supports MULTIPLE CONCURRENT CALLS!**

Scan ALL unchecked `🤖` tasks → If no data dependency → Invoke ALL in ONE turn:
```
✅ PARALLEL: 提取字节码 + 提取常量数组 (independent)
❌ SEQUENTIAL: 定位 dispatcher → 提取 handler (handler needs dispatcher)
```

### Workflow
1. Read TODO → Find ALL unchecked `🤖` tasks
2. Identify independent tasks → **Batch invoke** in ONE turn
3. Wait for all → Read NOTE.md → Update all `[x]`

### Prompt Template
```python
invokeSubAgent(
  name="general-task-execution",
  prompt="""
## ⚠️ MANDATORY FIRST STEP

## 🎯 YOUR SINGLE TASK (DO NOT DEVIATE)
{exact task text from TODO.md}

## ⛔ CRITICAL CONSTRAINTS
You are a FOCUSED EXECUTOR. You must:
1. **ONLY** complete the single task above — nothing more, nothing less
2. **STOP IMMEDIATELY** after completing this one task
3. **DO NOT** look at TODO.md or try to do other tasks
4. **DO NOT** proceed to "next steps" or "continue with..."
5. **DO NOT** make decisions about what to do next — that's the main agent's job

## 🚫 LARGE DATA HANDLING (CRITICAL)
**NEVER write or output large constant arrays or strings directly!**

When extracting bytecode, constants, or string arrays:
1. **Static Analysis First** — Use Smart-FS tools to LOCATE the data:
   - `search_code_smart(query="\\[.*,.*\\]")` to find arrays
   - `find_usage_smart(identifier="arrayName", line=X)` to trace definitions
   - Note the [L:line] [Src L:col] coordinates in NOTE.md
   
2. **Save to File** — NEVER paste array contents:
   - Browser: `evaluate_script(script="JSON.stringify(arr)", savePath="raw/data.json")`
   - Static: Write AST transform to extract and save
   
3. **Reference by Path** — In NOTE.md, write:
   - `Constants: raw/constants.json (extracted from [L:1234] [Src L1:5678])`
   - NOT the actual array contents!

❌ FORBIDDEN:
```javascript
// NEVER output this in responses or code:
const arr = ["item1", "item2", ... /* hundreds of items */];
```

✅ CORRECT:
```markdown
## NOTE.md
Constants array located at [L:1234] [Src L1:5678]
Extracted to: raw/constants.json (1847 items)
```

## Context
- Domain: {domain}
- Workspace: artifacts/jsvmp/{domain}/
- NOTE.md: artifacts/jsvmp/{domain}/NOTE.md

## Instructions
1. Read `skills/sub_agent.md` first (tool rules)
2. Execute ONLY the task stated above
3. For data extraction: Use static analysis to LOCATE, then save to file
4. Write findings to NOTE.md with [L:line] [Src L:col] coordinates
5. **FLAG NEW DISCOVERIES** in "待处理发现" section:
   `- [ ] 🆕 {description} @ [L:line] [Src L:col] (来源: {this task})`
6. **STOP** — do not continue to other work

## 🚫 FORBIDDEN ACTIONS
- Reading TODO.md
- Using `read_file`/`cat`/`grep`/`rg` for reading files (use Smart-FS tools for ALL file access)
- Writing large arrays/strings directly in code or responses
- Using evaluate_script without savePath for large data
- Closing or navigating away from main browser page
- Doing any task not explicitly stated above
- Continuing work after completing the assigned task

Write findings to NOTE.md, then STOP.
""",
  explanation="Delegate 🤖 task: {task summary}"
)
```

### Responsibility Matrix

| Task Type | Who Executes | Tools Allowed |
|-----------|--------------|---------------|
| `🤖 检测...` | Sub-agent | Browser, Smart-FS, `find_jsvmp_dispatcher` |
| `🤖 定位...` | Sub-agent | Smart-FS, `find_jsvmp_dispatcher`, Browser |
| `🤖 提取...` | Sub-agent | Smart-FS, Browser |
| `🤖 Capture...` | Sub-agent | Browser network |
| `🤖 Run tests...` | Sub-agent | Bash, Python |
| `🤖 Debug...` | Sub-agent | All tools |
| `编写去混淆脚本` | Main agent | fsWrite |
| `应用去混淆` | Main agent | apply_custom_transform |
| `Python skeleton` | Main agent | fsWrite |
| `Core algorithm` | Main agent | fsWrite |
| `Update TODO/NOTE` | Main agent | fsWrite, strReplace |

---

## Phase 8-9: Validation Guide

### Phase 8: Validation

**⚠️ Validation is MANDATORY — NEVER skip this phase**

1. **Capture Reference**: Sub-agent captures a real request with known input/output
2. **Unit Test**: Generate signature with same input → must match reference exactly
3. **Integration Test**: Make actual API request → must return 200 OK (or expected response)

**Failure Handling:**
- Unit test fails: Algorithm misunderstanding → return to Phase 3-6 for re-analysis
- Integration test fails but unit test passes: Missing headers/cookies/timestamp → debug request

### Phase 9: Verification Loop

**This phase ensures correctness through iteration:**

1. Run tests
2. Pass?
   - Yes → Write README.md → Done ✅
   - No → Debug: What's different?
     - Algorithm error → Phase 3-6
     - Implementation error → Phase 7

**Debug Checklist:**
- [ ] Byte-by-byte comparison: generated value vs expected value
- [ ] Check encoding: UTF-8, URL encoding, Base64 padding
- [ ] Check byte order: little-endian vs big-endian
- [ ] Check timestamp: is it time-sensitive?
- [ ] Check random values: is there a nonce/salt?

---

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need handler analysis."
- **Stack Imbalance**: "🆘 Stack imbalance at PC {pc}."
- **Complex Control Flow**: "🆘 Control flow too complex."
- **CAPTCHA**: "🆘 Encountered CAPTCHA, please complete manually."
- **Login**: "🆘 Please log in."
- **Trigger**: "🆘 Please click button to trigger request."
- **Stuck**: "🆘 Decompilation blocked."

---

## ⛔ FINAL RULES CHECKLIST

### Before EVERY action, ask yourself:
- [ ] Did I read TODO.md first?
- [ ] Is the current task marked with `🤖`?
- [ ] If `🤖`: Am I calling `invokeSubAgent()`? (If not, STOP!)
- [ ] If not `🤖`: Am I allowed to do this task myself?

### After EVERY task completion, ask yourself:
- [ ] Did I check NOTE.md for "待处理发现" section?
- [ ] Did I convert pending discoveries to TODO.md tasks?
- [ ] Did I clear processed items from "待处理发现"?
- [ ] Did I mark the current task `[x]`?

### Code Reading
**MUST use `read_code_smart` tool instead of `read_file` for ALL file reading.**
- Supports JS/TS (full AST + beautify + source map), JSON/HTML/XML/CSS (beautify), and all text files
- Handles long lines intelligently (truncates with line numbers preserved)
- Prevents context overflow from minified/beautified code

### Absolute Rules
- **🤖 = DELEGATE**: See `🤖`? Call `invokeSubAgent()`. Period.
- **DYNAMIC PLANNING**: After each task, check for new discoveries and update TODO.md
- **LOCAL FILES FIRST**: Always check `output/*_deob.js` before using browser
- **SMART-FS DEFAULT**: Use `read_code_smart`/`search_code_smart` for ALL file reading — supports JS/TS/JSON/HTML/XML/CSS and all text files
- **STATIC EXTRACTION FIRST**: For bytecode/constants, use AST transform before browser
- **NEVER EMBED LARGE DATA**: Save arrays/strings to `raw/*.json`, never write directly
- NEVER use `read_file`/`cat`/`grep`/`rg` for reading files — use Smart-FS tools
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- NEVER output array contents (>50 elements) in responses — save to file instead
- **PHASE 1 GATE**: MUST complete deobfuscation before ANY VM analysis
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [L:line] [Src L:col] references** — future sessions depend on this
- **LOG every session** — append to Session Log section