# JSVMP Decompilation Phase Guide

Sub-Agent should read this file before executing phase-specific tasks.
**ALL file paths in Smart-FS tools MUST be ABSOLUTE (starting with `/`)**

## Path Rule (CRITICAL)

**Before using ANY Smart-FS tool, construct absolute path:**
```javascript
// Get workspace root first (from invokeSubAgent prompt or pwd)
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com";

// ALL tool calls use absolute paths:
read_code_smart({ file_path: `${WORKSPACE}/source/main.js`, start_line: 1, end_line: 50 })
search_code_smart({ file_path: `${WORKSPACE}/source/main.js`, query: "debugger" })
find_usage_smart({ file_path: `${WORKSPACE}/source/main.js`, identifier: "x", line: 100 })
find_jsvmp_dispatcher({ filePath: `${WORKSPACE}/source/main.js` })
apply_custom_transform({ target_file: `${WORKSPACE}/source/main.js`, script_path: `${WORKSPACE}/transforms/fix.js` })
```

## Phase 1: Code Preprocessing

### 1.1 Browser Reconnaissance (MUST use browser, NOT curl)
```
curl cannot: Execute JS, handle cookies, capture XHR
```

**Steps:**
1. Navigate to target URL
2. Open Network panel, filter XHR/Fetch
3. Trigger target action
4. Identify: API endpoint, request method, headers, encrypted params
5. Download relevant JS to `source/`

### 1.2 Detect Obfuscation
```javascript
// ABSOLUTE PATHS REQUIRED!
read_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", start_line: 1, end_line: 50 })
search_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", query: "debugger" })
```

### 1.3 Deobfuscate
```javascript
// Create transforms/fix_strings.js, then apply with ABSOLUTE PATHS
apply_custom_transform({
  target_file: "/abs/path/to/workspace/source/main.js",
  script_path: "/abs/path/to/workspace/transforms/fix_strings.js"
})
```

## Phase 2: VM Structure Analysis

### CRITICAL: ANALYZE CODE FIRST, NEVER GUESS!

**FORBIDDEN:**
- ❌ Assuming variable names without reading code
- ❌ Guessing bytecode format without evidence
- ❌ Assuming constant pool structure without tracing
- ❌ Writing extraction scripts based on "common patterns"

**REQUIRED WORKFLOW:**
1. **READ the actual deobfuscated code** using `read_code_smart`
2. **TRACE variable usage** using `find_usage_smart`
3. **DOCUMENT findings** in NOTE.md with exact variable names and line numbers
4. **THEN write extraction scripts** based on actual code structure

### 2.1 Locate Dispatcher
```javascript
// PRIMARY: AI-powered detection (ABSOLUTE PATH!)
find_jsvmp_dispatcher({ filePath: "/abs/path/to/workspace/source/main.js" })

// FALLBACK: Regex if AI fails (ABSOLUTE PATH!)
search_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", query: "while\\s*\\(\\s*true" })
search_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", query: "switch\\s*\\(" })
```

### 2.2 Data Extraction (ANALYZE → TRACE → EXTRACT)

**NEVER write extraction code without first understanding the actual code structure!**

#### Step 1: ANALYZE - Read and understand the code

```javascript
// First, read the dispatcher area to understand VM structure
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 100, end_line: 200 })

// Look for: How is bytecode accessed? What variables hold constants?
```

#### Step 2: TRACE - Follow variable definitions

```javascript
// Trace where 'params' comes from
find_usage_smart({ file_path: "/abs/path/source/main.js", identifier: "params", line: 150 })

// Trace the actual bytecode variable
find_usage_smart({ file_path: "/abs/path/source/main.js", identifier: "bytecode", line: 151 })

// Document in NOTE.md with exact line numbers
```

#### Step 3: UNDERSTAND - Analyze bytecode format

```javascript
// Read the decode function to understand bytecode format
search_code_smart({ file_path: "/abs/path/source/main.js", query: "decode|atob|charCodeAt" })

// Read the instruction fetch logic
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 160, end_line: 180 })
```

#### Step 4: EXTRACT - Write scripts based on actual findings

```javascript
// NOW you can write extraction script with REAL variable names from Step 1-3
// Use ACTUAL structure found in code analysis
```

### 2.3 Opcode Analysis (TRACE HANDLERS, DON'T GUESS!)

**NEVER assume opcode meanings! Each VM has different opcode mappings.**

```javascript
// Step 1: Find the switch/if-else dispatcher
search_code_smart({ file_path: "/abs/path/source/main.js", query: "switch\\s*\\(\\s*opcode" })

// Step 2: Read each case to understand what each opcode does
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 200, end_line: 300 })

// Document ACTUAL opcode meanings in NOTE.md, not guessed ones!
```

## Phase 3-7: Decompilation Pipeline

| Phase | Input | Output | Description | Key Algorithm |
|-------|-------|--------|-------------|---------------|
| 3 (LIR) | bytecode | `_disasm.asm` | Syntax analysis + IR generation | opcode → three-address code |
| 4 (MIR) | LIR | `_mir.txt` | Semantic analysis + BB partition | Stack simulation, leader identification |
| 5 (HIR) | MIR | `_hir.txt` | CFG generation + control flow analysis | Dominator tree, Interval graph, Derived sequence |
| 6 (OPT) | HIR | `_hir_opt.txt` | Data flow analysis (optional) | DU/UD chains, SSA, constant propagation |
| 7 (JS) | HIR/OPT | `_decompiled.js` | Code generation | Region-based generation, structured output |

**IR Format**: See `skills/jsvmp-ir-format.md`
**Decompiler Implementation**: See `skills/jsvmp-decompiler.md`
**Code Generation (HIR→JS)**: See `skills/jsvmp-codegen.md` ⚠️ **CRITICAL**

### Phase 5 Key Algorithms (CFG + Control Flow Analysis)

| Algorithm | Purpose |
|-----------|---------|
| **Lengauer-Tarjan** | Dominator tree computation |
| **Allen-Cocke** | Interval graph construction |
| **Derived Sequence** | CFG reducibility check |
| **Loop Type Detection** | pre_test/post_test/end_less |
| **IPDOM** | Conditional structure identification |

### Phase 6 Key Algorithms (Data Flow Analysis - Optional)

| Algorithm | Purpose |
|-----------|---------|
| **Reaching Definition** | Reaching definition analysis |
| **DU/UD Chain** | Definition-use chains |
| **SSA Split** | Variable splitting |
| **Constant Propagation** | Constant propagation |

### Phase 7 (HIR → JS) Common Pitfalls

**This is the most error-prone phase! Code loss is common if not handled correctly.**

| Problem | Symptom | Solution |
|---------|---------|----------|
| else branch lost | `if` without `else` | Separate visited sets for then/else |
| Loop body incomplete | Empty or partial `while` body | Process ALL loop nodes |
| Nested if flattened | Nested `if` becomes sequential | Calculate correct merge point (IPDOM) |
| Code order wrong | Statements out of order | Sort blocks by startAddr |

**Validation (MANDATORY after code generation):**
```bash
# Compare line counts - ratio should be 0.5-1.5
echo "HIR:" && wc -l output/bdms_hir.txt
echo "JS:" && wc -l output/bdms_decompiled.js

# If JS lines < 50% of HIR lines → CODE LOSS! Fix the generator.
```

## Browser Auxiliary Techniques

### Code Location (Use Smart-FS, NOT rg)
```javascript
// 1. Search to get position (ABSOLUTE PATH!)
search_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", query: "for\\(;;\\)" })
// Output: [Src L1:15847]

// 2. Set breakpoint using [Src] coordinates
set_breakpoint({ urlRegex: ".*main.js.*", lineNumber: 1, columnNumber: 15847 })
```

### Call Stack Tracing
```javascript
set_breakpoint({ urlRegex: ".*target.js.*", lineNumber: 1, columnNumber: 12345 })
// After trigger
get_debugger_status({ maxCallStackFrames: 20 })
```

### Log Breakpoint (No Pause)
```javascript
set_breakpoint({
  urlRegex: ".*vm.js.*",
  lineNumber: 1,
  columnNumber: 123,
  condition: 'console.log(`PC:${pc} OP:${op}`), false'
})
```

### Runtime Value Extraction
```javascript
// PREFERRED: Breakpoint + scope inspection (ABSOLUTE PATH!)
find_usage_smart({ file_path: "/abs/path/to/workspace/source/main.js", identifier: "targetVar", line: 100 })
set_breakpoint({ urlRegex: ".*main.js.*", lineNumber: 1, columnNumber: 5000 })
get_scope_variables()
```

## Common Extraction Targets

| Data Type | Static Method | Dynamic Method |
|-----------|---------------|----------------|
| String lookup table | AST: find ArrayExpression | `evaluate_script` + savePath |
| Bytecode array | AST: find large NumericLiteral[] | `evaluate_script` + savePath |
| Opcode handlers | AST: find switch cases | `get_scope_variables` at dispatcher |
| Encrypted strings | N/A (runtime only) | `evaluate_script` after decryption |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| File too big | `read_code_smart` handles automatically |
| Variable soup | `find_usage_smart({ file_path: "/abs/path/...", identifier: "x", line: X })` for specific scope |
| Line mismatch | Trust `[L:line] [Src L:col]` from Smart Tool |
| Unknown opcode | Set breakpoint at `[Src]` location to trace handler |
| Can't find dispatcher | Use `find_jsvmp_dispatcher` |
| **Path error** | **ALWAYS use absolute paths starting with `/`** |
