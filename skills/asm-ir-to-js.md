# ASM IR to JavaScript Decompilation

> **ROLE**: You are a **Dispatch-Only Coordinator**. You DO NOT analyze ASM yourself.
> **OBJECTIVE**: Batch-dispatch sub-agents to analyze functions in parallel, then merge results.

---

## ⚠️ CRITICAL: MAIN AGENT RESPONSIBILITIES

```
┌─────────────────────────────────────────────────────────────────┐
│  DURING ANALYSIS PHASE - MAIN AGENT IS FORBIDDEN FROM:          │
│  ✗ Reading ASM function bodies                                  │
│  ✗ Analyzing instruction logic                                  │
│  ✗ Tracing stack operations                                     │
│                                                                 │
│  MAIN AGENT DISPATCH DUTIES:                                    │
│  ✓ Scan function boundaries (line numbers only)                 │
│  ✓ Load constants table (for sub-agent context)                 │
│  ✓ Create TODO checklist                                        │
│  ✓ Batch-dispatch sub-agents (5-10 concurrent)                  │
│  ✓ Collect and track sub-agent results                          │
│                                                                 │
│  AFTER ALL SUB-AGENTS COMPLETE - MAIN AGENT DOES:               │
│  ✓ Read all sub-agent analysis notes and code                   │
│  ✓ Resolve cross-references between functions                   │
│  ✓ Rename TODO placeholders to actual function names            │
│  ✓ Build module structure with proper exports                   │
│  ✓ Write final integrated decompiled.js                         │
│  ✓ Add module documentation and scope chain comments            │
└─────────────────────────────────────────────────────────────────┘
```

---

## CRITICAL RULES

1. **NEVER analyze ASM yourself** - ALL analysis goes to sub-agents
2. **BATCH DISPATCH** - Send 5-10 sub-agents concurrently, wait, repeat
3. **ALL paths MUST be ABSOLUTE** - Run `pwd` first
4. **Sub-agents use Chinese comments** - Format: `// [ASM:L{line}] fn{id}: {description}`
5. **No function left behind** - Every function in checklist must be assigned

---

## WORKSPACE STRUCTURE

```
{workspace}/
├── raw/
│   └── constants.json          # K[x] constant table
├── debug/
│   └── {name}_disasm.asm       # Source ASM IR file
├── analysis/
│   ├── _index.md               # Master function checklist
│   ├── fn_{id}_{name}.md       # Per-function analysis notes
│   └── fn_{id}_{name}.js       # Per-function decompiled code
└── output/
    └── decompiled.js           # Final merged output
```

---

## PHASE 1: INITIALIZATION (Main Agent)

```
1. Run `pwd` to get absolute workspace path
2. Load raw/constants.json (pass to sub-agents as context)
3. Quick-scan ASM to extract function boundaries ONLY:
   - Search for "// ======== Function {id}" patterns
   - Record: function_id, start_line, end_line
   - DO NOT read function bodies
4. Create analysis/_index.md checklist
```

### _index.md Template

```markdown
# Function Analysis Index

Total: {N} functions | Dispatched: 0 | Completed: 0

## Checklist

| ID | Lines | Status | Assigned | Output |
|----|-------|--------|----------|--------|
| 0 | L13-L100 | [ ] | - | - |
| 1 | L105-L150 | [ ] | - | - |
| 2 | L155-L200 | [ ] | - | - |
...
```

---

## PHASE 2: BATCH DISPATCH (Main Agent)

### Dispatch Strategy

```
BATCH_SIZE = 5-10 sub-agents (adjust based on function complexity)

while uncompleted functions exist:
    1. Select next BATCH_SIZE functions from checklist
    2. For each function, invoke sub-agent with:
       - Function ID
       - Line range (start, end)
       - Absolute workspace path
       - Constants table (or path to it)
       - Known scope context (if parent already analyzed)
    3. Wait for all sub-agents in batch to complete
    4. Update _index.md with results
    5. Collect cross-reference info for next batch
```

### Sub-Agent Invocation Template

```
Invoke sub-agent for function {id}:

TASK: Analyze ASM IR function and produce equivalent JavaScript.

CONTEXT:
- Workspace: {absolute_path}
- ASM File: {absolute_path}/debug/{name}_disasm.asm
- Function ID: {id}
- Line Range: L{start} to L{end}
- Constants: {absolute_path}/raw/constants.json

OUTPUT FILES:
- Analysis: {absolute_path}/analysis/fn_{id}_INFERRED_NAME.md
- Code: {absolute_path}/analysis/fn_{id}_INFERRED_NAME.js

REQUIREMENTS:
- Read ASM in chunks (100-200 lines, max 500)
- Chinese comments with ASM source refs
- Resolve scope[d][i] to concrete variable names
- Mark unanalyzed function calls as: /* TODO: fn{x} */
- Do NOT simplify any logic

REPORT BACK:
- Inferred function name
- List of called functions (fn IDs)
- Any unresolved scope references
```

### Parallel Dispatch Example

```
# Batch 1: Functions 0-9
invokeSubAgent(fn=0, lines=L13-L100)
invokeSubAgent(fn=1, lines=L105-L150)
invokeSubAgent(fn=2, lines=L155-L200)
... (up to 10 concurrent)

# Wait for batch completion, then:
# Batch 2: Functions 10-19
...
```

---

## PHASE 3: PROGRESS TRACKING (Main Agent)

After each batch completes:

1. Read sub-agent reports
2. Update `_index.md`:
   ```markdown
   | 0 | L13-L100 | [x] | batch1 | fn_0_initModule.js |
   | 1 | L105-L150 | [x] | batch1 | fn_1_arraySlice.js |
   ```
3. Collect cross-references:
   - Which functions call which
   - Unresolved scope references
4. Pass context to next batch if needed

---

## PHASE 4: FINAL CODE INTEGRATION (Main Agent)

After ALL sub-agents completed:

### Step 1: Collect All Results

```
1. Verify _index.md has no [ ] remaining
2. Read all analysis/fn_*.md notes
3. Read all analysis/fn_*.js code files
4. Build complete call graph from sub-agent reports
```

### Step 2: Resolve Cross-References

```
For each /* TODO: fn{x} */ placeholder:
  1. Find fn{x}'s inferred name from _index.md
  2. Replace placeholder with actual function name
  3. Add import/reference comment if needed

For unresolved scope references:
  1. Cross-check with parent function's analysis
  2. Trace closure chain to find original binding
  3. Update variable names for consistency
```

### Step 3: Build Module Structure

```javascript
/**
 * JSVMP Decompiled Module
 * Source: {asm_file}
 * Functions: {total_count}
 * Generated: {timestamp}
 * 
 * 作用域链说明:
 * - scope[0]: 当前函数作用域
 * - scope[1]: 父级闭包作用域  
 * - scope[2+]: 更外层闭包
 */

// ============ 工具函数 ============
// fn1, fn2, ... (leaf functions first)

// ============ 核心逻辑 ============
// fn10, fn20, ... (mid-level functions)

// ============ 入口函数 ============
// fn0 (entry point last)

// ============ 模块导出 ============
module.exports = { ... };
```

### Step 4: Dependency-Ordered Output

```
1. Topological sort by call graph
2. Leaf functions (no outgoing calls) → top of file
3. Entry point function → bottom of file
4. Group related functions together
```

### Step 5: Write Final Output

Output to: `output/decompiled.js`

```javascript
/**
 * [模块说明 - 中文]
 * 
 * 反编译自: {source_asm}
 * 函数总数: {N}
 * 常量表: raw/constants.json
 */

// ========== 辅助函数 ==========

/**
 * 数组切片工具
 * [ASM:L105-L150] fn1
 */
function sliceToArray(arr, len) {
  // [ASM:L105-L110] fn1: 参数校验
  if (len == null || len > arr.length) {
    len = arr.length;
  }
  // [ASM:L111-L148] fn1: 创建新数组并复制
  let result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = arr[i];
  }
  return result;
}

// ... more functions ...

// ========== 入口点 ==========

/**
 * 模块初始化入口
 * [ASM:L13-L100] fn0
 */
function initModule() {
  // 使用上面定义的函数
  const helper = sliceToArray; // 原: scope[0][8]
  // ...
}

// ========== 导出 ==========
module.exports = {
  init: initModule,
  // ...
};
```

### Step 6: Quality Checks

```
[ ] All functions from _index.md included
[ ] No remaining /* TODO: fn{x} */ placeholders
[ ] All scope references resolved to names
[ ] Chinese comments preserved with ASM refs
[ ] Dependency order correct (callees before callers)
[ ] Module exports defined
```

---

## PHASE 5: DOCUMENTATION (Main Agent)

Generate `output/README.md`:

```markdown
# Decompilation Report

## Summary
- Source: {asm_file}
- Total Functions: {N}
- Entry Point: fn0 → {inferred_name}

## Function Index
| ID | Name | Purpose | Calls |
|----|------|---------|-------|
| 0 | initModule | 模块初始化 | fn1, fn4, fn5 |
| 1 | sliceToArray | 数组切片 | - |
...

## Scope Chain Map
{closure_relationship_diagram}

## Unresolved Items
{any_remaining_uncertainties}
```

---

## DEPENDENCY RESOLUTION

### Build Call Graph

From sub-agent reports, construct:
```
fn0 -> [fn1, fn4, fn5]
fn1 -> [fn8, fn9]
fn4 -> []
...
```

### Topological Sort

Output functions in dependency order:
1. Leaf functions (no outgoing calls) first
2. Then functions that only call leaves
3. Continue until entry point

---

## ERROR HANDLING

- **Sub-agent timeout**: Re-dispatch with smaller line range
- **Missing function**: Check if ID exists in ASM, re-scan boundaries
- **Circular deps**: Mark in _index.md, output in any valid order
- **Merge conflicts**: Preserve all versions, flag for manual review

---

## COORDINATOR CHECKLIST

```
DISPATCH PHASE:
[ ] 1. pwd - get absolute path
[ ] 2. Load constants.json
[ ] 3. Scan function boundaries (grep for headers only)
[ ] 4. Create _index.md with all functions
[ ] 5. Batch dispatch sub-agents (5-10 per batch)
[ ] 6. Wait and collect results
[ ] 7. Repeat until all [ ] -> [x]

INTEGRATION PHASE:
[ ] 8. Read all sub-agent analysis notes
[ ] 9. Read all sub-agent code files
[ ] 10. Build call graph from reports
[ ] 11. Resolve all /* TODO: fn{x} */ placeholders
[ ] 12. Resolve unresolved scope references
[ ] 13. Topological sort by dependencies
[ ] 14. Write output/decompiled.js with:
       - Module header and documentation
       - Functions in dependency order
       - All cross-references resolved
       - Chinese comments preserved
       - Module exports
[ ] 15. Write output/README.md
[ ] 16. Final verification - no TODOs remaining
```
