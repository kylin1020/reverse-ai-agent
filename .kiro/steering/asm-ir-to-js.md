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

### Rule 2: No Invalid Functions
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

Task:
1. Read ASM lines for each function
2. Trace stack operations and control flow
3. Write to analysis/batch_{NNN}_fn{id_start}-fn{id_end}.md

Rules:
- Do NOT simplify any logic
- Resolve ALL scope references to concrete names
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

### PHASE 7.5: VMASM Dynamic Debugging Verification (Recommended)

Use cases:
- Algorithm verification: Confirm MD5/SHA/AES implementations are correct
- Parameter tracing: Confirm actual parameter values received by functions
- Return value confirmation: Verify function return values

Tool usage:
1. `load_vmasm({ filePath })` - Load vmasm file (MUST use absolute path)
2. `navigate_page({ type: "reload" })` - Refresh page to activate debug script
3. `set_vmasm_breakpoint({ address })` - Set breakpoint at bytecode address
4. `get_vm_state()` - Get VM state when paused (IP, stack, scope)
5. `evaluate_on_call_frame({ expression })` - Evaluate expression in current frame
6. `step_over()` / `step_into()` - Step execution
7. `clear_vmasm_breakpoints()` - Cleanup breakpoints

Use `@opcode_transform` expressions from vmasm file to access VM registers (stack, scope, etc.)

Verification checklist:
- [ ] All unidentified_algo functions
- [ ] All unused_params functions
- [ ] Entry function params and return value
- [ ] Key algorithm functions
- [ ] Signature/token generation functions

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
