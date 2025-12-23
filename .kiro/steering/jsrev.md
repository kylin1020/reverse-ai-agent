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

## ⛔ CRITICAL RULES

### 1. Smart Code Access (JS Files Only)
**NEVER use `read_file`, `cat`, `head`, `tail`, `grep`, or `rg` on `.js` files.**
- **Read**: Use `read_code_smart`. It auto-beautifies and maps lines to the ORIGINAL source (X-Ray Mode).
- **Search**: Use `search_code_smart`. It supports Regex and returns Original Line Numbers (`[Src L:C]`).
- **Trace**: Use `find_usage_smart`. It finds variable Definitions & References using AST analysis.
- **Transform**: Use `apply_custom_transform`. It handles deobfuscation while preserving Source Maps.

### 2. Standard File Access (Non-JS Files)
For `.json`, `.txt`, `.py`, `.md`, `.asm`:
- Use `read_file` (with start/end lines).
- Use `rg` (ripgrep) for searching.

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
- The `[Src L:C]` column in output ALWAYS points to the **Original Minified File**.
- **Rule**: NEVER look for `main.beautified.js`. It does not exist for you. Just read `main.js`.

| Action | Tool | Usage |
|--------|------|-------|
| **Read Code** | `read_code_smart` | `file="source/main.js", start=1, end=50` |
| **Search Text** | `search_code_smart` | `file="source/main.js", query="debugger"` |
| **Trace Var** | `find_usage_smart` | `file="...", identifier="_0xabc", line=105` |
| **Deobfuscate** | `apply_custom_transform` | `target="...", script="transforms/fix.js"` |

---

## 📝 NOTE.md — Analysis Memory

**Path**: `artifacts/jsrev/{domain}/NOTE.md`

Maintain this file to preserve analysis context across sessions.

### ⚠️ MANDATORY: File & Action Tracking

**Every NOTE.md entry MUST include:**
1. **Source file path** — where the function/data was found
2. **Original Line numbers (`[Src L:C]`)** — exact location in file
3. **Action taken** — what you did to discover this
4. **Session timestamp** — when this was discovered

### Required Sections

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Session Summary
**Task**: What was being worked on
**Files Analyzed**:
- `source/main.js` (Virtual Lines 100-200) -> [Src L1:5000-6000]
**Findings**:
- Found entry point at `[Src L1:5050]` (Virtual Line 120)
**Actions**:
1. Search `sign` -> Found 3 matches
2. Trace `_0xabc` -> Defined at Line 50
**Next**: Deobfuscate string array

## Key Functions
- `encryptFunc` — `source/main.js` @ `[Src L1:15000]`
  - Purpose: Signs the payload
  - Params: (payload, key)

## Constants & Keys
- API Key: `ABC...` — `source/main.js` @ `[Src L1:500]`
```

---

## 🚨 PHASE GATE — STRICT ORDERING

**Before ANY action: "Is Phase 2 complete?"**

| Phase 2 Status | Allowed Actions |
|----------------|-----------------|
| Has `[ ]` items | Deobfuscation ONLY: extract decoders, inline strings, write `*_deob.js` |
| All `[x]` | Proceed to Phase 3 |

**❌ FORBIDDEN while Phase 2 incomplete:**
- ANY Phase 3/4/5 actions

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
- [ ] 智能阅读: `read_code_smart` 识别混淆类型
- [ ] **混淆审计**: 检测混淆模式 (通过 `search_code_smart`)
    - 字符串数组 (`_0x...`)
    - 控制流平坦化 (`switch` loops)
    - 字符串编码 (XOR, Base64)

## 阶段2: 反混淆 (⛔ 阻塞阶段3)
- [ ] 编写去混淆脚本: `transforms/fix_strings.js`
- [ ] 应用去混淆: `apply_custom_transform` → `source/*_deob.js`
- [ ] 验证: `read_code_smart("source/*_deob.js")`

## 阶段3: 分析 (⛔ 需要阶段2完成)
- [ ] 定位目标参数: `search_code_smart(query="sign")`
- [ ] 追踪数据流: `find_usage_smart`
- [ ] 记录数据结构 (类型、长度、编码)
- [ ] 识别加密/编码函数

## 阶段4: 实现
- [ ] Python骨架代码 (lib/*.py)
- [ ] 核心算法 (编码器、加密器)
- [ ] 参数构建器 (组装最终输出)

## 阶段5: 验证与文档
- [ ] 捕获真实请求用于对比
- [ ] 对接真实API测试 (repro/*.py)
- [ ] 编写 README.md
```

---

## PHASE GUIDES

### Phase 1: Detection
**Do NOT use `head`, `cat` or `grep` on JS files.**

1.  **Inspect**:
    ```javascript
    read_code_smart(file_path="source/main.js", start_line=1, end_line=50)
    ```
2.  **Search**:
    ```javascript
    search_code_smart(file_path="source/main.js", query="var _0x")
    ```

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

1.  **Search**:
    ```javascript
    search_code_smart(file_path="source/main_deob.js", query="encrypt")
    ```
2.  **Trace**:
    ```javascript
    find_usage_smart(file_path="source/main_deob.js", identifier="_0xkey", line=123)
    ```
    *(Pass the line number to target the specific variable scope)*

3.  **Breakpoint (Browser)**:
    *   Get coordinate from Smart Tool: `[Src L1:15847]`
    *   Set Breakpoint:
        ```javascript
        set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
        ```
    *   **Trigger**: Ask human.
    *   **Inspect**: `get_scope_variables()`.

### Phase 4: Implementation

**⚠️ Python env: use `uv` only**

```bash
cd artifacts/jsrev/{domain}/repro
uv init && uv add requests
uv run python repro.py
```

---

## TOOL QUICK REF

| Task | Tool | Usage |
|------|------|-------|
| **Read Code** | `read_code_smart` | `file="...", start=1, end=50` |
| **Search Text** | `search_code_smart` | `file="...", query="pattern"` |
| **Trace Var** | `find_usage_smart` | `file="...", id="x", line=10` |
| **Deobfuscate** | `apply_custom_transform` | `target="...", script="..."` |
| **Breakpoint** | `set_breakpoint` | Use `[Src]` coords from Smart Tools |
| **Read Runtime** | `get_scope_variables` | After hitting breakpoint |
| **Global Var** | `evaluate_script` | Only for globals |
| **Search Non-JS**| `rg` | `-M 200 -m 10` |

---

## 🌐 BROWSER AUXILIARY TOOLS

**Browser is for: validating static analysis, getting runtime values, locating hard-to-analyze code.**

### Key Techniques

#### 1. Runtime Value Extraction
**Prefer breakpoint over evaluate_script** — most vars/functions are NOT global:
```javascript
// ✅ PREFERRED: Breakpoint near target, then inspect scope
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

- **LOCAL FILES FIRST**: Always check `output/*_deob.js` before using browser
- NEVER `read_file` on .js files — use `search_code_smart` or `read_code_smart`
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- **PHASE 2 GATE**: MUST `read_file("skills/js_deobfuscation.md")` before ANY deobfuscation task
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [Src L:C] references** — future sessions depend on this
- **LOG every session** — append to Session Log section