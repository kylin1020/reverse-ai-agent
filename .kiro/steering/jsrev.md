---
inclusion: manual
---

# jsrev (State-Driven Edition)

## ⛔ STATE PROTOCOL

**You are an execution engine for `artifacts/jsrev/{domain}/TODO.md`.**

### 🔄 EXECUTION LOOP (Every Interaction)

1. **READ**: `TODO.md` + `NOTE.md` (create if missing)
2. **IDENTIFY**: First unchecked `[ ]` item = CURRENT TASK
3. **CHECK PHASE**: See PHASE GATE below
4. **EXECUTE**: One step to advance current task
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md` with findings

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
- Keyword search for "sign", "encrypt", "token"
- Setting breakpoints for logic tracing
- Network monitoring for parameters
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
| 4️⃣ LAST RESORT | Browser DevTools | Only when static analysis fails |

### ❌ ANTI-PATTERN: Going to Browser First
```
❌ WRONG: Open browser → search_script_content → set breakpoint → analyze
✅ RIGHT: Read deobfuscated.js → understand flow → ONLY THEN use browser if needed
```

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
- ❌ NOT for reading code that exists locally
- ❌ NOT for searching when `sg`/`rg` can do it

**🔥 REMEMBER**: Deobfuscated code is ALREADY human-readable. Don't waste time with breakpoints when you can just READ the code!

---

## 📋 TODO.md TEMPLATE

```markdown
# JS Reverse Engineering Plan: {domain}

## Target
- URL: {target_url}
- API: {api_endpoint}
- Parameter: {target_param}

## Phase 1: Discovery & Detection
- [ ] Initialize environment (dirs, network check)
- [ ] Locate main logic files (source/*.js)
- [ ] **OBFUSCATION AUDIT**: Detect patterns
    - String arrays / hex vars (`var _0x...`)
    - Control flow flattening (switch-case)
    - String encoding (XOR, Base64, custom)
    - *If found → Add specific Phase 2 tasks*

## Phase 2: Deobfuscation (⛔ BLOCKS Phase 3)
- [ ] Beautify minified code
- [ ] Identify decoder functions (signature, key)
- [ ] Extract string arrays (scripts/extract_*.js)
- [ ] Generate output/*_deobfuscated.js

## Phase 3: Analysis (⛔ REQUIRES Phase 2 complete)
- [ ] Locate target param construction (keyword search)
- [ ] Trace algorithm entry point (breakpoint)
- [ ] Document data structure (types, lengths, encoding)
- [ ] Identify encryption/encoding functions

## Phase 4: Implementation
- [ ] Python skeleton (lib/*.py)
- [ ] Core algorithms (encoder, encryptor)
- [ ] Parameter builder (assemble final output)

## Phase 5: Verification & Documentation
- [ ] Capture real request for comparison
- [ ] Test against live API (repro/*.py)
- [ ] Fix discrepancies until API accepts
- [ ] Write README.md (algorithm summary, data flow)
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

**❌ DO NOT use `search_script_content` when deobfuscated files exist locally!**

### Phase 3: Breakpoint Workflow (ONLY when static analysis fails)
1. Find line: `sg run -p 'pattern' --json | jq '.[0].range.start.line'`
2. Set breakpoint: `set_breakpoint(urlRegex=".*main.js.*", lineNumber=123)`
3. Trigger: Ask human or `evaluate_script`
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
| Browser script search | `search_script_content` | 4️⃣ LAST RESORT |
| Hook function | `set_breakpoint` with condition | 4️⃣ LAST RESORT |
| Modify code | `replace_script` | When needed |
| Read variables | `get_scope_variables` | Runtime only |
| Run JS in page | `evaluate_script` | Runtime only |
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

- **LOCAL FILES FIRST**: Always check `output/*_deobfuscated.js` and `source/*_beautified.js` before using browser
- **NO BROWSER FOR READING**: If deobfuscated code exists locally, DO NOT use `search_script_content` or breakpoints to understand it
- NEVER `read_file` on .js files — use `head`, `sg`, `rg`, or line-range
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- **PHASE 2 GATE**: MUST `read_file("skills/js_deobfuscation.md")` before ANY deobfuscation task — no exceptions
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include file:line references** — future sessions depend on this
- **LOG every session** — append to Session Log section
