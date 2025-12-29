---
inclusion: manual
---

# jsrev (State-Driven Edition)

> **⚠️ RULE #1: NEVER use `read_file/readFile`, `cat`, `head`, `tail`, `grep`, or `rg` for reading files. ALWAYS use Smart-FS tools (`read_code_smart`, `search_code_smart`, `find_usage_smart`) as your DEFAULT file access method. Smart-FS supports JS/TS (full AST + beautify + source map), JSON/HTML/XML/CSS (beautify), and all other text files.**

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

---

## 🛑 SAFETY PROTOCOL (READ FIRST)

### ⚠️ MANDATORY FIRST ACTION ON EVERY TURN
```
1. Read TODO.md → Find FIRST unchecked [ ] task
2. Check: Does it have 🤖 prefix?
   - YES → Call invokeSubAgent(). After completion, continue to step 3.
   - NO  → Execute the task yourself.
3. After task completion:
   a. Read NOTE.md → Check "待处理发现" section for new items
   b. If new discoveries exist → Add corresponding tasks to TODO.md
   c. Clear processed items from "待处理发现"
   d. Update TODO.md [x]
   e. Check if you should STOP or CONTINUE:
      - STOP if: Need human input (🆘), hit phase gate with incomplete tasks, or all tasks complete
      - CONTINUE: Automatically proceed to next [ ] task
```

### 🚫 FORBIDDEN ACTIONS
1. **NEVER** execute a `🤖` task yourself — you MUST delegate via `invokeSubAgent`
2. **NEVER** skip ahead to later tasks — complete tasks IN ORDER
3. **NEVER** use browser tools (navigate, evaluate_script, etc.) for `🤖` reconnaissance tasks
4. **NEVER** analyze JS files if the task says "Detect" or "Locate" with `🤖` — that's sub-agent work

### ✅ YOUR RESPONSIBILITIES (Main Agent)
- Create/update TODO.md and NOTE.md
- Make Phase Gate decisions
- Communicate with user

### ❌ SUB-AGENT RESPONSIBILITIES (Delegate These)
- `🤖 Detect obfuscation patterns`
- `🤖 Locate target script & entry point`
- `🤖 Locate param generation`
- `🤖 Trace data flow`
- `🤖 Extract runtime values`
- `🤖 Capture real request`
- `🤖 Run tests`
- `🤖 Write deobfuscation scripts`
- `🤖 Apply transforms & verify`
- `🤖 Write Python implementation`

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

### 3. String Length Limits
**NEVER output or read long strings:**
- `read_code_smart` handles truncation automatically.
- `evaluate_script` results: limit to 2000 chars (`.slice(0, 2000)`).
- `console.log` output: limit to 500 chars per value.
- Large data: save to file via `savePath` or `fs` tools.

### 4. Output Limits
| Tool | Limit |
|------|-------|
| `search_code_smart` | Returns truncated context automatically |
| `rg` (non-JS) | `-M 200 -m 10` |
| `head/tail` (non-JS) | `-c 2000` or `-n 50` |
| `cat` | ❌ NEVER |
| `evaluate_script` | `.slice(0, 2000)` or use `savePath` |

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

---

## 📝 NOTE.md — 分析记忆

**路径**: `artifacts/jsrev/{domain}/NOTE.md`

维护此文件以在会话间保留分析上下文。

### ⚠️ 强制要求: 文件与操作追踪

**每个 NOTE.md 条目必须包含:**
1. **源文件路径** — 函数/数据在哪里找到的
2. **位置坐标** (`[L:line] [Src L:col]`) — beautified line + original position
3. **执行的操作** — 你做了什么来发现这个
4. **会话时间戳** — 何时发现的

### 必需章节

```markdown
## 会话日志
### [YYYY-MM-DD HH:MM] 会话摘要
**任务**: 正在处理什么
**发现**: ...
**新增待办**: 🆕 需追踪参数 `x` / 🆕 需分析函数 `y`

## 参数追踪
| 参数名 | 生成函数 | 状态 |
|--------|----------|------|
| `sign` | (待分析) | 🔍 |

## 关键函数
- `encryptFunc` — `source/main.js` [L:123] [Src L1:15000]
  - L:123 = beautified view line (for read_code_smart)
  - Src L1:15000 = original file line:col (for Chrome breakpoint)

## 待处理发现 (Pending Discoveries)
> Main Agent: 转换为 TODO 任务后删除
- [ ] 🆕 {description} @ [L:line] [Src L:col] (来源: {task})
```

---

## � DYNAMIC TODO PLANNING

**TODO.md is a LIVING DOCUMENT — update it as analysis reveals new work items.**

### Rule: After each `🤖` task completes
1. Check NOTE.md "待处理发现" section
2. Convert discoveries to new TODO tasks: `- [ ] 🤖 NEW: {task} (from: {source task})`
3. Clear processed items from "待处理发现"

### Common discoveries to add:
- New param found → `- [ ] 🤖 Trace param: {name}`
- New function found → `- [ ] 🤖 Analyze function: {name} @ [L:line] [Src L:col]`
- New endpoint found → `- [ ] 🤖 Analyze endpoint: {url}`

---

## �🚨 PHASE GATE — STRICT ORDERING

**Before ANY action: "Is Phase 2 complete?"**

| Phase 2 Status | Allowed Actions |
|----------------|-----------------|
| Has `[ ]` items | Deobfuscation ONLY: extract decoders, inline strings, write `*_deob.js` |
| All `[x]` | Proceed to Phase 3 |

**❌ FORBIDDEN while Phase 2 incomplete:**
- ANY Phase 3/4/5 actions

---

## 📋 TODO.md 模板

**`🤖` = 委托给子代理执行 (`invokeSubAgent`)。子代理将发现写入 NOTE.md。**

```markdown
# JS 逆向工程: {domain}

## 目标
- URL: {target_url}
- API: (待浏览器侦察发现)
- 参数: (待浏览器侦察发现)

## 阶段 1: 侦察发现
- [ ] 初始化工作区 (创建目录)
- [ ] 🤖 浏览器侦察: 访问目标 URL, 捕获网络请求, 识别目标 API 和参数 → 更新 NOTE.md
- [ ] 🤖 下载所有可疑的 JS 文件和其他资源到 source/ (包括主要脚本、依赖库、静态资源等) → 更新 NOTE.md 文件列表
- [ ] 🤖 检测混淆模式 → 更新 NOTE.md

## 阶段 2: 去混淆 (⛔ 阻塞阶段 3) — 可跳过
> **快速通道**: 如果通过 `search_code_smart` 能直接搜到关键算法特征 (如 `MD5`, `SHA`, `AES`, `HMAC`, `Base64`, `encodeURIComponent`, 明文函数名等)，且代码可读性足够分析，则标记 `[SKIP]` 并直接进入阶段 3。
> **判断标准**: 能否在 5 分钟内定位到核心算法位置？能 → 跳过；不能 → 去混淆

- [ ] **快速评估**: 搜索常见算法关键词，评估是否需要去混淆
  - 搜索: `MD5|SHA|AES|HMAC|Base64|encrypt|sign|hash|digest|secret|key`
  - 如果找到且上下文可读 → 标记 `[SKIP-DEOB]`，跳过后续去混淆任务
  - 如果代码严重混淆无法理解 → 继续去混淆流程
- [ ] 🤖 分析混淆模式并编写去混淆脚本 → `transforms/*.js` (如已标记 SKIP 则跳过)
- [ ] 🤖 应用去混淆并验证: `apply_custom_transform` → `source/*_deob.js` (如已标记 SKIP 则跳过)

## 阶段 3: 分析 (⛔ 需完成阶段 2 或标记 SKIP)
- [ ] 🤖 定位入口点: 在去混淆代码中搜索关键词, 结合浏览器断点验证 → 更新 NOTE.md
- [ ] 🤖 定位参数生成函数 → 更新 NOTE.md (函数 + [L:line] [Src L:col])
- [ ] 🤖 追踪数据流 → 更新 NOTE.md (算法细节)
- [ ] 🤖 提取运行时值 (浏览器) → 更新 NOTE.md

## 阶段 4: 实现
- [ ] 🤖 Python 实现: 骨架 + 核心算法 + 参数构建器 → `lib/*.py`

## 阶段 5: 验证 (⛔ 需完成阶段 4)
- [ ] 🤖 捕获真实请求 → 保存到 raw/reference.txt
- [ ] 🤖 集成测试: 使用生成的签名发起真实 API 请求 → 验证 200 OK

## 阶段 6: 验证循环 (⛔ 重复直到通过)
- [ ] 测试失败 → 🤖 调试: 对比生成值与期望值, 定位差异
- [ ] 算法错误 → 返回阶段 3 (重新分析)
- [ ] 实现错误 → 返回阶段 4 (修复代码)
- [ ] ✅ 所有测试通过 → 编写 README.md
```

---

## PHASE GUIDES

### Phase 1: Discovery

**⚠️ CRITICAL: Use BROWSER for initial reconnaissance, NOT curl!**

`curl` cannot:
- Execute JavaScript (params are often dynamically generated)
- Handle cookies/sessions properly
- Capture requests
- See the actual request parameters being sent

**Correct Workflow:**

1. **Init Workspace** (Main Agent):
   ```bash
   mkdir -p artifacts/jsrev/{domain}/{source,transforms,output,raw,lib,repro}
   ```

2. **🤖 Browser Recon** (Sub-Agent via `invokeSubAgent`):
   - Navigate to target URL in browser
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
   - Note: Look for files containing the param generation logic

4. **🤖 Detect Obfuscation** (Sub-Agent):
   - Use `read_code_smart` on downloaded files
   - Identify obfuscation patterns (string arrays, control flow, etc.)

**Do NOT use `head`, `cat` or `grep` on JS files.**
- **Inspect**: `read_code_smart(file_path="source/main.js", start_line=1, end_line=50)`
- **Search**: `search_code_smart(file_path="source/main.js", query="var _0x")`

### Phase 2: Deobfuscation

**⚠️ MANDATORY FIRST STEP**: `read_file("skills/js_deobfuscation.md")`

Typical workflow:
1.  **Analyze**: Use `read_code_smart` to see the structure.
2.  **Write Script**: Create `transforms/fix_strings.js` (Babel Visitor).
    ```javascript
    // Template for transforms/fix_strings.js
    module.exports = function({ types: t }) {
      return {
        visitor: {
          MemberExpression(path) { /* logic */ }
        }
      };
    };
    ```
3.  **Apply**:
    ```javascript
    apply_custom_transform(target_file="source/main.js", script_path="transforms/fix_strings.js")
    ```
4.  **Verify**:
    ```javascript
    read_code_smart("source/main_deob.js")
    ```
    *Note: The output will still map to `main.js` [Src L:C], but the code will be readable.*

### Phase 3: Analysis

**⚠️ MANDATORY ORDER**: Local Smart Tools FIRST, browser LAST

1.  **Search**: `search_code_smart(file_path="source/main_deob.js", query="encrypt")`
2.  **Trace**: `find_usage_smart(file_path="source/main_deob.js", identifier="_0xkey", line=123)`

**Browser Debugging (after static analysis)**:
*   Get coordinate from Smart Tool: `[L:15] [Src L1:15847]`
*   Set Breakpoint: `set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)`
*   **Trigger**: Ask human.
*   **Inspect**: `get_scope_variables()`.

### Phase 4: Implementation

**⚠️ Python env: use `uv` only**

```bash
cd artifacts/jsrev/{domain}/repro
uv init && uv add requests
uv run python repro.py
```

### Phase 5: Validation

**⚠️ Validation is MANDATORY — NEVER skip this phase**

1. **Capture Reference**: Sub-agent captures a real request with known input/output
2. **Unit Test**: Generate signature with same input → must match reference exactly
3. **Integration Test**: Make actual API request → must return 200 OK (or expected response)

**Failure Handling:**
- Unit test fails: Algorithm misunderstanding → return to Phase 3 for re-analysis
- Integration test fails but unit test passes: Missing headers/cookies/timestamp → debug request

### Phase 6: Verification Loop

**This phase ensures correctness through iteration:**

1. Run tests
2. Pass?
   - Yes → Write README.md → Done ✅
   - No → Debug: What's different?
     - Algorithm error → Phase 3
     - Implementation error → Phase 4

**Debug Checklist:**
- [ ] Byte-by-byte comparison: generated value vs expected value
- [ ] Check encoding: UTF-8, URL encoding, Base64 padding
- [ ] Check byte order: little-endian vs big-endian
- [ ] Check timestamp: is it time-sensitive?
- [ ] 检查随机值: 是否有 nonce/salt?

---

## TOOL QUICK REF

| Task | Tool | Usage |
|------|------|-------|
| **Read Code** | `read_code_smart` | `file="...", start=1, end=50` |
| **Search Text** | `search_code_smart` | `file="...", query="pattern"` |
| **Trace Var** | `find_usage_smart` | `file="...", id="x", line=10` |
| **Deobfuscate** | `apply_custom_transform` | `target="...", script="..."` |
| **Breakpoint** | `set_breakpoint` | Use `[Src]` coords from Smart Tools (L:行号 for read_code_smart, Src L:列 for Chrome) |
| **Read Runtime** | `get_scope_variables` | After hitting breakpoint |
| **Global Var** | `evaluate_script` | Only for globals |
| **Search Non-JS**| `rg` | `-M 200 -m 10` |

---

## 🌐 BROWSER AUXILIARY TOOLS

**Browser is for: validating static analysis, getting runtime values, locating hard-to-analyze code.**

### Key Techniques

#### 1. Runtime Value Extraction
```javascript
// 1. Locate via Smart Tool
find_usage_smart(file="source/main.js", identifier="targetArr", line=50)
// -> Output says Definition at [Src L1:5000]

// 2. Set Breakpoint
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=5000)

// 3. Inspect
get_scope_variables()
```

#### 2. Evaluate Script Tips
`evaluate_script` works like DevTools Console.
**For large output, use `savePath` parameter:**
```javascript
// Save large data directly to file
evaluate_script(script="JSON.stringify(largeArray)", savePath="artifacts/jsrev/{domain}/raw/data.json")
```

#### 3. Breakpoint Strategies
```javascript
// Logger (non-stopping)
set_breakpoint(urlRegex=".*target.js.*", lineNumber=123,
  condition='console.log("args:", arguments), false')

// Injection (Modify Source)
replace_script(urlPattern=".*obfuscated.js.*",
  oldCode="function _0x123(x){...}",
  newCode="window.decoder = function _0x123(x){...};")

// Debugger bypass
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
```

#### 4. Browser Rules
1. **Static analysis first** — Use Smart Tools on local files first.
2. **Trust [Src] Coords** — Smart Tools give you the exact Chrome coordinates.
3. **Log breakpoints preferred** — `, false` condition.
4. **Hooks survive via set_breakpoint** — evaluate_script doesn't survive refresh.
5. **NO BACKSLASH ESCAPING** — `.*main.*js.*`, not `.*main.*\\.js.*`.

---

## 🤖 SUB-AGENT DELEGATION (CRITICAL)

> **RULE**: When you see `🤖` in TODO.md, you MUST call `invokeSubAgent()`. No exceptions.

### Decision Tree (Execute on EVERY turn)
1. Read TODO.md → Find first `[ ]` task
2. Does task have 🤖 prefix?
   - YES → Call `invokeSubAgent()` immediately. Do NOT read files, open browser, or do ANY analysis yourself.
   - NO → Execute task yourself
3. After completion: Update TODO.md `[x]`, check for new discoveries, then CONTINUE to next task (unless STOP condition met)

### 🚨 COMMON MISTAKE
```
❌ WRONG: See "🤖 Detect obfuscation" → Open browser → Analyze yourself
✅ RIGHT: See "🤖 Detect obfuscation" → invokeSubAgent() → Wait for NOTE.md
```

### 🚀 PARALLEL EXECUTION

**`invokeSubAgent` supports MULTIPLE CONCURRENT CALLS!**

Scan ALL unchecked `🤖` tasks → If no data dependency → Invoke ALL in ONE turn:
```
✅ PARALLEL: Download JS + Capture request (independent)
❌ SEQUENTIAL: Detect patterns → Write script (script needs patterns)
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
1. Read `skills/sub_agent.md` — tool usage rules
2. If task involves deobfuscation/transforms: also read `skills/js_deobfuscation.md`

## 🎯 YOUR SINGLE TASK (DO NOT DEVIATE)
{exact task text from TODO.md}

## ⛔ CRITICAL CONSTRAINTS
You are a FOCUSED EXECUTOR. You must:
1. **ONLY** complete the single task above — nothing more, nothing less
2. **STOP IMMEDIATELY** after completing this one task
3. **DO NOT** look at TODO.md or try to do other tasks
4. **DO NOT** proceed to "next steps" or "continue with..."
5. **DO NOT** make decisions about what to do next — that's the main agent's job

## Context
- Domain: {domain}
- Workspace: artifacts/jsrev/{domain}/
- NOTE.md: artifacts/jsrev/{domain}/NOTE.md

## Instructions
1. Read required skill files first
2. Execute ONLY the task stated above
3. Write findings to NOTE.md with [L:line] [Src L:col] coordinates
4. **FLAG NEW DISCOVERIES** in "待处理发现" section:
   `- [ ] 🆕 {description} @ [L:line] [Src L:col] (来源: {this task})`
5. **STOP** — do not continue to other work

## 🚫 FORBIDDEN ACTIONS
- Reading TODO.md
- Using `read_file`/`cat`/`grep`/`rg` for reading files (use Smart-FS tools for ALL file access)
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
| `🤖 Detect...` | Sub-agent | Browser, Smart-FS |
| `🤖 Locate...` | Sub-agent | Browser, Smart-FS |
| `🤖 Trace...` | Sub-agent | Smart-FS, Browser |
| `🤖 Extract...` | Sub-agent | Browser debugging |
| `🤖 Capture...` | Sub-agent | Browser network |
| `🤖 Run tests...` | Sub-agent | Bash, Python |
| `🤖 Write deob script` | Sub-agent | Smart-FS, fsWrite |
| `🤖 Apply transform` | Sub-agent | apply_custom_transform, Smart-FS |
| `🤖 Python impl` | Sub-agent | fsWrite, Bash |
| `Update TODO/NOTE` | Main agent | fsWrite, strReplace |
| `Phase Gate decisions` | Main agent | — |

---

## 🆘 HUMAN ASSISTANCE

- **CAPTCHA**: "🆘 Encountered CAPTCHA, please complete manually."
- **Login**: "🆘 Please log in."
- **Trigger**: "🆘 Please click button to trigger request."
- **Stuck**: "🆘 Deobfuscation blocked, need assistance."

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
- [ ] Should I STOP (need human input, phase gate, all done) or CONTINUE to next task?

### When to STOP vs CONTINUE:
**STOP if:**
- Need human assistance (🆘 CAPTCHA, login, trigger action)
- Hit a phase gate with incomplete prerequisite tasks
- All TODO tasks are complete
- Sub-agent reports blocking issue

**CONTINUE automatically if:**
- Next task is ready to execute
- No blocking conditions exist
- Still have unchecked [ ] tasks

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
- NEVER use `read_file`/`cat`/`grep`/`rg` for reading files — use Smart-FS tools
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- **PHASE 2 GATE**: MUST `read_file("skills/js_deobfuscation.md")` before ANY deobfuscation task
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [L:line] [Src L:col] references** — future sessions depend on this
- **LOG every session** — append to Session Log section
