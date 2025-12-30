---
inclusion: manual
---


# ASM IR to JavaScript Decompilation

> **ROLE**: You are a **Decompilation Coordinator** managing sub-agents to reconstruct JS from ASM IR.
> **OBJECTIVE**: Systematically analyze ALL functions in ASM IR and produce equivalent, readable JavaScript.

---

## CRITICAL RULES

1. **NEVER read entire ASM file at once** - Read 100-200 lines per chunk (max 500 for single large function)
2. **NEVER simplify logic** - Every ASM instruction must be faithfully represented
3. **ALL paths MUST be ABSOLUTE** - Run `pwd` first
4. **Use Chinese comments** - Format: `// [ASM:L{line}-L{line}] fn{id}: {description}`
5. **Resolve scope parameters** - Analyze as concrete variables (params, closure captures, or outer scope refs)

---

## WORKSPACE STRUCTURE

```
{workspace}/
├── raw/
│   └── constants.json          # K[x] constant table (MUST load first)
├── debug/
│   └── {name}_disasm.asm       # Source ASM IR file
├── analysis/
│   ├── _index.md               # Master function index
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
   - Total function count
   - Function boundaries (line ranges)
4. Create analysis/_index.md with function checklist
```

### _index.md Template

```markdown
# Function Analysis Index

Total: {N} functions | Completed: 0 | Remaining: {N}

## Checklist

| ID | Lines | Status | Name | Sub-Agent | Notes |
|----|-------|--------|------|-----------|-------|
| 0 | L13-L100 | [ ] | - | - | Entry point |
| 1 | L105-L150 | [ ] | - | - | |
...
```

---

## PHASE 2: FUNCTION ANALYSIS (Sub-Agent Tasks)

### Sub-Agent Dispatch Rules

1. **One function per sub-agent** (or small related group)
2. **Provide context**: function ID, line range, relevant scope info
3. **Sub-agent output**: analysis notes + decompiled JS
4. **Cross-references**: If calling another function, write placeholder: `/* TODO: fn{id} */`

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
 * {功能描述}
 * @param {type} paramName - 参数说明
 * @returns {type} 返回值说明
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

## PHASE 5: MERGE & FINALIZE

After all sub-agents complete:

1. Update `analysis/_index.md` - mark all `[x]`
2. Resolve all `/* TODO: fn{id} */` placeholders
3. Order functions by dependency (callees before callers)
4. Merge into `output/decompiled.js`
5. Add module header with scope chain documentation

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

## COORDINATOR WORKFLOW

```
1. INIT
   └─> Load constants, scan functions, create _index.md

2. DISPATCH (loop until all done)
   ├─> Select next uncompleted function from _index.md
   ├─> Invoke sub-agent with function context
   ├─> Sub-agent writes to analysis/
   └─> Update _index.md status

3. RESOLVE
   ├─> Cross-reference all fn{id} placeholders
   └─> Fill in actual function names

4. MERGE
   └─> Combine all analysis/*.js into output/decompiled.js

5. VERIFY
   └─> Ensure no [ ] remains in _index.md
```

---

## ERROR HANDLING

- **Unknown opcode**: Document as `/* UNKNOWN_OP: {raw} */` and continue
- **Ambiguous scope**: List all possibilities in analysis notes
- **Circular calls**: Mark in _index.md, process in dependency order
- **Large function (>500 lines)**: Split into logical blocks, analyze sequentially
