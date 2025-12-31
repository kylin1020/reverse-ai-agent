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

---

## ⚠️ ABSOLUTE RULE #2 - NO INVALID FUNCTIONS

> **Every function MUST have complete logic, use all declared params, and identify algorithms.**

### Prohibited Patterns

```javascript
// ❌ FORBIDDEN - simplified placeholder
function _getBehaviorSum() {
  return 0; // 简化实现
}

// ❌ FORBIDDEN - unused parameters
function processData(input, key, iv) {
  let x = globalVar;  // input, key, iv never used!
  return x;
}

// ❌ FORBIDDEN - unlabeled algorithm
function hash(data) {
  // Complex bit operations without identifying what algorithm this is
  let h = 0x67452301;  // This is MD5! Must be labeled
  ...
}
```

### Detection Criteria

A function is INVALID if:
- Body has 1-3 lines when ASM has 20+ instructions (simplified)
- Returns hardcoded 0/null/[]/{}/"" without logic
- **Declared parameters are never referenced in function body**
- Complex bit/math operations without algorithm identification
- Comments contain "简化", "占位", "TODO", "stub"

### Mandatory Response

1. **Unused params** → Re-trace ASM LOAD_SCOPE instructions for param access
2. **Simplified body** → Re-read all ASM instructions, implement full logic
3. **Unknown algorithm** → Identify by magic constants/structure, or flag for review

### Pre-Merge Verification Protocol

```
BEFORE executing PHASE 6 (SYNTHESIS), you MUST:

1. Invoke sub-agent for integrity check:
   - Re-scan ASM file to get complete function ID list
   - Compare against batch files in analysis/ directory
   - List ALL missing function IDs

2. If ANY function is missing:
   - HALT merge process immediately
   - Invoke sub-agent for each missing function
   - Re-run integrity check after completion

3. Synthesis is ONLY permitted when check returns "0 missing functions"
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
5. **⚠️ 所有注释必须使用中文** - 格式: `// [ASM:L{line}-L{line}] fn{id}: {中文描述}`
6. **Resolve scope parameters** - Analyze as concrete variables (params, closure captures, or outer scope refs)

### 中文注释要求

最终输出的 `decompiled.js` 必须：
- 文件头注释：中文
- JSDoc 函数文档：中文描述
- 行内注释：中文，带 ASM 行号引用
- 分区标题：中文（如 `// === 工具函数 ===`）
- 变量/逻辑说明：中文

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
    └── decompiled.js           # Final synthesized output
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

## PHASE 5: PRE-SYNTHESIS INTEGRITY CHECK (MANDATORY)

### 5.1 Invoke Sub-Agent for Completeness Verification

```
BEFORE synthesizing, you MUST invoke sub-agent with this check:

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
Synthesis is ONLY permitted when ALL conditions are met:
- [ ] ASM declared function count = total functions across all batch files
- [ ] All functions in _index.md marked as [x]
- [ ] No [ ] incomplete markers remain
```

---

## PHASE 6: INTELLIGENT SYNTHESIS (COORDINATOR RESPONSIBILITY)

> ⚠️ **CRITICAL**: This phase is NOT simple file concatenation!
> The Coordinator (main agent) MUST deeply understand the ASM IR and batch analysis to produce correct, coherent output.

### 6.1 Why Simple Merge Fails

Sub-agents analyze functions in isolation. They may:
- Use inconsistent variable names for the same scope reference
- Miss cross-function dependencies
- Leave unresolved placeholders (`/* TODO: fn{id} */`)
- Have incomplete closure chain understanding
- Use different naming conventions across batches

**The Coordinator MUST fix these issues through intelligent synthesis.**

### 6.2 Coordinator's Synthesis Responsibilities

**PREREQUISITE: PHASE 5 integrity check MUST pass**

#### Step 1: Build Global Understanding

```
1. Read ALL batch files in analysis/ directory
2. Build a mental model of:
   - Complete function call graph (who calls whom)
   - Scope chain relationships (which functions share closures)
   - Variable naming across batches (detect inconsistencies)
   - Entry points and module structure
```

#### Step 2: Cross-Reference Validation

```
For EACH function in batch files:
1. Verify scope references match actual variable definitions
2. Check that fn{id} placeholders can be resolved to real function names
3. Validate closure captures are correctly identified
4. Ensure parameter counts match call sites
```

#### Step 3: Inconsistency Resolution

```
When inconsistencies are found:
1. Re-read relevant ASM sections to determine correct interpretation
2. Choose the most accurate naming/implementation
3. Document resolution decisions in output comments

Common issues to fix:
- scope[1][5] called "config" in batch_001 but "options" in batch_003
  → Read ASM, determine actual usage, unify naming
- fn23 returns object in batch_002 but caller in batch_004 expects array
  → Re-analyze fn23's ASM to verify return type
- Closure variable captured but never used
  → Check if sub-agent missed usage, or if it's truly dead code
```

#### Step 4: Dependency-Ordered Output

```
1. Topologically sort functions by call dependencies
2. Place utility/helper functions before their callers
3. Group related functions (same closure scope) together
4. Add section comments for logical groupings
```

#### Step 5: Final Code Generation

```
Write output/decompiled.js with:
1. 中文模块头注释，说明作用域链结构
2. Constants section (if needed)
3. Functions in dependency order
4. All placeholders resolved to actual function names
5. Consistent naming throughout
6. ⚠️ 所有注释必须是中文，带 ASM 行号引用
```

### 6.3 Synthesis Checklist

Before writing final output, verify:

```
[ ] Read and understood ALL batch files (not just extracted code)
[ ] Built complete function call graph
[ ] Identified all scope chain relationships
[ ] Resolved ALL naming inconsistencies
[ ] Verified ALL fn{id} placeholders can be resolved
[ ] Checked parameter counts match between definitions and call sites
[ ] Validated closure captures are correct
[ ] Determined correct function ordering
[ ] Total function count in output matches ASM declaration
```

### 6.4 Output Format

> ⚠️ **所有注释必须使用中文！** 包括文件头、函数文档、行内注释。

```javascript
/**
 * 从 ASM IR 反编译生成
 * 函数总数: {N}
 * 
 * 作用域链结构:
 * - 全局作用域: [全局变量列表]
 * - fn0 创建作用域，包含: [变量列表]
 *   - fn1, fn2, fn3 共享此作用域
 * - fn5 创建嵌套作用域，包含: [变量列表]
 *   - fn6, fn7 共享此嵌套作用域
 * 
 * 由 ASM IR 反编译器生成
 */

// ============================================
// 工具函数
// ============================================

/**
 * {功能描述}
 * @param {type} paramName - 参数说明
 * @returns {type} 返回值说明
 * [ASM:L{x}-L{y}] fn{id}
 */
function utilityFunction() {
  // [ASM:L{x}-L{y}] fn{id}: 初始化变量
  let result = null;
  
  // [ASM:L{x}-L{y}] fn{id}: 执行核心逻辑
  return result;
}

// ============================================
// 核心逻辑
// ============================================

/**
 * {功能描述}
 * [ASM:L{x}-L{y}] fn{id}
 */
function coreFunction() {
  // 调用 utilityFunction (从 fn{id} 占位符解析)
  return utilityFunction();
}

// ... 按依赖顺序排列更多函数
```

### 6.5 When to Re-Analyze

If during synthesis you discover:
- A function's behavior doesn't match its callers' expectations
- Scope references that don't make sense
- Missing variable definitions
- Logical contradictions

**DO NOT GUESS. Re-read the relevant ASM sections and correct the analysis.**

```
Example:
- batch_002 says fn15 takes 2 parameters
- batch_004 shows fn15 being called with 3 arguments
- Action: Read fn15's ASM (lines L{x}-L{y}), verify actual parameter count
- If batch_002 was wrong, fix it in final output
```

---

## PHASE 7: CODE QUALITY VERIFICATION (PARALLEL SUB-AGENTS)

> After synthesis, dispatch multiple sub-agents concurrently to check different function groups.
> Main agent is responsible for fixing any issues found.

### 7.1 Issue Types

| Type | Symptom | Root Cause |
|------|---------|------------|
| `simplified` | Body is just `return 0/null/[]` | ASM logic skipped |
| `unused_params` | Declared params never referenced in body | Scope analysis wrong |
| `missing_constant` | Expected strings missing | Constants not loaded |
| `undefined_ref` | Calls undefined function/var | ASM analysis incomplete |
| `incomplete_logic` | Empty branches/loops | Control flow missed |
| `unidentified_algo` | Complex bit ops without algorithm label | Algorithm not recognized |

### 7.2 Algorithm Recognition

Sub-agents MUST identify known algorithms and their variants:

**Common algorithms to detect:**
- Hash: MD5, SHA1, SHA256, CRC32
- Cipher: AES, DES, RC4, TEA/XTEA
- Encoding: Base64, Base32, Hex
- Custom: XOR chains, bit rotation, lookup tables

**Detection signals:**
- Magic constants (e.g., MD5: 0x67452301, SHA1: 0x5A827999)
- Characteristic operations (rotate, S-box lookup, Feistel structure)
- Round-based loops with specific iteration counts
- Large constant arrays (S-boxes, permutation tables)

**Required action:**
- Label function with algorithm name: `// Algorithm: MD5 (standard)` or `// Algorithm: MD5 (modified - custom constants)`
- If modified, note differences from standard implementation
- If unrecognizable complex bit operations, flag for manual review

### 7.3 Parameter Usage Check (CRITICAL)

**Every declared parameter MUST be used in function body.**

```javascript
// ❌ WRONG - param1, param2 declared but never used
function processData(param1, param2) {
  let x = someGlobal;  // Where did param1, param2 go?
  return x + 1;
}

// ✅ CORRECT - all params referenced
function processData(param1, param2) {
  let x = param1 + param2;
  return x + 1;
}
```

**If params unused, the cause is usually:**
1. Scope analysis error - params mapped to wrong variables
2. ASM LOAD_SCOPE instructions missed
3. Closure capture confused with parameter

**Fix:** Re-read ASM, trace every LOAD_SCOPE d=0 (current scope) to find param usage.

### 7.4 Checker Sub-Agent Dispatch

Split functions into groups (~15 per group), dispatch checkers concurrently:

```
Checker Sub-Agent Task:

Check functions fn{start}-fn{end} in output/decompiled.js.
Compare against ASM lines and batch analysis files.

For each function, check:
1. Simplified: Body 1-3 lines when ASM has 20+ instructions?
2. Unused params: Any declared parameter never referenced in body?
3. Algorithm: Complex bit/math ops? Identify algorithm or flag unknown.
4. Constants: All K[x] from ASM present as strings?
5. References: All called functions defined?

Output: List of problematic functions with:
- function name
- issue type (simplified/unused_params/unidentified_algo/missing_constant/undefined_ref)
- ASM line range for re-analysis
- For unused_params: which params are unused
- For algorithms: suspected algorithm name or "unknown complex ops"
```

### 7.5 Main Agent Fix Loop

When sub-agents report issues:

```
FOR each reported issue:
  1. Read the function's ASM lines (from _index.md)
  2. Re-analyze ASM instructions completely
  3. For unused_params: trace LOAD_SCOPE d=0 to find actual param usage
  4. For algorithms: identify magic constants, label appropriately
  5. Generate correct JS implementation
  6. Replace the problematic function in decompiled.js

REPEAT quality check until all sub-agents report no issues.
```

### 7.6 Pass Criteria

- All checker sub-agents report zero issues
- No function has unused declared parameters
- All complex algorithms identified and labeled
- No simplified/placeholder functions
- No unresolved references

---

## PHASE 8: FINAL VERIFICATION

```
1. Function count in decompiled.js = ASM declared count
2. No unresolved "TODO:" or "fn{" placeholders
3. Valid JavaScript syntax
4. All quality checks passed
5. Update _index.md with final status
```

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

## COORDINATOR WORKFLOW SUMMARY

```
1. INIT: Load constants, scan functions, create _index.md

2. DISPATCH: Invoke sub-agents for batch analysis → batch_*.md

3. INTEGRITY CHECK: Verify all functions analyzed, fix missing

4. SYNTHESIS: Build call graph, resolve inconsistencies, generate decompiled.js

5. QUALITY CHECK: Dispatch parallel checker sub-agents
   → If issues found: main agent re-analyzes ASM and fixes
   → Repeat until all checkers pass

6. FINAL VERIFY: Confirm counts, no placeholders, valid JS
```

---

## ERROR HANDLING

- **Unknown opcode**: Document as `/* UNKNOWN_OP: {raw} */` and continue
- **Ambiguous scope**: List all possibilities in analysis notes
- **Circular calls**: Mark in _index.md, process in dependency order
- **Large function (>500 lines)**: Split into logical blocks, analyze sequentially
- **Missing function detected**: HALT immediately, analyze missing function, do NOT skip
- **Cross-batch inconsistency**: Re-read ASM, determine correct interpretation, document decision
- **Simplified function detected**: Re-analyze ASM, generate complete implementation, replace placeholder
- **Quality check failure**: Fix all critical issues before proceeding, re-run checkers until PASS

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
