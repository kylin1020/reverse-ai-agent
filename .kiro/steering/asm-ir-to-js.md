---
inclusion: manual
---

# ASM IR to JavaScript Decompilation

> **Role**: Decompilation Coordinator managing sub-agents to reconstruct JS from ASM IR
> **Objective**: Systematically analyze ALL functions and produce equivalent, readable JavaScript

---

## VMASM File Format (CRITICAL - READ FIRST)

**Basic Structure:**
```
@source path/to/source.js
@dispatcher_line 123

// Function declarations: "function" + space + number (NOT "fn")
function 0(param1, param2) {
  // Function body with bytecode instructions
  0x0000: PUSH_IMM 1
  0x0004: RETURN
}

function 150(mode, flag, dataType, urlParams, body, userAgent, pageId, aid, version) {
  // Another function
  0x1000: LOAD_SCOPE 0 0
  ...
}
```

**Search Patterns:**
- Function definition: `function {id}\(` (e.g., `function 150\(`)
- Function call in transforms: `fn{id}\(` (e.g., `fn150(`)
- Address: `0x[0-9a-fA-F]+:`
- Opcode: After address, before operands

**ALWAYS search for:**
- ✅ `function {id}\(` - Function definition (e.g., `function 150\(`)
- ✅ `@opcode_transform.*fn{id}` - Function calls in transform comments
- ✅ `0x{address}:` - Instruction address

---

## MANDATORY VMASM Debugging for Algorithm Verification

**CRITICAL: DO NOT guess algorithm implementations - ALWAYS use VMASM debugging via Sub-Agents**

**Coordinator MUST dispatch sub-agents for algorithm verification - NEVER do it yourself**

When verifying algorithms (MD5, SHA, RC4, Base64, etc.):
1. ❌ NEVER just read ASM and guess the implementation
2. ❌ NEVER compare with "standard" algorithms without VM verification
3. ❌ NEVER verify algorithms yourself - ALWAYS dispatch sub-agent
4. ✅ ALWAYS dispatch sub-agent to set breakpoint at algorithm function entry
5. ✅ Sub-agent captures actual input parameters from VM
6. ✅ Sub-agent steps through and captures intermediate values
7. ✅ Sub-agent captures actual output from VM
8. ✅ Sub-agent writes test comparing VM values with decompiled code

**Why sub-agents are mandatory:**
- Algorithms are often modified (custom S-box, different constants, etc.)
- Static analysis misses subtle differences (forward vs reverse S-box)
- VM values are ground truth - your guesses are not
- Sub-agents have isolated context for debugging
- Coordinator context would explode with debugging details

**Example: RC4 Algorithm Verification**
```
❌ WRONG approach (Coordinator does it):
1. Coordinator reads ASM for fn279
2. Coordinator: "Looks like RC4"
3. Coordinator copies standard RC4 implementation
4. Hope it works
Result: WRONG - missed custom S-box initialization

✅ CORRECT approach (Dispatch sub-agent):
Coordinator: Dispatch sub-agent to verify fn279
Sub-Agent task:
  1. Search vmasm for "function 279\("
  2. load_vmasm({ filePath: "/abs/path/to/file.vmasm" })
  3. navigate_page({ type: "reload" })
  4. set_vmasm_breakpoint({ address: "0x{fn279_entry}" })
  5. Trigger function (interact with page)
  6. get_vm_state() - Capture input: key, data
  7. set_vmasm_breakpoint({ address: "0x{fn279_return}" })
  8. resume_execution()
  9. get_vm_state() - Capture output
  10. Write test with captured values
  11. Compare with decompiled implementation
  12. If mismatch: Step through VM to find difference
  13. Report result to coordinator
Result: CORRECT - sub-agent found reverse S-box variant
```

**If coordinator skips sub-agent dispatch:**
- Algorithm will be wrong
- Time wasted on guessing
- Need to redo work anyway
- Context explosion in coordinator

---

## Core Rules

### Rule 1: Zero Omission
- Extract exact function count at initialization, record in `_index.md`
- Every function MUST appear in batch files
- Pre-merge integrity check is MANDATORY
- Immediately analyze missing functions, never skip
- Never read entire ASM file at once, read 100-200 lines per chunk (max 500 for single large function)
- All paths MUST be absolute, run `pwd` first
- All comments MUST be in Chinese, format: `// [ASM:L{line}-L{line}] fn{id}: {中文描述}`
- Resolve scope parameters to concrete variables (params, closure captures, outer scope refs)
- **When uncertain about parameter values or constants, use VMASM debugging to verify - DO NOT GUESS**

### Rule 2: Preserve Exact Operator Semantics
- NEVER substitute operators with "equivalent" functions - they have different edge-case behavior

**Integer coercion (NOT interchangeable):**
- `~~x` ≠ `parseInt(x)`: `~~"19xs"` → 0, `parseInt("19xs")` → 19
- `x | 0` ≠ `Math.floor(x)`: `Math.floor(-1.5)` → -2, `-1.5 | 0` → -1
- `x >> 0` - signed 32-bit truncation, preserve as-is
- `x >>> 0` - unsigned 32-bit conversion, NOT `Math.abs()`

**Boolean coercion (preserve exact form):**
- `!x` - single NOT (inverted boolean)
- `!!x` - double NOT (truthy check)
- `Boolean(x)` - explicit conversion
- These are NOT equivalent for all edge cases

**Bitwise operations (NEVER simplify):**
- `& | ^ ~ << >> >>>` must remain exactly as in ASM
- `x & 0xff` ≠ `x % 256` for negative numbers
- `x >> n` ≠ `Math.floor(x / 2**n)` for negatives

**Arithmetic (preserve original):**
- `x / y | 0` - integer division, NOT `Math.trunc(x/y)`
- `x % y` - remainder (sign follows dividend)
- `Math.floor()` vs `Math.trunc()` - different for negatives

**String coercion:**
- `x + ""` ≠ `String(x)` ≠ `x.toString()` for null/undefined
- Preserve the exact form used in ASM

### Rule 3: No Invalid Functions
- Function body must implement complete logic
- All declared parameters must be used
- Complex algorithms must be labeled

Invalid function indicators:
- ASM has 20+ instructions but JS has only 1-3 lines
- Returns hardcoded 0/null/[]/{}/"" without logic
- Declared parameters never referenced in function body
- Complex bit operations without algorithm label
- Comments contain "简化", "占位", "TODO", "stub"

---

## Workspace Structure

```
{workspace}/
├── raw/constants.json           # K[x] constant table (MUST load first)
├── debug/{name}_disasm.asm      # Source ASM IR file
├── analysis/
│   ├── _index.md                # Master index (function count MUST be exact)
│   └── batch_{NNN}_fn{start}-fn{end}.md  # Batch files
└── output/decompiled.js         # Final output
```

---

## Execution Flow

### PHASE 1: Initialization
1. Run `pwd` to get absolute path
2. Load raw/constants.json
3. Scan ASM header to extract function count and boundaries
4. Create analysis/_index.md

_index.md template:
```markdown
# Function Analysis Index
Total: {N} | Completed: 0 | Remaining: {N}

| ID | Lines | Status | Name | Notes |
|----|-------|--------|------|-------|
| 0 | L13-L100 | [ ] | - | Entry |
...
```

### PHASE 2: Batch Analysis (Sub-Agents)
- ~20 functions per batch
- Output to `analysis/batch_{NNN}_fn{start}-fn{end}.md`
- Cross-function calls use placeholder: `/* TODO: fn{id} */`

Sub-agent prompt template:
```
Analyze ASM IR functions {id_start}-{id_end} (batch {NNN})

Context:
- Workspace: {abs_path}
- Constants: raw/constants.json
- Scope inheritance: {parent_scope_info}
- VMASM file: {vmasm_path} (use for debugging ambiguous cases)

Task:
1. Read ASM lines for each function
2. Trace stack operations and control flow
3. Write to analysis/batch_{NNN}_fn{id_start}-fn{id_end}.md

Rules:
- Do NOT simplify any logic
- Resolve ALL scope references to concrete names
- If parameter values or constants are ambiguous, use VMASM debugging to verify
- Mark uncertain values with /* VERIFY: description */ and add to debugging checklist
```

### PHASE 3: Batch File Format

```markdown
# Batch {NNN}: Functions {start}-{end}

## fn{id}: {name}

**Metadata**
- ASM: L{start}-L{end}
- Params: {count}
- Scope: scope[0][2]=param1
- Calls: fn{x}, fn{y}

**Code**
```javascript
function name(param1) {
  // [ASM:L0-L5] fn{id}: 初始化
  return result;
}
```
```

### PHASE 4: Integrity Check (MANDATORY)

Invoke sub-agent before synthesis:
```
1. Read ASM header to get declared function count
2. Scan analysis/ directory for all batch_*.md files
3. Extract function ID list
4. Compare to find missing function IDs
5. Output: PASS or FAIL + missing list
```

Handle missing: Immediately analyze missing functions, re-check until PASS

### PHASE 5: Parallel Extraction (Sub-Agents)

Dispatch sub-agents in groups to extract JS code:
```
Sub-Agent 1: batch_001-005 → extracted_group_001.md
Sub-Agent 2: batch_006-010 → extracted_group_002.md
...
Invoke ALL sub-agents in ONE turn (parallel)
```

### PHASE 6: Intelligent Synthesis (Coordinator)

Coordinator responsibilities (NOT simple concatenation):
1. Build global understanding: call graph, scope chains, naming consistency
2. Cross-reference validation: scope refs, placeholder resolution, param counts
3. Resolve inconsistencies: re-read ASM to determine correct interpretation
4. Dependency ordering: topological sort, utilities before callers
5. Generate final code: Chinese comments with ASM line references

Synthesis checklist:
- [ ] Read and understood ALL batch files
- [ ] Built complete call graph
- [ ] Resolved ALL naming inconsistencies
- [ ] Resolved ALL fn{id} placeholders
- [ ] Verified param counts match
- [ ] Output function count matches ASM declaration
- [ ] Identified all /* VERIFY: */ markers from batch files
- [ ] Created VMASM debugging plan for ambiguous cases

### PHASE 7: Quality Verification (Parallel Sub-Agents)

Issue types:
| Type | Symptom |
|------|---------|
| simplified | Body is just return 0/null |
| unused_params | Declared params never referenced |
| unidentified_algo | Complex bit ops without algorithm label |
| missing_constant | Expected strings missing |
| undefined_ref | Calls undefined function/variable |

Algorithm recognition requirements:
- Common algorithms: MD5, SHA1, SHA256, CRC32, AES, DES, RC4, TEA, Base64
- Detection signals: magic constants, characteristic operations, round loops, S-boxes
- Must label: `// Algorithm: MD5 (standard)` or `// Algorithm: MD5 (modified)`

Fix loop: Find issue → Re-read ASM → Fix → Re-check → Until all pass

### PHASE 7.5: VMASM Incremental Verification (MANDATORY)

**Core Principle: Test-Driven Decompilation with Parallel Sub-Agents**
- For each key function/step, dispatch sub-agent to verify and write test
- Use TODO list to track verification progress
- Discover new issues → Add new TODOs → Verify → Repeat until all pass

**Verification Workspace Structure:**
```
{workspace}/
├── output/decompiled.js          # Main decompiled code
└── tests/
    ├── _verification_todo.md     # Master TODO list (MUST maintain)
    ├── test_fn{id}_{name}.js     # Per-function test files
    └── test_results.md           # Test results log
```

**_verification_todo.md Template:**
```markdown
# Verification TODO List

## Status: {passed}/{total} verified

### Priority 1: Entry & Config
- [ ] fn103: Entry function params (mode, flag, dataType, urlParams, body, ua, pageId, aid, version)
- [ ] Config object E: Verify aid, pageId, version, ddrt, boe, magic actual values

### Priority 2: Core Functions
- [ ] fn150: Signature generation - verify all 9 params
- [ ] fn279: RC4 encrypt (forward S-box) - input/output comparison
- [ ] fn280: RC4 encrypt (reverse S-box) - input/output comparison
- [ ] fn130: Base64 encode - verify table selection and output
- [ ] fn131: RC4+Base64 combo - end-to-end test

### Priority 3: Data Processing
- [ ] fn148: Data obfuscation - byte array transformation
- [ ] fn147: Array expansion - mode handling
- [ ] fn151: Version string parsing - verify ~~x behavior

### Priority 4: Discovered Issues
(Add new TODOs here as issues are found during verification)

### Completed
- [x] fn{id}: {description} - PASS @ {timestamp}
```

**Coordinator Workflow:**

**Step 1: Initialize TODO List**
- Create `tests/_verification_todo.md` with all key functions
- Prioritize: Entry → Core algorithms → Data processing → Helpers
- Group TODOs into batches (3-5 items per batch for parallel execution)

**Step 2: Dispatch Verification Sub-Agents (MANDATORY - DO NOT DO THIS YOURSELF)**

**CRITICAL: Coordinator MUST dispatch sub-agents, NEVER verify functions directly**

Why sub-agents are mandatory:
- Avoid context explosion in coordinator
- Each sub-agent has isolated debugging session
- Parallel execution speeds up verification
- Clear responsibility and error isolation

Invoke multiple sub-agents in ONE turn to verify different functions:

```
WRONG ❌: Coordinator tries to verify functions itself
- Coordinator reads vmasm
- Coordinator guesses algorithm
- Coordinator writes test
- Result: Wrong implementation, wasted time

CORRECT ✅: Coordinator dispatches sub-agents
Sub-Agent 1: Verify fn103 (Entry function)
Sub-Agent 2: Verify fn150 (Signature generation)
Sub-Agent 3: Verify fn279 (RC4 forward)
Sub-Agent 4: Verify fn280 (RC4 reverse)
Sub-Agent 5: Verify fn130 (Base64)
...
Invoke ALL sub-agents in ONE turn (parallel execution)
```

**Coordinator responsibilities:**
- Create TODO list
- Group TODOs into batches (3-5 per batch)
- Dispatch sub-agents with clear instructions
- Collect results
- Update TODO list
- Apply fixes if needed
- Re-dispatch for failed items

**Coordinator MUST NOT:**
- ❌ Read vmasm and guess implementations
- ❌ Verify functions without VMASM debugging
- ❌ Write tests without VM captured values
- ❌ Skip sub-agent dispatch to "save time"

**Sub-Agent Prompt Template:**
```
Verify function fn{id} ({name}) and write test script

Context:
- Workspace: {abs_path}
- VMASM file: {vmasm_path}
- Decompiled code: output/decompiled.js
- Function ASM location: Search for "function {id}\(" in vmasm file
- Function address: 0x{address} (get from vmasm function header)

Task:
1. Search vmasm file for "function {id}\(" to locate function definition
2. Load VMASM: load_vmasm({ filePath: "{abs_vmasm_path}" })
3. Reload page: navigate_page({ type: "reload" })
4. Set breakpoint at function entry: set_vmasm_breakpoint({ address: "0x{address}" })
5. Trigger function execution (interact with page or wait for auto-trigger)
6. When paused, capture input: evaluate_on_call_frame({ expression: "e" })
7. Set breakpoint at function return (search for RETURN instruction address)
8. Resume: resume_execution()
9. When paused at return, capture output: evaluate_on_call_frame({ expression: "stack[sp]" })
10. Write test file: tests/test_fn{id}_{name}.js
11. Run test: node tests/test_fn{id}_{name}.js
12. Report result (PASS/FAIL)

CRITICAL RULES:
- MUST use VMASM debugging - DO NOT guess by reading ASM
- MUST search "function {id}\(" NOT "function fn{id}\(" or "func {id}"
- MUST capture actual VM values, not assumed values
- MUST write runnable test script
- If function not triggered, report trigger method needed
- If breakpoint not hit, report debugging info and retry

Output format:
```json
{
  "test_file": "tests/test_fn{id}_{name}.js",
  "result": "PASS" | "FAIL",
  "vm_input": <captured_input>,
  "vm_output": <captured_output>,
  "decompiled_output": <actual_output>,
  "issue": "<description if FAIL>",
  "suggested_fix": "<fix if FAIL>",
  "new_todos": ["<new TODO items if discovered>"]
}
```
```

**Step 3: Collect Sub-Agent Results**

After all sub-agents complete, coordinator:
1. Read all test result outputs
2. Update `_verification_todo.md`:
   - Mark PASS items as `[x]` and move to Completed
   - Keep FAIL items as `[ ]` with issue notes
   - Add new TODOs to Priority 4
3. Update status count: `{passed}/{total}`

**Step 4: Fix Failed Tests**

For each FAIL item:
1. Review sub-agent's suggested fix
2. Apply fix to `output/decompiled.js`
3. Re-dispatch sub-agent to re-verify (or verify manually)
4. Update TODO when PASS

**Step 5: Handle New TODOs**

If new TODOs discovered:
1. Add to Priority 4 in `_verification_todo.md`
2. Group into new batch
3. Dispatch new sub-agents (parallel)
4. Repeat Step 3-5 until no new TODOs

**Step 6: Final Verification**

When all TODOs marked `[x]`:
1. Run all test scripts sequentially to ensure no regression
2. Verify final status: `{total}/{total} verified`
3. Archive test results to `tests/test_results.md`

**Example Sub-Agent Execution:**

```markdown
## Coordinator dispatches 5 sub-agents in parallel:

Sub-Agent 1 Task:
Verify fn151 (versionToArray)
- Breakpoint: 0x1234
- Capture input: "1.0.1.19-fix.01"
- Capture output: [1, 0, 1, 0]
- Write: tests/test_fn151_versionToArray.js
- Result: FAIL - actual [1, 0, 1, 19]
- Issue: Using parseInt instead of ~~
- Fix: Change .map(x => parseInt(x)) to .map(x => ~~x)

Sub-Agent 2 Task:
Verify fn279 (rc4Encrypt)
- Breakpoint: 0x2000
- Capture input: key="test", data="hello"
- Capture output: "\x8a\x3f..."
- Write: tests/test_fn279_rc4Encrypt.js
- Result: PASS ✓

... (Sub-Agent 3, 4, 5 execute in parallel)

## Coordinator collects results:
- fn151: FAIL → Apply fix, re-verify
- fn279: PASS → Mark [x]
- fn280: PASS → Mark [x]
- fn130: FAIL → New TODO: Verify table selection logic
- fn131: PASS → Mark [x]

## Update TODO:
Status: 3/5 verified
Priority 4: Discovered Issues
- [ ] fn130: Base64 table selection - verify s1 vs s4 usage
```

**Parallel Execution Benefits:**
- Avoid context explosion: Each sub-agent has isolated context
- Faster verification: Multiple functions verified simultaneously
- Clear responsibility: Each sub-agent owns one verification task
- Easy retry: Re-dispatch failed sub-agent without affecting others

**Mandatory Verification Checklist:**
- [ ] Created `tests/_verification_todo.md` with all key functions
- [ ] Dispatched sub-agents for all Priority 1 items (parallel)
- [ ] Dispatched sub-agents for all Priority 2 items (parallel)
- [ ] Dispatched sub-agents for all Priority 3 items (parallel)
- [ ] Dispatched sub-agents for all Priority 4 items (parallel)
- [ ] All FAIL items fixed and re-verified
- [ ] Final status: {total}/{total} verified
- [ ] No FAIL items remaining
- [ ] All test scripts runnable and passing

### PHASE 8: Final Verification
- Function count matches
- No unresolved placeholders
- Valid JS syntax
- Update _index.md status

---

## Instruction Reference

| Opcode | Semantics | Stack Effect | JS Equivalent |
|--------|-----------|--------------|---------------|
| PUSH_STR x | Push K[x] | → sp | `"string"` |
| PUSH_IMM n | Push number | → sp | `n` |
| LOAD_SCOPE d i | scope[d][i] | → sp | variable access |
| STORE_SCOPE d i | scope[d][i] = pop() | sp → | assignment |
| GET_PROP_CONST x | obj[K[x]] | → sp | property access |
| SET_PROP_CONST x | obj[K[x]] = val | sp → | property set |
| CALL n | fn.apply(this, args) | pop n+2, push 1 | function call |
| NEW n | new Fn(...args) | pop n+1, push 1 | constructor |
| JF offset | if (!pop()) jump | sp → | conditional |
| RETURN | return pop() | sp → | return |
| CREATE_FUNC id | create closure | → sp | function def |

---

## Error Handling

- Unknown opcode: Record `/* UNKNOWN_OP: {raw} */` and continue
- Ambiguous scope: List all possibilities in analysis notes
- Circular calls: Mark in _index.md, process in dependency order
- Large function (>500 lines): Split into logical blocks
- Missing function detected: HALT immediately, analyze missing function
- Cross-batch inconsistency: Re-read ASM to determine correct interpretation
- Quality check failure: Fix all issues before proceeding, re-run checkers
- VMASM verification failure: Compare VM actual values with decompiled code, locate differences, re-analyze corresponding ASM
- **Test mismatch: Add to Priority 4 TODO, analyze diff, fix code, re-verify**
- **Regression detected: Add regression test, fix without breaking other tests**
- **New dependency discovered: Add dependency function to TODO list**
