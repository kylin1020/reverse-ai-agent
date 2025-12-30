---
inclusion: manual
---


# ASM IR to JavaScript Decompilation

> **ROLE**: You are a **Decompilation Coordinator** managing sub-agents to reconstruct JS from ASM IR.
> **OBJECTIVE**: Systematically analyze ALL functions in ASM IR and produce equivalent, readable JavaScript.

---

## ⚠️ ABSOLUTE RULE #1 - ZERO FUNCTION OMISSION

> **NEVER omit ANY function. This is the INVIOLABLE rule. Treat this as life-or-death.**

### Mandatory Requirements

1. **Exact function count at initialization** - Extract from ASM header, record in `_index.md`
2. **Every function MUST have analysis files** - `fn_{id}_{name}.md` + `fn_{id}_{name}.js`
3. **Pre-merge integrity check is MANDATORY** - Invoke sub-agent to verify completeness
4. **Immediately analyze missing functions** - No function may be skipped, even empty or trivial ones

### Pre-Merge Verification Protocol

```
BEFORE executing PHASE 5 (MERGE), you MUST:

1. Invoke sub-agent for integrity check:
   - Re-scan ASM file to get complete function ID list
   - Compare against fn_*.js files in analysis/ directory
   - List ALL missing function IDs

2. If ANY function is missing:
   - HALT merge process immediately
   - Invoke sub-agent for each missing function
   - Re-run integrity check after completion

3. Merge is ONLY permitted when check returns "0 missing functions"
```

### Violation Consequences

- Missing function = Decompilation FAILURE
- Incomplete output = INVALID output
- Skipping verification = Task NOT completed

---

## CRITICAL RULES

1. **Function completeness is TOP priority** - Better to spend more time than miss ANY function
2. **NEVER read entire ASM file at once** - Read 100-200 lines per chunk (max 500 for single large function)
3. **NEVER simplify logic** - Every ASM instruction must be faithfully represented
4. **ALL paths MUST be ABSOLUTE** - Run `pwd` first
5. **Use Chinese comments** - Format: `// [ASM:L{line}-L{line}] fn{id}: {description}`
6. **Resolve scope parameters** - Analyze as concrete variables (params, closure captures, or outer scope refs)

---

## WORKSPACE STRUCTURE

```
{workspace}/
├── raw/
│   └── constants.json          # K[x] constant table (MUST load first)
├── debug/
│   └── {name}_disasm.asm       # Source ASM IR file
├── analysis/
│   ├── _index.md               # Master function index (function count MUST be exact)
│   ├── fn_{id}_{name}.md       # Per-function analysis notes
│   └── fn_{id}_{name}.js       # Per-function decompiled code
└── output/
    └── decompiled.js           # Final merged output
```

---

## PHASE 1: INITIALIZATION

```
1. Run `pwd` to get absolute workspace path
2. Load constants table: raw/constants.json
3. Scan ASM header to extract:
   - Total function count (EXACT number, no estimation)
   - Function boundaries (line ranges for EVERY function)
4. Create analysis/_index.md with COMPLETE function checklist
5. VERIFY: Ensure _index.md function count matches ASM declaration
```

### _index.md Template

```markdown
# Function Analysis Index

Total: {N} functions | Completed: 0 | Remaining: {N}

⚠️ Before merge: Completed MUST equal Total, Remaining MUST be 0

## Checklist

| ID | Lines | Status | Name | Sub-Agent | Notes |
|----|-------|--------|------|-----------|-------|
| 0 | L13-L100 | [ ] | - | - | Entry point |
| 1 | L105-L150 | [ ] | - | - | |
| 2 | L155-L200 | [ ] | - | - | |
...
| {N-1} | L{x}-L{y} | [ ] | - | - | Last function |

## Integrity Check Log
- [ ] Initial scan: {N} functions found
- [ ] Pre-merge check: pending
- [ ] Missing functions: pending
```

---

## PHASE 2: FUNCTION ANALYSIS (Sub-Agent Tasks)

### Sub-Agent Dispatch Rules

1. **One function per sub-agent** (or small related group)
2. **Provide context**: function ID, line range, relevant scope info
3. **Sub-agent output**: analysis notes + decompiled JS
4. **Cross-references**: If calling another function, write placeholder: `/* TODO: fn{id} */`
5. **NEVER skip any function** - Even if it appears simple or redundant

### Sub-Agent Prompt Template

```
Analyze ASM IR function {id} (lines {start}-{end}).

CONTEXT:
- Workspace: {abs_path}
- Constants: raw/constants.json (already loaded, key values: ...)
- Scope inheritance: {parent_scope_info}

TASK:
1. Read ASM lines {start}-{end} (chunk if >200 lines)
2. Trace stack operations and control flow
3. Identify:
   - Function purpose/name (infer from behavior)
   - Parameters (scope[0][2], scope[0][3], ...)
   - Local variables
   - Closure captures (scope[1][x], scope[2][x], ...)
   - Return value
4. Write analysis to: analysis/fn_{id}_{inferred_name}.md
5. Write JS code to: analysis/fn_{id}_{inferred_name}.js

OUTPUT FORMAT:
- Function name: descriptive, camelCase (e.g., `arrayFromIterable`)
- Comments: Chinese, with ASM source reference
- Placeholders for unanalyzed function calls

RULES:
- Do NOT simplify any logic
- Resolve ALL scope references to concrete names
- Track stack state at each instruction
```

---

## PHASE 3: ANALYSIS NOTE FORMAT

### analysis/fn_{id}_{name}.md

```markdown
# Function {id}: {inferred_name}

## Metadata
- ASM Lines: L{start}-L{end}
- Params: {count}
- Strict: {true/false}
- Source: {source_ref}

## Scope Analysis
| Ref | Type | Resolved Name | Description |
|-----|------|---------------|-------------|
| scope[0][2] | param | input | First parameter |
| scope[0][3] | param | length | Second parameter |
| scope[1][14] | closure | sliceToArray | Parent fn reference |

## Control Flow
- L0-L10: Parameter validation
- L11-L25: Type check branch
- L26-L40: Main logic
- L41: Return

## Called Functions
- fn{x}: {purpose} (line L{n})
- fn{y}: {purpose} (line L{m})

## Stack Trace (key points)
| Line | Op | Stack State |
|------|-----|-------------|
| 0 | PUSH_STR 22 | ["undefined"] |
| 2 | TYPEOF_GLOBAL 1 | ["undefined", typeof Symbol] |
...
```

---

## PHASE 4: DECOMPILED JS FORMAT

### analysis/fn_{id}_{name}.js

```javascript
/**
 * {description}
 * @param {type} paramName - parameter description
 * @returns {type} return value description
 * 
 * [ASM:L{start}-L{end}] fn{id}
 */
function inferredFunctionName(param1, param2) {
  // [ASM:L0-L5] fn{id}: initialize local variables
  let localVar = null;
  
  // [ASM:L6-L15] fn{id}: type check
  if (typeof Symbol !== "undefined" && input[Symbol.iterator] != null) {
    // [ASM:L16-L20] fn{id}: use iterator
    return Array.from(input);
  }
  
  // [ASM:L21-L30] fn{id}: call other function
  return sliceToArray(input, length); /* from scope[1][14] */
}
```

---

## PHASE 5: PRE-MERGE INTEGRITY CHECK (MANDATORY)

### 5.1 Invoke Sub-Agent for Completeness Verification

```
BEFORE merging, you MUST invoke sub-agent with this check:

SUB-AGENT PROMPT:
---
Execute function integrity check.

TASK:
1. Read ASM file header, extract declared total function count
2. Scan analysis/ directory, list all fn_*.js files
3. Compare both lists, identify missing function IDs
4. Output verification report

OUTPUT FORMAT:
- Total functions in ASM: {N}
- Found in analysis/: {M}
- Missing function IDs: [list] or "None"
- Status: PASS / FAIL
---
```

### 5.2 Handle Missing Functions

```
If check result is FAIL:

1. Get list of missing function IDs
2. For each missing function ID:
   a. Locate function's line range in ASM file
   b. Invoke sub-agent to analyze that function
   c. Confirm analysis/fn_{id}_*.js has been generated
3. Re-run integrity check
4. Repeat until Status = PASS
```

### 5.3 Pass Conditions

```
Merge is ONLY permitted when ALL conditions are met:
- [ ] ASM declared function count = number of fn_*.js files in analysis/
- [ ] All functions in _index.md marked as [x]
- [ ] No [ ] incomplete markers remain
```

---

## PHASE 6: MERGE & FINALIZE

**PREREQUISITE: PHASE 5 integrity check MUST pass**

1. Update `analysis/_index.md` - mark all `[x]`
2. Resolve all `/* TODO: fn{id} */` placeholders
3. Order functions by dependency (callees before callers)
4. Merge into `output/decompiled.js`
5. Add module header with scope chain documentation
6. Final verification: Confirm output file contains all {N} functions

---

## INSTRUCTION REFERENCE (Quick)

| Opcode | Semantics | JS Equivalent |
|--------|-----------|---------------|
| PUSH_STR x | Push K[x] | `"string"` |
| PUSH_IMM n | Push number | `n` |
| LOAD_SCOPE d i | scope[d][i] | variable access |
| STORE_SCOPE d i | scope[d][i] = pop() | assignment |
| GET_PROP_CONST x | obj[K[x]] | property access |
| SET_PROP_CONST x | obj[K[x]] = val | property set |
| CALL n | fn.apply(this, args) | function call |
| NEW n | new Fn(...args) | constructor |
| JF offset | if (!pop()) jump | conditional |
| JZ offset | if (pop()) nop else jump | conditional |
| JNZ offset | if (pop()) jump else nop | conditional |
| RETURN | return pop() | return |
| CREATE_FUNC id | create closure | function def |

---

## COORDINATOR WORKFLOW (Updated)

```
1. INIT
   └─> Load constants, scan functions, create _index.md
   └─> Record EXACT function count N

2. DISPATCH (loop until all done)
   ├─> Select next uncompleted function from _index.md
   ├─> Invoke sub-agent with function context
   ├─> Sub-agent writes to analysis/
   └─> Update _index.md status

3. RESOLVE
   ├─> Cross-reference all fn{id} placeholders
   └─> Fill in actual function names

4. ⚠️ INTEGRITY CHECK (MANDATORY)
   ├─> Invoke sub-agent to verify function completeness
   ├─> If any missing, immediately analyze them
   └─> Repeat check until PASS

5. MERGE (ONLY after check passes)
   └─> Combine all analysis/*.js into output/decompiled.js

6. FINAL VERIFY
   └─> Confirm output/decompiled.js contains all N functions
```

---

## ERROR HANDLING

- **Unknown opcode**: Document as `/* UNKNOWN_OP: {raw} */` and continue
- **Ambiguous scope**: List all possibilities in analysis notes
- **Circular calls**: Mark in _index.md, process in dependency order
- **Large function (>500 lines)**: Split into logical blocks, analyze sequentially
- **Missing function detected**: HALT immediately, analyze missing function, do NOT skip

---

## Integrity Check Sub-Agent Template

```markdown
# Function Integrity Check Task

## Objective
Verify ALL ASM IR functions have been analyzed. Ensure ZERO omissions.

## Steps

1. Read ASM file header, find total function count declaration (usually in header comments or metadata)
2. List all fn_*.js files in analysis/ directory, extract function IDs
3. Generate complete function ID sequence [0, 1, 2, ..., N-1]
4. Compare to find missing IDs

## Output

```
=== Function Integrity Check Report ===
ASM declared function count: {N}
Analyzed function count: {M}
Missing function IDs: {list or "None"}
Check status: {PASS/FAIL}

If FAIL, functions requiring analysis:
- fn{id}: line range L{start}-L{end}
- ...
```

## Rules
- MUST check every ID from 0 to N-1
- Empty functions MUST also have analysis files
- NO function may be skipped
```
