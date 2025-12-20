# JS Reverse Engineering & Environment Emulation (AI-Optimized)

> **Context**: Javascript Inverse Engineering, Browser Fingerprinting, Anti-Bot Bypass.
> **Constraint**: **No manual GUI interaction.** All code extraction must be programmatic (CLI/Scripts).
> **Goal**: Locate entry point $\rightarrow$ **Extract specific code block** $\rightarrow$ Emulate environment.

---

## Phase 1: Locating the Entry Point (CLI & Hooks)

### 1. Keyword Discovery (CLI via `rg`)
Use `ripgrep` to locate the file path and line number of key functions without opening the full file.

```bash
# Pattern 1: Find standard encryption keywords
rg "encrypt\(|sign\(|MD5\(|AES|RSA" ./target_src -n

# Pattern 2: Find specific parameter assignment (e.g., 'token')
rg "token\s*[:=]\s*" ./target_src -n
```

### 2. Runtime Interception (The "Trap" Method)
If the code is obfuscated/packed, hook `JSON.stringify` or `eval` to dump the *generated* code to a file or stdout.

```javascript
// Inject this into the browser console or override script
const fs = require('fs'); // If running in a local proxy context
const _eval = window.eval;
window.eval = function(str) {
    if (str.includes('debugger')) {
        console.log("### DETECTED EVAL ENTRY ###");
        console.log(str); // AI captures this output
    }
    return _eval(str);
};
```

---

## Phase 2: Automated Code Extraction (The "Surgical" Phase)
*Do not output the entire file. Use these scripts to extract **only** the target function and its closure dependencies.*

### Strategy A: AST Extraction (Node.js - Recommended)
Use Babel to parse the file and extract a specific function by name. This handles nested braces correctly, which Regex fails to do.

```javascript
// instruction: Generate and run this script to extract function 'target_fn_name'
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const code = fs.readFileSync('./full_source.js', 'utf8');
const ast = parser.parse(code);

traverse(ast, {
    FunctionDeclaration(path) {
        if (path.node.id.name === 'target_fn_name') {
            const output = generate(path.node).code;
            console.log("### EXTRACTED CODE ###");
            console.log(output);
        }
    },
    // Also extract variable assignments if needed
    VariableDeclarator(path) {
        if (path.node.id.name === 'target_fn_name') {
            const output = generate(path.parentPath.node).code;
            console.log(output);
        }
    }
});
```

### Strategy B: Brace Counting Extraction (Python)
If Node.js is unavailable, use Python to read the file and extract the block by matching `{` and `}` levels.

```python
# instruction: Use this logic to extract the function text block
def extract_function(file_path, func_name):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Find start index
    start_marker = f"function {func_name}"
    start_idx = content.find(start_marker)
    if start_idx == -1: return None
    
    # 2. Brace counting logic
    open_braces = 0
    in_function = False
    extracted = []
    
    for i in range(start_idx, len(content)):
        char = content[i]
        extracted.append(char)
        
        if char == '{':
            open_braces += 1
            in_function = True
        elif char == '}':
            open_braces -= 1
        
        # If braces return to 0, function ends
        if in_function and open_braces == 0:
            return "".join(extracted)

print(extract_function("script.js", "encrypt"))
```

---

## Phase 3: Environment Patching & Emulation
*Once the code snippet is extracted to `target_snippet.js`, apply patches.*

### 1. Strategy Selector
*   **Level 1**: Code uses `window.btoa`. $\rightarrow$ **Mock Object**.
*   **Level 2**: Code uses `instanceof`. $\rightarrow$ **JSDOM/Class Mock**.
*   **Level 3**: Code checks `toString`. $\rightarrow$ **Native Hook**.

### 2. Auto-Discovery (Recursive Proxy Sniffer)
Wrap extracted code in a recursive Proxy to detect ALL missing property accesses.

```javascript
// Recursive Proxy: tracks full property path, auto-wraps nested access
const missing = new Set();
const envSniffer = (path = 'window') => new Proxy(function(){}, {
    get(t, prop) {
        if (prop === Symbol.toPrimitive) return () => '';
        if (prop === 'toString' || prop === 'valueOf') return () => '';
        const fullPath = `${path}.${String(prop)}`;
        missing.add(fullPath);
        return envSniffer(fullPath);
    },
    set(t, prop, val) {
        console.log(`[SET] ${path}.${String(prop)} =`, val);
        return true;
    },
    apply(t, thisArg, args) {
        console.log(`[CALL] ${path}()`);
        return envSniffer(`${path}()`);
    },
    construct(t, args) {
        console.log(`[NEW] ${path}`);
        return envSniffer(`new ${path}`);
    }
});

global.window = envSniffer('window');
global.document = envSniffer('document');
global.navigator = envSniffer('navigator');

// Run target code, then:
process.on('exit', () => {
    console.log('\n=== MISSING (undefined) ===');
    [...missing].sort().forEach(p => console.log(p));
});
```

**Key**: Proxy wraps every get/set/call → reveals exact property chain needed (e.g., `document.createElement().getContext`).

### 3. "Native" Code Emulation (Anti-Tamper)
Fix `toString()` detection in the patched environment.

```javascript
const makeNative = (fn, name) => {
    Object.defineProperty(fn, 'toString', { 
        value: () => `function ${name || 'native'}() { [native code] }` 
    });
    return fn;
};
// Apply: global.setTimeout = makeNative(() => {}, 'setTimeout');
```

---

## Phase 4: Verification Checklist

1.  **Extraction Integrity**: Does the extracted snippet contain syntax errors (missing `}`)? $\rightarrow$ *Retry with AST method.*
2.  **Dependency Check**: Does the snippet reference undefined variables (e.g., `_0x5a21`)? $\rightarrow$ *Use `rg` to find definition and append to snippet.*
3.  **Output Match**: Does running the snippet in Node.js produce the same hash/token as the browser?