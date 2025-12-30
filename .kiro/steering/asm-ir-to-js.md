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
2. **Every function MUST be in batch files** - All analysis + JS code in `batch_{NNN}_fn{start}-fn{end}.md`
3. **Pre-merge integrity check is MANDATORY** - Invoke sub-agent to verify completeness
4. **Immediately analyze missing functions** - No function may be skipped, even empty or trivial ones

### Pre-Merge Verification Protocol

```
BEFORE executing PHASE 5 (MERGE), you MUST:

1. Invoke sub-agent for integrity check:
   - Re-scan ASM file to get complete function ID list
   - Compare against batch files in analysis/ directory
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
│   ├── batch_001_fn0-fn19.md   # Batch 1: analysis + JS code for fn0-fn19
│   ├── batch_002_fn20-fn39.md  # Batch 2: analysis + JS code for fn20-fn39
│   └── ...                     # More batches as needed
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

1. **Dispatch by batch** (~20 functions per batch, or a group of related functions)
2. **Provide context**: function IDs, line ranges, relevant scope info
3. **Sub-agent output**: All analysis notes + JS code consolidated into `analysis/batch_{NNN}_fn{start}-fn{end}.md`
4. **Cross-references**: If calling another function, write placeholder: `/* TODO: fn{id} */`
5. **NEVER skip any function** - Even if it appears simple or redundant

### Sub-Agent Prompt Template

```
Analyze ASM IR functions {id_start}-{id_end} (batch {NNN}).

CONTEXT:
- Workspace: {abs_path}
- Constants: raw/constants.json (already loaded, key values: ...)
- Scope inheritance: {parent_scope_info}

TASK:
1. Read ASM lines for each function in this batch
2. For each function:
   - Trace stack operations and control flow
   - Identify purpose, params, locals, closures, return value
3. Write everything to: analysis/batch_{NNN}_fn{id_start}-fn{id_end}.md
   - Include both analysis metadata AND decompiled JS code

OUTPUT FORMAT:
- Function names: descriptive, camelCase
- Comments: Chinese, with ASM source reference
- Batch file: contains analysis (Chinese) + JS code (Chinese comments) for all functions in batch

RULES:
- Do NOT simplify any logic
- Resolve ALL scope references to concrete names
- Write in batches due to AI output line limits
```

---

## PHASE 3: BATCH FILE FORMAT

### File Organization

**DO NOT create separate files for each function!** Consolidate everything into batch files.

File structure:
```
analysis/
├── _index.md                    # Master index (required)
├── batch_001_fn0-fn19.md        # Batch 1: analysis + JS for fn0-fn19
├── batch_002_fn20-fn39.md       # Batch 2: analysis + JS for fn20-fn39
└── ...                          # More batches
```

### Batch File Format: analysis/batch_{NNN}_fn{start}-fn{end}.md

Each batch contains ~20 functions (adjust based on AI output limits):

```markdown
# Batch {NNN}: Functions {start}-{end}

---

## fn{id}: {inferred_name}

**元数据**
- ASM: L{start}-L{end}
- 参数: {count}
- 作用域: scope[0][2]=param1, scope[1][14]=closureRef
- 调用: fn{x}, fn{y}

**代码**
\`\`\`javascript
function inferredFunctionName(param1, param2) {
  // [ASM:L0-L5] fn{id}: 初始化
  let localVar = null;
  
  // [ASM:L6-L15] fn{id}: 主逻辑
  return result;
}
\`\`\`

---

## fn{id+1}: {inferred_name}

**元数据**
- ASM: L{start}-L{end}
- 参数: {count}
- 作用域: ...
- 调用: ...

**代码**
\`\`\`javascript
function anotherFunction() {
  // ...
}
\`\`\`

---

... (继续该批次的其他函数)
```

### Batch Rules

1. **~20 functions per batch** (adjust based on function complexity)
2. **Three-digit batch numbers**: 001, 002, 003...
3. **Filename includes function range**: `batch_001_fn0-fn19.md`
4. **Write in batches**: Due to AI output line limits, write one batch file at a time

---

## PHASE 4: JS CODE FORMAT

Within each batch file, use this format for the JS code blocks (comments in Chinese):

```javascript
/**
 * {功能描述}
 * @param {type} paramName - 参数描述
 * @returns {type} 返回值描述
 * 
 * [ASM:L{start}-L{end}] fn{id}
 */
function inferredFunctionName(param1, param2) {
  // [ASM:L0-L5] fn{id}: 初始化局部变量
  let localVar = null;
  
  // [ASM:L6-L15] fn{id}: 类型检查
  if (typeof Symbol !== "undefined" && input[Symbol.iterator] != null) {
    // [ASM:L16-L20] fn{id}: 使用迭代器
    return Array.from(input);
  }
  
  // [ASM:L21-L30] fn{id}: 调用其他函数
  return sliceToArray(input, length); /* 来自 scope[1][14] */
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
2. Scan analysis/ directory, parse all batch_*.md files
3. Extract function IDs from each batch file
4. Compare both lists, identify missing function IDs
5. Output verification report

OUTPUT FORMAT:
- Total functions in ASM: {N}
- Found in batch files: {M}
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
   c. Add to appropriate batch file (or create new batch)
3. Re-run integrity check
4. Repeat until Status = PASS
```

### 5.3 Pass Conditions

```
Merge is ONLY permitted when ALL conditions are met:
- [ ] ASM declared function count = total functions across all batch files
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
   └─> Extract JS code from all batch files into output/decompiled.js

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
2. Parse all batch_*.md files in analysis/ directory, extract function IDs from `## fn{id}:` headers
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
- Empty functions MUST also be included in batch files
- NO function may be skipped
```
