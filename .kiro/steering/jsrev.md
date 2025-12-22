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
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md`(in chinese) with findings

---

## 📝 NOTE.md — Analysis Memory

**Path**: `artifacts/jsrev/{domain}/NOTE.md`

Maintain this file to preserve analysis context across sessions.

### Required Sections
```markdown
## Key Functions
- `functionName` (file:line) — purpose, params, return

## Data Structures  
- `paramName`: format, encoding, example value

## Algorithm Flow
entry() → process() → encrypt() → encode() → output

## Constants & Keys
- Encryption key: `xxx`
- Custom alphabet: `abc...`
- Magic numbers: 0x1234

## Verified Facts
- [x] encrypt1 uses XOR with key "V587"
- [ ] encrypt2 algorithm unknown

## Open Questions
- How is timestamp generated?
- What triggers re-encryption?
```

**UPDATE NOTE.md when you:**
- Discover a key function's purpose
- Decode a constant or key
- Understand a data transformation
- Verify an algorithm implementation

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

## 📖 DEOBFUSCATED CODE PRIORITY

**When `*_deobfuscated.js` exists, it is your PRIMARY source for understanding logic.**

### Analysis Strategy
1. **READ deobfuscated code FIRST** — understand algorithm flow from clean code
2. **Trace function calls** — map data transformations step by step
3. **Identify key functions** — encryption, encoding, parameter assembly
4. **Cross-reference with browser** — only when static analysis is insufficient

### Code Understanding Workflow
```
Deobfuscated JS → Identify entry point → Trace call chain → Extract algorithm → Implement
```

**⚠️ DO NOT** rely solely on breakpoints when deobfuscated code is available. Static analysis of clean code is faster and more reliable.

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
Load skill file first: `read_file("skills/js_deobfuscation.md")`

### Phase 3: Analysis
```bash
# AST-Grep (preferred)
sg run -p '$_FN($$)' output/*_deobfuscated.js --json | \
  jq '[.[] | select(.text | test("sign|encrypt"; "i"))] | .[0:5]'

# Keyword search
rg -M 200 -m 10 ".{0,40}(sign|encrypt).{0,40}" output/*.js
```

### Phase 3: Breakpoint Workflow
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

| Task | Tool |
|------|------|
| Local file search | `sg`, `rg` |
| Browser script search | `search_script_content` |
| Hook function | `set_breakpoint` with condition |
| Modify code | `replace_script` |
| Read variables | `get_scope_variables` |
| Call decoder | `evaluate_script` |

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

- **CAPTCHA**: "🆘 遇到验证码，请手动完成。"
- **Login**: "🆘 请登录账号。"
- **Trigger**: "🆘 请点击按钮触发请求。"
- **Stuck**: "🆘 反混淆遇到困难，需要协助。"

---

## ⛔ RULES

- NEVER `read_file` on .js files — use `head`, `sg`, `rg`, or line-range
- Load `skills/js_deobfuscation.md` at Phase 2 start
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
