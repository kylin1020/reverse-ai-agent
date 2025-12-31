# JSVMP Decompilation Phase Guide

> Sub-Agent should read this file before executing phase-specific tasks.
> **⚠️ ALL file paths in Smart-FS tools MUST be ABSOLUTE (starting with `/`)**

## ⚠️ PATH RULE (CRITICAL)

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

---

## Phase 2: VM Structure Analysis

### ⚠️ CRITICAL: ANALYZE CODE FIRST, NEVER GUESS!

**FORBIDDEN:**
- ❌ Assuming variable names like `_0xabc123` without reading code
- ❌ Guessing bytecode format (e.g., "5 bytes per instruction") without evidence
- ❌ Assuming constant pool structure without tracing actual usage
- ❌ Writing extraction scripts based on "common patterns"

**REQUIRED WORKFLOW:**
1. **READ the actual deobfuscated code** using `read_code_smart`
2. **TRACE variable usage** using `find_usage_smart` to understand data flow
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

**⚠️ NEVER write extraction code without first understanding the actual code structure!**

#### Step 1: ANALYZE - Read and understand the code

```javascript
// First, read the dispatcher area to understand VM structure
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 100, end_line: 200 })

// Look for: How is bytecode accessed? What variables hold constants?
// Example output might show:
// [L:150] var pc = 0;
// [L:151] var bytecode = params.b;  // ← Found! bytecode comes from params.b
// [L:152] var constants = params.d; // ← Found! constants come from params.d
```

#### Step 2: TRACE - Follow variable definitions

```javascript
// Trace where 'params' comes from
find_usage_smart({ file_path: "/abs/path/source/main.js", identifier: "params", line: 150 })

// Trace the actual bytecode variable
find_usage_smart({ file_path: "/abs/path/source/main.js", identifier: "bytecode", line: 151 })

// Document in NOTE.md:
// - params defined at [L:50] [Src L1:1234]
// - params.b = encoded bytecode string
// - params.d = constants array
```

#### Step 3: UNDERSTAND - Analyze bytecode format

```javascript
// Read the decode function to understand bytecode format
search_code_smart({ file_path: "/abs/path/source/main.js", query: "decode|atob|charCodeAt" })

// Read the instruction fetch logic
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 160, end_line: 180 })

// Example: You might find:
// [L:165] opcode = bytecode[pc];
// [L:166] arg1 = bytecode[pc + 1];
// [L:167] arg2 = bytecode[pc + 2];
// → This tells you: 3 bytes per instruction, not 5!
```

#### Step 4: EXTRACT - Write scripts based on actual findings

```javascript
// NOW you can write extraction script with REAL variable names from Step 1-3
// transforms/extract_constants.js
module.exports = function({ types: t }) {
  return {
    visitor: {
      ObjectExpression(path) {
        // Use ACTUAL structure found in code analysis
        // e.g., if you found { b: "...", d: [...] } structure:
        const props = path.node.properties;
        const bProp = props.find(p => p.key.name === 'b' || p.key.value === 'b');
        const dProp = props.find(p => p.key.name === 'd' || p.key.value === 'd');
        
        if (bProp && dProp) {
          // Extract based on ACTUAL code structure
          const bytecode = bProp.value.value;
          const constants = dProp.value.elements.map(e => e.value);
          
          require('fs').writeFileSync('/abs/path/raw/bytecode.txt', bytecode);
          require('fs').writeFileSync('/abs/path/raw/constants.json', JSON.stringify(constants));
        }
      }
    }
  };
};
```

### 2.3 Opcode Analysis (TRACE HANDLERS, DON'T GUESS!)

**⚠️ NEVER assume opcode meanings! Each VM has different opcode mappings.**

```javascript
// Step 1: Find the switch/if-else dispatcher
search_code_smart({ file_path: "/abs/path/source/main.js", query: "switch\\s*\\(\\s*opcode" })

// Step 2: Read each case to understand what each opcode does
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 200, end_line: 300 })

// Example output:
// [L:210] case 0: stack.push(constants[arg1]); break;  // ← opcode 0 = PUSH_CONST
// [L:215] case 1: stack.push(stack.pop() + stack.pop()); break;  // ← opcode 1 = ADD
// [L:220] case 2: pc = arg1; break;  // ← opcode 2 = JMP

// Document ACTUAL opcode meanings in NOTE.md, not guessed ones!
```

### 2.4 NOTE.md Documentation Template

After analysis, document findings like this:

```markdown
## VM Structure Analysis

### Bytecode Source
- Variable: `params.b` at [L:151] [Src L1:5000]
- Format: Base64 encoded string
- Decode function: `decode()` at [L:80] [Src L1:3000]

### Constants Pool
- Variable: `params.d` at [L:152] [Src L1:5020]
- Type: Array of mixed values (strings, numbers, null)
- Count: (to be extracted)

### Instruction Format (from code analysis)
- Bytes per instruction: 3 (found at [L:165-167])
- Format: [opcode, arg1, arg2]

### Opcode Mapping (from switch cases at [L:200-300])
| Opcode | Handler | Meaning |
|--------|---------|---------|
| 0 | [L:210] | PUSH_CONST: stack.push(constants[arg1]) |
| 1 | [L:215] | ADD: stack.push(pop() + pop()) |
| 2 | [L:220] | JMP: pc = arg1 |
| ... | ... | ... |
```

---

## Phase 3-7: Decompilation Pipeline

> **理论基础**: 参考 androguard dad 反编译器的实现
> - 句法分析 → 语义分析 → 中间代码生成 → 控制流图生成 → 数据流分析 → 控制流分析 → 代码生成

| Phase | Input | Output | Description | Key Algorithm |
|-------|-------|--------|-------------|---------------|
| 3 (LIR) | bytecode | `_disasm.asm` | 句法分析 + 中间代码生成 | opcode → 三地址码 |
| 4 (MIR) | LIR | `_mir.txt` | 语义分析 + 基本块划分 | 栈模拟、leader 识别 |
| 5 (HIR) | MIR | `_hir.txt` | CFG 生成 + 控制流分析 | 支配树、区间图、导出序列 |
| 6 (OPT) | HIR | `_hir_opt.txt` | 数据流分析 (可选) | DU/UD 链、SSA、常量传播 |
| 7 (JS) | HIR/OPT | `_decompiled.js` | 代码生成 | 区域化生成、结构化输出 |

> **📚 IR Format**: See `skills/jsvmp-ir-format.md`
> **📚 Decompiler Implementation**: See `skills/jsvmp-decompiler.md`
> **📚 Code Generation (HIR→JS)**: See `skills/jsvmp-codegen.md` ⚠️ **CRITICAL**

### Phase 5 Key Algorithms (CFG + Control Flow Analysis)

| Algorithm | Purpose | Reference |
|-----------|---------|-----------|
| **Lengauer-Tarjan** | 支配树计算 | O(n·α(n)) 复杂度 |
| **Allen-Cocke** | 区间图构建 | 识别自然循环 |
| **Derived Sequence** | 导出序列 | 判断 CFG 可规约性 |
| **Loop Type Detection** | 循环类型识别 | pre_test/post_test/end_less |
| **IPDOM** | 条件结构识别 | 找 if-else 汇合点 |

### Phase 6 Key Algorithms (Data Flow Analysis - Optional)

| Algorithm | Purpose | Data Flow Equation |
|-----------|---------|-------------------|
| **Reaching Definition** | 到达定义分析 | R[n] = ∪A[pred], A[n] = (R[n]-kill) ∪ gen |
| **DU/UD Chain** | 定义-使用链 | 追踪变量的定义和使用点 |
| **SSA Split** | 变量分割 | 基于连通分量重命名变量 |
| **Constant Propagation** | 常量传播 | 单定义点变量内联替换 |

### ⚠️ Phase 7 (HIR → JS) Common Pitfalls

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

# Compare specific function
awk '/^\/\/ Function 150$/,/^\/\/ Function 151$/' output/bdms_hir.txt | wc -l
awk '/^function func_150\(/,/^function func_151\(/' output/bdms_decompiled.js | wc -l

# If JS lines < 50% of HIR lines → CODE LOSS! Fix the generator.
```

---

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

### Anti-Debug Bypass
```javascript
replace_script({ urlPattern: ".*target.js.*", oldCode: "debugger;", newCode: "" })
navigate_page({ type: "reload", timeout: 3000 })
```

### Runtime Value Extraction
```javascript
// PREFERRED: Breakpoint + scope inspection (ABSOLUTE PATH!)
find_usage_smart({ file_path: "/abs/path/to/workspace/source/main.js", identifier: "targetVar", line: 100 })
set_breakpoint({ urlRegex: ".*main.js.*", lineNumber: 1, columnNumber: 5000 })
get_scope_variables()
```

---

## Common Extraction Targets

| Data Type | Static Method | Dynamic Method |
|-----------|---------------|----------------|
| String lookup table | AST: find ArrayExpression | `evaluate_script` + savePath |
| Bytecode array | AST: find large NumericLiteral[] | `evaluate_script` + savePath |
| Opcode handlers | AST: find switch cases | `get_scope_variables` at dispatcher |
| Encrypted strings | N/A (runtime only) | `evaluate_script` after decryption |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| File too big | `read_code_smart` handles automatically |
| Variable soup | `find_usage_smart({ file_path: "/abs/path/...", identifier: "x", line: X })` for specific scope |
| Line mismatch | Trust `[L:line] [Src L:col]` from Smart Tool |
| Unknown opcode | Set breakpoint at `[Src]` location to trace handler |
| Can't find dispatcher | Use `find_jsvmp_dispatcher` |
| **Path error** | **ALWAYS use absolute paths starting with `/`** |
