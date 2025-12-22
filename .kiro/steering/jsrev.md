---
inclusion: manual
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

**🔥 PERSISTENCE PROTOCOL — NEVER GIVE UP**:
- Heavy obfuscation is EXPECTED. This is the job. Do NOT switch methods just because it's "complex".
- If one approach fails, try the NEXT technique in sequence — do NOT abandon the current step.
- Allowed escalation path: Static analysis → Browser evaluation → Hook injection → ASK HUMAN.
- **FORBIDDEN**: Saying "这太复杂了，让我们换个方法" or skipping to dynamic analysis prematurely.
- You are an execution engine, not a suggestion bot. PUSH THROUGH the difficulty.

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

## ⚠️ OUTPUT LENGTH LIMITS — MANDATORY

**ALL commands MUST limit output to prevent context explosion:**

```bash
# ✅ REQUIRED — always limit output
rg -M 200 -m 10 "pattern" file.js          # Max 200 chars/line, max 10 matches
rg -M 200 -m 5 -C 2 "pattern" file.js      # With 2 lines context
sg run -p 'pattern' file.js --json | head -c 3000   # Limit JSON output
head -c 2000 file.js                        # First 2KB only
tail -c 2000 file.js                        # Last 2KB only
```

**Limits by command type:**
| Command | Limit |
|---------|-------|
| `rg` | `-M 200 -m 10` (200 chars/line, 10 matches max) |
| `sg --json` | `\| head -c 3000` or `\| jq '.[0:5]'` |
| `head/tail` | `-c 2000` or `-n 50` |
| `cat` | ❌ NEVER use on JS files |

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
# Always limit output!
rg -M 200 -m 10 -o ".{0,60}(md5|sha1|sha256|hmac|sign|encrypt).{0,60}" output/*.js
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

## 🔍 AST-GREP (sg) — QUICK REF

**sg** is for static AST analysis on local files. Use MCP tools for browser-loaded scripts.

| Scenario | Tool |
|----------|------|
| Local file analysis | `sg` |
| Browser script | MCP `search_script_content` |
| Runtime values | MCP `evaluate_script` |

```bash
# Find function, get line number
sg run -p 'function $NAME($$$) { $$$B }' file.js --json | jq '.[0].range.start.line'

# Search by keyword
sg run -p '$_FN($$$)' file.js --json | jq '[.[] | select(.text | test("sign|encrypt"; "i"))]'
```

**For deobfuscation** (string arrays, decoders, static extraction): see `skills/js_deobfuscation.md`

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

### Browser Page Management

Before creating new pages, check existing pages first:
1. `list_pages` → Check if target URL already open
2. If not → `new_page` to create

Avoid redundant `new_page` calls for URLs already loaded.

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
skills/js_deobfuscation.md  → String array decoding, static extraction, AST transforms
```

**Action**: At Phase 2 start, run `read_file("skills/js_deobfuscation.md")` to load techniques.
