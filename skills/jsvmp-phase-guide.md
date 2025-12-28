# JSVMP Decompilation Phase Guide

> Sub-Agent should read this file before executing phase-specific tasks.

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
read_code_smart(file_path="source/main.js", start_line=1, end_line=50)
search_code_smart(file_path="source/main.js", query="debugger")
```

### 1.3 Deobfuscate
```javascript
// Create transforms/fix_strings.js
apply_custom_transform(target_file="source/main.js", script_path="transforms/fix_strings.js")
```

---

## Phase 2: VM Structure Analysis

### 2.1 Locate Dispatcher
```javascript
// PRIMARY: AI-powered detection
find_jsvmp_dispatcher(filePath="source/main.js")

// FALLBACK: Regex if AI fails
search_code_smart(query="while\\s*\\(\\s*true")
search_code_smart(query="switch\\s*\\(")
```

### 2.2 Data Extraction (Static First)

**Priority: Static extraction > Browser extraction**

1. **Smart-FS Locate:**
```javascript
search_code_smart(query="\\[\\s*['\"].*['\"]\\s*,")  // String arrays
find_usage_smart(file="source/main.js", identifier="bytecodeArray", line=100)
```

2. **AST Transform Extract (PREFERRED):**
```javascript
// Create transforms/extract_constants.js
module.exports = function({ types: t }) {
  return {
    visitor: {
      VariableDeclarator(path) {
        if (path.node.id.name === '_0xabc123' && 
            t.isArrayExpression(path.node.init)) {
          const elements = path.node.init.elements.map(e => {
            if (t.isStringLiteral(e)) return e.value;
            if (t.isNumericLiteral(e)) return e.value;
            return null;
          });
          require('fs').writeFileSync(
            'artifacts/jsvmp/{target}/raw/constants.json',
            JSON.stringify(elements, null, 2)
          );
        }
      }
    }
  };
};

apply_custom_transform(target="source/main.js", script="transforms/extract_constants.js")
```

3. **Browser Extract (ONLY for runtime data):**
```javascript
// ⚠️ MUST use savePath
evaluate_script(
  script="JSON.stringify(window.bytecodeArray)",
  savePath="raw/bytecode.json"
)
```

---

## Phase 3-6: IR Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 3 (LIR) | bytecode | `_disasm.asm` | Explicit stack ops |
| 4 (MIR) | LIR | `_mir.txt` | Expression trees |
| 5 (HIR) | MIR | `_hir.txt` | CFG + structure |
| 6 (JS) | HIR | `_decompiled.js` | Readable code |

> **📚 IR Format**: See `#[[file:skills/jsvmp-ir-format.md]]`
> **📚 Decompiler Implementation**: See `#[[file:skills/jsvmp-decompiler.md]]`

---

## Browser Auxiliary Techniques

### Code Location (Use Smart-FS, NOT rg)
```javascript
// 1. Search to get position
search_code_smart(file="source/main.js", query="for\\(;;\\)")
// Output: [Src L1:15847]

// 2. Set breakpoint using [Src] coordinates
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
```

### Call Stack Tracing
```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
// After trigger
get_debugger_status(maxCallStackFrames=20)
```

### Log Breakpoint (No Pause)
```javascript
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log(`PC:${pc} OP:${op}`), false')
```

### Anti-Debug Bypass
```javascript
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
navigate_page(type="reload", timeout=3000)
```

### Runtime Value Extraction
```javascript
// PREFERRED: Breakpoint + scope inspection
find_usage_smart(file="source/main.js", identifier="targetVar", line=100)
set_breakpoint(..., lineNumber=1, columnNumber=5000)
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
| Variable soup | `find_usage_smart(..., line=X)` for specific scope |
| Line mismatch | Trust `[L:line] [Src L:col]` from Smart Tool |
| Unknown opcode | Set breakpoint at `[Src]` location to trace handler |
| Can't find dispatcher | Use `find_jsvmp_dispatcher` |
