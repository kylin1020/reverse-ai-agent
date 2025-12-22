---
inclusion: always
---

# jsrev (State-Driven Edition)

## ⛔ STOP: READ THIS FIRST — STATE PROTOCOL

**You are NOT a stateless chatbot.** You are an execution engine for `artifacts/jsrev/{domain}/TODO.md`.

### 🔄 THE EXECUTION LOOP (MANDATORY)

At the start of **EVERY** interaction, execute these checks:

1.  **READ STATE**: read_file(artifacts/jsrev/{domain}/TODO.md)
    *   *Missing?* → Create it using the **Template** below.
2.  **IDENTIFY TASK**: Read the first **unchecked** `[ ]` item. This is your **CURRENT TASK**.
3.  **CHECK PHASE**:
    *   Is Current Task = "Deobfuscate"? → **LOCKDOWN MODE**.
        *   ❌ FORBIDDEN: searching `sign`, `api`, setting logic breakpoints.
        *   ✅ ALLOWED: `skills/js_deobfuscation.md`, dumping strings.
4.  **EXECUTE**: Perform **one** step to advance the Current Task.
5.  **UPDATE**: Mark `[x]` when done. Add new `[ ]` sub-tasks if complexities arise.

---

## 📋 TODO.md TEMPLATE

If `TODO.md` is missing, create this **EXACT** structure:

```markdown
# JS Reverse Engineering Plan: {domain}

## Phase 1: Discovery & Detection
- [ ] Initialize environment (dirs, network check)
- [ ] Locate main logic file (source/main.js)
- [ ] **OBFUSCATION AUDIT**: Check first 2000 chars for arrays/hex
    - *Constraint*: If found, insert "Phase 2: Deobfuscation" tasks immediately.

## Phase 2: Deobfuscation (⛔ BLOCKS ANALYSIS)
- [ ] (Waiting for Detection...)
- [ ] *Dynamic Task*: Extract decoder function
- [ ] *Dynamic Task*: Generate output/*_deobfuscated.js

## Phase 3: Analysis (⛔ LOCKED until Phase 2 Complete)
- [ ] Necessity Check (Is param actually required?)
- [ ] Locate algorithm entry point (keyword search in _deobfuscated.js)
- [ ] Breakpoint Analysis (Trace parameter construction)

## Phase 4: Implementation
- [ ] Python Reproduction (lib/*.py)
```

---

## 🚨 DEOBFUSCATION GATE — NO EXCEPTIONS

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🚨 STATE CHECK: DEOBFUSCATION PENDING?                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  IF `TODO.md` has unchecked items in "Phase 2: Deobfuscation":               ║
║                                                                              ║
║  ❌ STRICTLY FORBIDDEN ACTIONS:                                              ║
║     • Searching for "sign", "token", "api", "getUA"                          ║
║     • Setting breakpoints to trace "logic flow"                              ║
║     • Monitoring network to "find parameters"                                ║
║                                                                              ║
║  ✅ THE ONLY VALID ACTIONS:                                                  ║
║     • Capturing decoder outputs (e.g. `window.decoder(0x1)`)                 ║
║     • Inlining strings                                                       ║
║     • Writing `output/*_deobfuscated.js`                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 🧠 SELF-CHECK Before Any Action

Ask yourself: **"Does `TODO.md` show Phase 2 is complete?"**
*   **NO** → You MUST work on Deobfuscation.
*   **YES** → You may proceed to P1/P2/P3.

---

## P0: DETECTION & SETUP

### Step 1: Detect
```bash
head -c 2000 {file}
```
*   **Action**: If you see `var _0x...` or hex strings, **UPDATE TODO.md** immediately to include specific deobfuscation steps.

---

## P1: LOCATE ALGORITHM (⚠️ REQUIRES DEOBFUSCATION COMPLETE)

**PREREQUISITE**: `TODO.md` Phase 2 is checked `[x]`.

### Approach A: Keyword Search (on deobfuscated code ONLY)
```bash
rg -M 200 -o ".{0,60}(md5|sha1|sha256|hmac|sign|encrypt).{0,60}" output/*.js
```

### Approach B: Stack Tracing
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"])
// Use results to find URL patterns for breakpoints
```

---

## P2: BREAKPOINT STRATEGIES (⚠️ CRITICAL SKILLS)

**Use these tools ONLY when `TODO.md` indicates "Analysis" Phase.**

### Tool Selection Guide

| Task | Tool |
|------|------|
| Search code (text/regex) | `search_script_content` |
| Search code (AST structure) | `sg run -p 'pattern' file.js` |
| Find string arrays | `sg run -p 'var $_NAME = [$$$]'` |
| Hook function | `set_breakpoint` with condition |
| Modify code | `replace_script` |
| Trace flow | `set_breakpoint` + `get_debugger_status` |
| Read variables | `get_scope_variables` |
| Call decoder | `evaluate_script` |

### 🎯 Strategy A: The Logger Hook (Non-Stopping)
Use this to collect data without interrupting the flow.

```javascript
// Log arguments of a suspicious function
set_breakpoint(
    urlRegex=".*target.js.*", 
    lineNumber=123,
    condition='console.log("Called sign with:", arguments), false' 
    // ^ Returning false prevents pausing
)
```

### 🎯 Strategy B: The Value Sniffer
Use this to verify what a specific variable holds at a specific line.

```javascript
set_breakpoint(
    urlRegex=".*target.js.*", 
    lineNumber=456,
    condition='console.log("X-Auth-Token:", _0xabc123), false'
)
```

### 🎯 Strategy C: The Injection (Heavy Duty)
Use this when you need to export internal functions or bypass debugger loops.

```javascript
// Export an internal decoder to window
replace_script(
    urlPattern=".*obfuscated.js.*",
    oldCode="function _0x123(x){return x^2}",
    newCode="window.myDecoder = function _0x123(x){return x^2};"
)
```

### 🎯 Strategy D: Infinite Debugger Bypass

```javascript
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
navigate_page(type="reload", timeout=3000)
```

---

## P4: BROWSER RUNTIME — EXECUTION FLOW

When `TODO.md` says `[ ] Trace Algorithm`:

1.  **Set Breakpoint**: `set_breakpoint(...)`
2.  **Trigger**: Ask Human "Please click X" or trigger via `evaluate_script`.
3.  **Inspect**:
    ```javascript
    get_debugger_status(maxCallStackFrames=10)
    get_scope_variables(frameIndex=0)
    ```
4.  **Step**: `step_over()` or `resume_execution()`.

---

## 🆘 HUMAN ASSISTANCE

AI focuses on **code**, human handles **interaction**.

*   **CAPTCHA/Slider**: "🆘 遇到验证码，请手动完成并告诉我。"
*   **Login**: "🆘 请登录账号，然后告诉我继续。"
*   **Trigger**: "🆘 请点击按钮触发请求，以便断点生效。"

---

## P6: PYTHON IMPLEMENTATION

```bash
cd artifacts/jsrev/{domain}/repro && uv init && uv add requests
uv run python repro.py
```

---

## 🔍 AST-GREP (sg) — STRUCTURAL CODE SEARCH

`ast-grep` is ideal for finding obfuscation patterns, string arrays, and decoder functions by AST structure rather than text.

### Basic Syntax
```bash
sg run -p 'pattern' [file_path]
```

### Common Patterns for JS Reverse Engineering

| Target | Pattern |
|--------|---------|
| String array declaration | `var $_NAME = [$$$]` |
| Hex string array | `var _0x$A = [$$$]` |
| Decoder function | `function $_NAME($_ARG) { $$$BODY }` |
| IIFE wrapper | `(function($_ARGS) { $$$BODY })($$$)` |
| Array access decoder | `$_ARR[$_IDX]` |

### Usage Examples

```bash
# Find string arrays in a specific file
sg run -p 'var $_NAME = [$$$]' source/main.js

# Find decoder-like functions (with context)
sg run -p 'function $_NAME($_A) { $$$B }' -C 3 source/main.js

# Get precise location info (JSON output for scripting)
sg run -p 'var _0x$A = [$$$]' --json source/main.js

# Search with text filter (find nodes containing "decode")
sg run -p '$ANY' --filter 'decode' source/main.js

# Limit output for minified files
sg run -p 'pattern' source/main.js | head -n 20
sg run -p 'pattern' source/main.js | cut -c 1-100

# Paginated view for large results
sg run -p 'pattern' source/main.js --color=always | less -R
```

### JSON Output for Precise Location
```bash
sg run -p 'var _0x$A = [$$$]' --json source/main.js | jq '.[0].range'
# Returns: { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 500 } }
```

### Truncate Long Matches (for minified code)
```bash
sg run -p 'pattern' source/main.js --json | \
  jq 'map(.text = (if (.text | length) > 80 then (.text[0:80] + "...") else .text end))'
```

---

## MCP TOOLS QUICK REF

### ⚠️ REGEX: NO ESCAPING NEEDED
MCP tools handle escaping automatically. Write patterns as plain text.

| Search for | Pattern (NO backslashes!) |
|------------|---------------------------|
| `arr[idx[0]]` | `arr[idx[0]]` |
| `foo.bar()` | `foo.bar()` |

### Search Script Content
```javascript
search_script_content(pattern="myFunc", urlPattern=".*target.*")
```

### Breakpoints
```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1234)
```

### Cleanup
```javascript
clear_all_breakpoints()
resume_execution()
```

---

## 🚀 START SESSION

**Action Required Now:**
1.  Check `artifacts/jsrev/{domain}/TODO.md`.
2.  If it exists, read it and execute the first unchecked item.
3.  If it does not exist, create it using the **Template** and begin Phase 1.