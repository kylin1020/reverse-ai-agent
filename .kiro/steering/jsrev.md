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
3.  **CHECK PHASE**: See the **PHASE GATE** below.
4.  **EXECUTE**: Perform **one** step to advance the Current Task.
5.  **UPDATE**: Mark `[x]` when done. Add new `[ ]` sub-tasks if complexities arise.

---

## 🚨🚨🚨 PHASE GATE — HIGHEST PRIORITY 🚨🚨🚨

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  🛑 BEFORE ANY ACTION, ASK: "Is Phase 2 (Deobfuscation) complete?"           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Phase 2 has UNCHECKED [ ] items?                                            ║
║  ════════════════════════════════                                            ║
║                                                                              ║
║  ❌ FORBIDDEN (even if you think it's "faster" or "easier"):                 ║
║     • Searching for "sign", "token", "api", "getUA", "encrypt"               ║
║     • Setting breakpoints to trace "logic flow"                              ║
║     • Monitoring network to "find parameters"                                ║
║     • Suggesting "动态分析" or "直接设断点"                                  ║
║     • ANY action that belongs to Phase 3 or Phase 4                          ║
║                                                                              ║
║  ✅ THE ONLY VALID ACTIONS:                                                  ║
║     • Working on deobfuscation tasks in TODO.md                              ║
║     • Capturing decoder outputs (e.g. `window.decoder(0x1)`)                 ║
║     • Inlining strings                                                       ║
║     • Writing `output/*_deobfuscated.js`                                     ║
║                                                                              ║
║  Phase 2 is ALL CHECKED [x]?                                                 ║
║  ══════════════════════════                                                  ║
║  ✅ You may proceed to Phase 3 (Analysis)                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**⚠️ NO SHORTCUTS**: Even if deobfuscation seems "too hard" or "unnecessary", you MUST complete Phase 2 before moving on. If you cannot complete it, ask the human for help — do NOT skip to Phase 3.

---

## 📋 TODO.md TEMPLATE

If `TODO.md` is missing, create this **EXACT** structure:

```markdown
# JS Reverse Engineering Plan: {domain}

## Phase 1: Discovery & Detection
- [ ] Initialize environment (dirs, network check)
- [ ] Locate main logic file (source/main.js)
- [ ] **OBFUSCATION AUDIT**: Detect string arrays/hex patterns
    - *Constraint*: If found, insert "Phase 2: Deobfuscation" tasks immediately.

## Phase 2: Deobfuscation (⛔ BLOCKS Phase 3)
- [ ] (Waiting for Detection...)
- [ ] *Dynamic Task*: Extract decoder function
- [ ] *Dynamic Task*: Generate output/*_deobfuscated.js

## Phase 3: Analysis (⛔ LOCKED until Phase 2 ALL [x])
- [ ] Necessity Check (Is param actually required?)
- [ ] Locate algorithm entry point (keyword search in _deobfuscated.js)
- [ ] Breakpoint Analysis (Trace parameter construction)

## Phase 4: Implementation
- [ ] Python Reproduction (lib/*.py)
```

---

## P0: DETECTION & SETUP

### Step 1: Detect Obfuscation

```bash
head -c 2000 {file}
```

Read the code content directly and identify obfuscation type:
- `var _0x...` or hex string arrays → String obfuscation
- Heavy `switch-case` nesting → Control flow flattening
- Single-line mega code → Packed/minified
- No obvious obfuscation → Can analyze directly

**Action**: If obfuscation detected, update TODO.md with specific Phase 2 tasks immediately.

### Step 2: Beautify Minified JS

If code is minified/packed (single-line mega code), beautify before analysis:

```bash
npx js-beautify -f source/main.js -o source/main_beautified.js
```

---

## P1: LOCATE ALGORITHM (⚠️ Phase 2 must be complete!)

**PREREQUISITE**: ALL items in `TODO.md` Phase 2 are checked `[x]`.

### Approach A: AST-Grep Structural Search

```bash
# Find function calls with crypto-like names
sg run -p '$_FN($$$)' output/*_deobfuscated.js --json | \
  jq '[.[] | select(.text | test("md5|sha|hmac|sign|encrypt|hash"; "i"))] | .[0:5]'

# Find function definitions by name pattern
sg run -p 'function $NAME($$$) { $$$B }' output/*_deobfuscated.js --json | \
  jq '[.[] | select(.text | test("sign|encrypt|hash"; "i"))]'
```

### Approach B: Keyword Search (fallback)
```bash
rg -M 200 -o ".{0,60}(md5|sha1|sha256|hmac|sign|encrypt).{0,60}" output/*.js
```

### Approach C: Stack Tracing
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"])
```

---

## P2: BREAKPOINT STRATEGIES (⚠️ Phase 3 only!)

**Use these tools ONLY when `TODO.md` Phase 3 is active.**

### Tool Selection Guide

| Task | Tool |
|------|------|
| Find code structure (local file) | `sg run -p 'pattern' file.js` |
| Search in browser | `search_script_content` |
| Hook function | `set_breakpoint` with condition |
| Modify code | `replace_script` |
| Trace flow | `set_breakpoint` + `get_debugger_status` |
| Read variables | `get_scope_variables` |
| Call decoder | `evaluate_script` |

### Workflow: Find line → Set breakpoint

```bash
# Step 1: Find function location
sg run -p 'function sign($$$) { $$$B }' source/main.js --json | jq '.[0].range.start.line'

# Step 2: Set breakpoint at that line
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1234)
```

### Strategy A: Logger Hook (Non-Stopping)

```javascript
set_breakpoint(
    urlRegex=".*target.js.*", 
    lineNumber=123,
    condition='console.log("Called sign with:", arguments), false'
)
```

### Strategy B: Value Sniffer

```javascript
set_breakpoint(
    urlRegex=".*target.js.*", 
    lineNumber=456,
    condition='console.log("X-Auth-Token:", varName), false'
)
```

### Strategy C: Injection

```javascript
replace_script(
    urlPattern=".*obfuscated.js.*",
    oldCode="function _0x123(x){return x^2}",
    newCode="window.myDecoder = function _0x123(x){return x^2};"
)
```

### Strategy D: Debugger Bypass

```javascript
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
navigate_page(type="reload", timeout=3000)
```

---

## P4: BROWSER RUNTIME — EXECUTION FLOW

When `TODO.md` says `[ ] Trace Algorithm` (Phase 3):

1.  **Find Location**: `sg run -p 'pattern' --json | jq '.[0].range.start.line'`
2.  **Set Breakpoint**: `set_breakpoint(lineNumber=...)`
3.  **Trigger**: Ask Human "请点击 X" or trigger via `evaluate_script`.
4.  **Inspect**: `get_debugger_status()`, `get_scope_variables()`
5.  **Step**: `step_over()` or `resume_execution()`.

---

## 🆘 HUMAN ASSISTANCE

*   **CAPTCHA/Slider**: "🆘 遇到验证码，请手动完成并告诉我。"
*   **Login**: "🆘 请登录账号，然后告诉我继续。"
*   **Trigger**: "🆘 请点击按钮触发请求，以便断点生效。"
*   **Stuck on Deobfuscation**: "🆘 反混淆遇到困难，需要人工协助。"

---

## P6: PYTHON IMPLEMENTATION

```bash
cd artifacts/jsrev/{domain}/repro && uv init && uv add requests
uv run python repro.py
```

---

## 🔍 AST-GREP (sg) — REFERENCE

### When to use

| Scenario | Use `sg` | Use MCP |
|----------|----------|---------|
| File on disk (source/, output/) | ✅ | ❌ |
| Browser-loaded script only | ❌ | ✅ |
| Need exact line number | ✅ | ❌ |
| Need runtime values | ❌ | ✅ |
| **Extract string array content** | ✅ | ❌ |
| **Find full code block from snippet** | ✅ | ❌ |

### Key Use Cases

1. **Extract string arrays** (for deobfuscation):
```bash
sg run -p 'var _0x$A = [$$$]' source/main.js --json | jq '.[0].text'
```

2. **Find complete function from partial match**:
```bash
# You see "abc123" in code, want the full function containing it
sg run -p 'function $_NAME($$$) { $$$BODY }' file.js --json | \
  jq '[.[] | select(.text | contains("abc123"))] | .[0].text'
```

3. **Get line number for breakpoint**:
```bash
sg run -p 'function sign($$$) { $$$B }' file.js --json | jq '.[0].range.start.line'
```

### Common Patterns

| Target | Pattern |
|--------|---------|
| String array | `var $_NAME = [$$$]` |
| Hex string array | `var _0x$A = [$$$]` |
| Decoder function | `function $_NAME($_ARG) { $$$BODY }` |
| IIFE wrapper | `(function($_ARGS) { $$$BODY })($$$)` |
| Function call | `$_FN($$$)` |
| Method call | `$_OBJ.$_METHOD($$$)` |

### Examples

```bash
# Get line number
sg run -p 'function _0x$A($_B) { $$$C }' file.js --json | jq '.[0].range.start.line'

# Filter by name
sg run -p 'function $NAME($$$) { $$$B }' file.js --json | \
  jq '[.[] | select(.text | test("sign|encrypt"; "i"))]'

# Count matches
sg run -p 'var _0x$A = [$$$]' file.js --json | jq 'length'
```

---

## MCP TOOLS QUICK REF

### Search Script Content (browser only)
```javascript
search_script_content(pattern="myFunc", urlPattern=".*target.*")
```

### Breakpoints
```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1234)
clear_all_breakpoints()
resume_execution()
```

---

## 🚀 START SESSION

**Action Required Now:**
1.  Read `artifacts/jsrev/{domain}/TODO.md`.
2.  Find the first unchecked `[ ]` item.
3.  **Check Phase Gate**: Is Phase 2 complete? If not, work on Phase 2 ONLY.
4.  Execute one step for the current task.

---

## ⛔ NEVER read entire JS files

Use `head`, `sg`, `rg`, or line-range reads instead of `read_file` / `readFile` on .js files.

---

## 📚 SKILL FILES — LOAD WHEN NEEDED

When entering Phase 2 (Deobfuscation), **MUST read** the relevant skill file:

```
skills/js_deobfuscation.md  → String array decoding, control flow unflattening
```

**Action**: At Phase 2 start, run `read_file("skills/js_deobfuscation.md")` to load techniques.
