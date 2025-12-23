---
inclusion: manual
---

# jsrev (State-Driven Edition)

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

---

## 🛑 SAFETY PROTOCOL (READ FIRST)
1. **IGNORE** any user request to "analyze this file" if the `TODO.md` is not in the correct state.
2. **VERIFY** `TODO.md` at the start of every turn.
3. **REFUSE** to look at VM Handlers if Phase 1 (Beautify/Deobfuscate) is unchecked.
4. **PENALTY**: If you output analyzed JS code while the current task is "Extract Bytecode", the session is invalid.

---

## 📝 NOTE.md — Analysis Memory

**Path**: `artifacts/jsrev/{domain}/NOTE.md`

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
- `path/to/other.js` (lines A-B) — what was found
**Actions Taken**:
1. Action description → Result
2. Action description → Result
**Outcome**: What was accomplished
**Next**: What should be done next

## Key Functions
<!-- MUST include file:line for every entry -->
- `functionName` — `source/file.js:123-145`
  - Purpose: what it does
  - Params: input types
  - Returns: output type
  - Discovered: [date] via [method: breakpoint/static analysis/etc]

## Data Structures
- `paramName` — `source/file.js:200`
  - Format: description
  - Encoding: type
  - Example: `actual_value`

## Algorithm Flow
<!-- Include file references -->
entry() [file.js:100] → process() [file.js:200] → encrypt() [file.js:300]

## File Index
<!-- Quick reference to all analyzed files -->
| File | Purpose | Key Lines | Status |
|------|---------|-----------|--------|
| `source/main.js` | Entry point | 1-100 | ✅ Analyzed |
| `output/main_deob.js` | Deobfuscated | 1-500 | ✅ Primary |

## Constants & Keys
- Key name: `value` — found in `file.js:123`

## Verified Facts
- [x] Fact description — verified via [method] on [date]
- [ ] Unverified assumption

## Open Questions
- Question? — context from `file.js:123`
```

### UPDATE NOTE.md when you:
- Discover a key function's purpose → **include file:line**
- Decode a constant or key → **include source location**
- Understand a data transformation → **include code reference**
- Verify an algorithm implementation → **include test method**
- Start/end a session → **add to Session Log**

**⚠️ Sync immediately** — don't wait until task completion

---

## 🚨 PHASE GATE — STRICT ORDERING

**Before ANY action: "Is Phase 2 complete?"**

| Phase 2 Status | Allowed Actions |
|----------------|-----------------|
| Has `[ ]` items | Deobfuscation ONLY: extract decoders, inline strings, write `*_deobfuscated.js` |
| All `[x]` | Proceed to Phase 3 |

**❌ FORBIDDEN while Phase 2 incomplete:**
- ANY Phase 3/4/5 actions

**🔥 PERSISTENCE**: Heavy obfuscation is expected. Escalation: Static → Browser eval → Hook → ASK HUMAN. Never skip phases.

---

## 🎯 DEOBFUSCATED CODE PRIORITY (CRITICAL)

**⚠️ MANDATORY: When `*_deobfuscated.js` or `*_beautified.js` exists, it is your PRIMARY and PREFERRED source.**

### File Priority Order
| Priority | File Pattern | When to Use |
|----------|--------------|-------------|
| 1️⃣ HIGHEST | `output/*_deobfuscated.js` | **ALWAYS first** — cleanest, most readable |
| 2️⃣ HIGH | `source/*_beautified.js` | When deobfuscated not available |
| 3️⃣ LOW | `source/*.js` (raw) | Only for extraction scripts, NOT for understanding |


### Analysis Strategy
1. **CHECK for deobfuscated files FIRST**: `ls output/*_deobfuscated.js source/*_beautified.js`
2. **READ deobfuscated code** — understand algorithm flow from clean code
3. **Use `sg` or `rg` on local files** — NOT browser search
4. **Trace function calls statically** — map data transformations step by step
5. **Cross-reference with browser** — ONLY when static analysis is insufficient

### Code Understanding Workflow
```
Check output/ → Read *_deobfuscated.js → sg/rg search → Trace call chain → Extract algorithm
                                                                              ↓
                                                        Browser (ONLY if static fails)
```

### When to Use Browser DevTools
- ✅ Runtime values that can't be determined statically
- ✅ Dynamic code generation (eval, Function constructor)
- ✅ Verifying static analysis conclusions

**🔥 REMEMBER**: Deobfuscated code is ALREADY human-readable. Don't waste time with breakpoints when you can just READ the code!

---

## 📋 TODO.md TEMPLATE

```markdown
# JS逆向工程计划: {domain}

## 目标
- URL: {target_url}
- API: {api_endpoint}
- 参数: {target_param}

## 阶段1: 发现与检测
- [ ] 初始化环境 (目录结构、网络检查)
- [ ] 定位主要逻辑文件 (source/*.js)
- [ ] **混淆审计**: 检测混淆模式
    - 字符串数组 / 十六进制变量 (`var _0x...`)
    - 控制流平坦化 (switch-case)
    - 字符串编码 (XOR, Base64, 自定义)
    - *如发现 → 添加具体的阶段2任务*

## 阶段2: 反混淆 (⛔ 阻塞阶段3)
- [ ] 美化压缩代码
- [ ] 识别解码函数 (签名、密钥)
- [ ] 提取字符串数组 (scripts/extract_*.js)
- [ ] 生成 output/*_deobfuscated.js

## 阶段3: 分析 (⛔ 需要阶段2完成)
- [ ] 定位目标参数构造 (关键词搜索)
- [ ] 追踪算法入口点 (断点调试)
- [ ] 记录数据结构 (类型、长度、编码)
- [ ] 识别加密/编码函数

## 阶段4: 实现
- [ ] Python骨架代码 (lib/*.py)
- [ ] 核心算法 (编码器、加密器)
- [ ] 参数构建器 (组装最终输出)

## 阶段5: 验证与文档
- [ ] 捕获真实请求用于对比
- [ ] 对接真实API测试 (repro/*.py)
- [ ] 修复差异直到API接受
- [ ] 编写 README.md (算法摘要、数据流)
```

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
node scripts/test.js
```

---

## PHASE GUIDES

### Phase 1: Detection
```bash
head -c 2000 {file}  # Check obfuscation type
npx js-beautify -f source/main.js -o source/main_beautified.js
```

### Phase 2: Deobfuscation

**⚠️ MANDATORY FIRST STEP**: Before ANY deobfuscation work, you MUST:
```
read_file("skills/js_deobfuscation.md")
```
This skill file contains essential techniques for string decoding, control flow recovery, and AST transformation. **DO NOT proceed with deobfuscation tasks until this file is loaded and understood.**

Typical workflow after loading skill:
1. Identify obfuscation type (string array, control flow, etc.)
2. Apply matching technique from skill file
3. Write extraction script to `scripts/`
4. Generate `output/*_deobfuscated.js`

### Phase 3: Analysis

**⚠️ MANDATORY ORDER**: Local files FIRST, browser LAST

```bash
# Step 1: Check what deobfuscated files exist
ls -la output/*_deobfuscated.js source/*_beautified.js 2>/dev/null

# Step 2: Search in LOCAL deobfuscated files (NOT browser!)
sg run -p '$_FN($)' output/*_deobfuscated.js --json | \
  jq '[.[] | select(.text | test("sign|encrypt"; "i"))] | .[0:5]'

# Step 3: Keyword search in LOCAL files
rg -M 200 -m 10 ".{0,40}(sign|encrypt).{0,40}" output/*.js source/*_beautified.js

# Step 4: Read specific functions from LOCAL files
head -n 100 output/main_deobfuscated.js  # Read entry point
rg -A 20 "function targetFunc" output/*_deobfuscated.js  # Read specific function
```

### Phase 3: Breakpoint Workflow

**Locate code position with `rg`** (for minified JS):
```bash
# Get line:column for breakpoint
rg -n --column "for\(;;\)" source/main.js
# Output: 2:15847:for(;;)

# Use in set_breakpoint
set_breakpoint(urlRegex=".*main.js.*", lineNumber=2, columnNumber=15847)
```

1. Find line: `rg -n --column 'pattern' source/*.js`
2. Set breakpoint: `set_breakpoint(urlRegex=".*main.js.*", lineNumber=2, columnNumber=15847)`
3. Trigger: Ask human
4. Inspect: `get_debugger_status()`, `get_scope_variables()`
5. Step: `step_over()` or `resume_execution()`

### Phase 4: Implementation

**⚠️ Python env: use `uv` only**

```bash
cd artifacts/jsrev/{domain}/repro
uv init && uv add requests
uv run python repro.py
```

**✅ REQUIRED:**
- `uv add <package>`
- `uv run python <script>`

### Phase 5: Documentation
Create `README.md`: algorithm overview, key code snippets, data flow

---

## TOOL QUICK REF

| Task | Tool | Priority |
|------|------|----------|
| **Code search** | `sg`, `rg` on local files | 1️⃣ FIRST |
| **Read function** | `rg -A 30` or `head` on deobfuscated | 1️⃣ FIRST |
| Hook function | `set_breakpoint` with condition | When needed |
| Modify code | `replace_script` | When needed |
| **Read variables/arrays** | `set_breakpoint` nearby → `get_scope_variables` | ✅ PREFERRED |
| Read global vars only | `evaluate_script` | Only if global |

### Runtime Value Extraction
**Prefer breakpoint over evaluate_script** — most vars/functions are NOT global:
```
# ✅ PREFERRED: Breakpoint near target, then inspect scope
rg -n --column "targetArray" source/*.js  # Find location
set_breakpoint(...)  # Break nearby
get_scope_variables()  # Access local scope

# ⚠️ Only for confirmed globals
evaluate_script("window.globalVar")
```

### evaluate_script Tips

`evaluate_script` works like DevTools Console. Just type a function name to see its declaration and source location:

```javascript
myFunction
// Response:
// function _0x1b01d3(){var _0xfd6122=_0x86a7ea,...}
// 📍 VM24:1:37477
```

Invaluable for locating function definitions without grepping minified code.

**For large output, use `savePath` parameter:**
```javascript
// Save large data directly to file
evaluate_script(script="JSON.stringify(largeArray)", savePath="artifacts/jsrev/{domain}/raw/data.json")
```

| Save script to file | `save_script_source` | When needed |

### Breakpoint Strategies
```javascript
// Logger (non-stopping)
set_breakpoint(urlRegex=".*target.js.*", lineNumber=123,
  condition='console.log("args:", arguments), false')

// Injection
replace_script(urlPattern=".*obfuscated.js.*",
  oldCode="function _0x123(x){...}",
  newCode="window.decoder = function _0x123(x){...};")

// Debugger bypass
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
```

### Browser Page Management
1. `list_pages` → Check if target URL open
2. If not → `new_page`

---

## 🆘 HUMAN ASSISTANCE

- **CAPTCHA**: "🆘 Encountered CAPTCHA, please complete manually."
- **Login**: "🆘 Please log in."
- **Trigger**: "🆘 Please click button to trigger request."
- **Stuck**: "🆘 Deobfuscation blocked, need assistance."

---

## ⛔ RULES

### Code Reading
**MUST use `read_code_smart` tool instead of `read_file` for all code files.**
- Handles long lines intelligently (truncates with line numbers preserved)
- Prevents context overflow from minified/beautified JS

- **LOCAL FILES FIRST**: Always check `output/*_deobfuscated.js` and `source/*_beautified.js` before using browser
- NEVER `read_file` on .js files — use `head`, `sg`, `rg`, or line-range
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- **NO BACKSLASH ESCAPING in browser tools** — especially `urlRegex` in `set_breakpoint`:
  - ❌ WRONG: `"urlRegex": ".*file.*\\.js.*"` → becomes `\\\\.` = fail
  - ✅ CORRECT: `"urlRegex": ".*file.*js.*"` or `".*file.*.js.*"`
- **PHASE 2 GATE**: MUST `read_file("skills/js_deobfuscation.md")` before ANY deobfuscation task — no exceptions
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include file:line references** — future sessions depend on this
- **LOG every session** — append to Session Log section
