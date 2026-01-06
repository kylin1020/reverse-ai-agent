---
inclusion: manual
---

# ASM IR to JavaScript Decompilation

> **Role**: Decompilation Coordinator managing sub-agents to reconstruct JS from ASM IR
> **Objective**: Systematically analyze ALL functions and produce equivalent, readable JavaScript

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

### PHASE 7.5: VMASM Dynamic Debugging Verification (MANDATORY for Ambiguous Cases)

**When to use VMASM debugging (DO NOT GUESS):**
- Entry function parameters: Verify actual values passed from caller
- Configuration objects: Check real property values (aid, pageId, version, etc.)
- Ambiguous constants: Determine if hardcoded or computed
- Complex function parameters: Trace actual argument values
- Algorithm verification: Confirm MD5/SHA/AES implementations
- Return value validation: Verify function outputs
- Scope variable resolution: Identify closure captures vs parameters

**CRITICAL: Browser Debugging Workflow**

1. `load_vmasm({ filePath })` - Load vmasm file (MUST use absolute path)
2. `navigate_page({ type: "reload" })` - Refresh page to activate debug script
3. **`get_vm_state()` - IMMEDIATELY check VM state after page reload**
4. Based on `get_vm_state()` response:
   - If paused: Analyze state, then `resume_execution()` or continue debugging
   - If not paused: Proceed to `set_vmasm_breakpoint({ address })`
5. `set_vmasm_breakpoint({ address })` - Set breakpoint at function entry or key instruction
6. Trigger the target function execution (interact with page, call API, etc.)
7. `get_vm_state()` - Inspect VM state when paused at breakpoint
8. `evaluate_on_call_frame({ expression })` - Evaluate expressions:
   - Use `@opcode_transform` expressions from vmasm to access VM registers
   - Example: `e[0]` for first parameter, `e[1]` for second, etc.
   - Example: `E.aid` for config object properties
9. `step_over()` / `step_into()` / `resume_execution()` - Control execution flow
10. `clear_vmasm_breakpoints()` - Cleanup when done

**Debugging Examples:**

Example 1: Verify entry function parameters
```
set_vmasm_breakpoint({ address: "0x0000" })  // fn150 entry
// Trigger function call
get_vm_state()  // Check JSVMP Registers
evaluate_on_call_frame({ expression: "e" })  // Get all parameters array
evaluate_on_call_frame({ expression: "e[3]" })  // Get urlParams (4th param)
```

Example 2: Check configuration object
```
set_vmasm_breakpoint({ address: "0x1234" })  // Where config is accessed
get_vm_state()
evaluate_on_call_frame({ expression: "E" })  // Get config object
evaluate_on_call_frame({ expression: "E.aid" })  // Get specific property
evaluate_on_call_frame({ expression: "E.pageId" })
```

Example 3: Trace intermediate values
```
set_vmasm_breakpoint({ address: "0x2000" })  // Before complex calculation
get_vm_state()  // Check stack and local variables
evaluate_on_call_frame({ expression: "scope[0][10]" })  // Local variable
step_over()  // Execute one instruction
get_vm_state()  // Check result
```

**Mandatory debugging checklist:**
- [ ] Entry function: Verify ALL parameter values (mode, flag, dataType, urlParams, body, userAgent, pageId, aid, version)
- [ ] Config object: Confirm actual property values (aid, pageId, version, ddrt, boe, magic)
- [ ] All unidentified_algo functions
- [ ] All unused_params functions (verify params are actually unused)
- [ ] Key algorithm functions (MD5, RC4, Base64, etc.)
- [ ] Signature/token generation functions
- [ ] Any function with >3 parameters
- [ ] Any hardcoded constants that seem arbitrary

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
