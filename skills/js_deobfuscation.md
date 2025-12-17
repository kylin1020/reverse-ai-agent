# JavaScript Deobfuscation Skill

> **Trigger**: `_0x` vars, hex strings, large string arrays, anti-debugging loops  
> **Goal**: Transform obfuscated code → readable code via AST transformation  
> **Related**: `skills/jsvmp_analysis.md` (for VM-protected code)  
> **Tools**: Use `set_breakpoint` for logging. `evaluate_script` ONLY for reading globals.

---

## 0. When to Load This Skill

```
Code analysis difficult?
  │
  ├─ Anti-debugging (infinite debugger loop)?
  │     └─ YES → §1 Anti-debugging Bypass
  │
  ├─ `_0x` prefixed vars, hex strings?
  │     └─ YES → §3 AST Deobfuscation
  │
  ├─ Large string array + decoder function calls?
  │     └─ YES → §2 String Array Analysis
  │
  ├─ `while(true){switch(...)}` VM dispatcher?
  │     └─ YES → SWITCH TO: skills/jsvmp_analysis.md
  │
  └─ Code readable enough?
        └─ YES → Skip this skill
```

**Output**: Save deobfuscated code to `source/<name>_clean.js`

---

## 1. Anti-Debugging Bypass

### 1.1 Common Anti-Debug Patterns

| Pattern | Detection | Bypass |
|---------|-----------|--------|
| `debugger` statement | Infinite pause loop | DevTools: Deactivate breakpoints (Ctrl+F8) |
| `Function.constructor("debugger")` | Dynamic injection | Hook Function.prototype.constructor |
| `setInterval(debugger)` | Timed trigger | Override setInterval before load |
| `Date.now()` timing check | Detect pause | Hook Date.now with fake values |
| Console detection | `console.log.toString()` | Pre-inject console hooks |

### 1.2 Function.constructor Debugger Bypass

**Problem**: Dynamic debugger via `Function.constructor`:
```javascript
(function() { return Function("debugger"); })()();
```

**Solution via MCP**:
```javascript
add_js_replace_rule(
    ruleId="hook_constructor",
    urlPattern="target.js",
    oldCode="(function()",
    newCode=`
(function() {
    const _orig = Function.prototype.constructor;
    Function.prototype.constructor = function() {
        if (arguments[0] === "debugger") return function(){};
        return _orig.apply(this, arguments);
    };
})();
(function()`
)
```

**Manual snippet** (DevTools → Sources → Snippets, run before page load):
```javascript
Function.prototype._orig = Function.prototype.constructor;
Function.prototype.constructor = function() {
    if (arguments?.[0]?.includes?.("debugger")) return function(){};
    return Function.prototype._orig.apply(this, arguments);
};
```

### 1.3 Timing-Based Bypass

```javascript
// Hook Date.now
const _origDateNow = Date.now;
let _fakeTime = _origDateNow();
Date.now = () => (_fakeTime += Math.random() * 10 + 5, Math.floor(_fakeTime));

// Hook performance.now
const _origPerfNow = performance.now.bind(performance);
let _fakePerfTime = _origPerfNow();
performance.now = () => (_fakePerfTime += Math.random() * 10 + 5);
```

---

## 2. String Array Decoding (Key Difficulty)

### 2.1 Pattern Recognition

**Simple pattern**:
```javascript
var _0xabc = ["str1", "str2", ...];  // String array
var _0xdef = function(idx) { return _0xabc[idx]; };  // Accessor
// Usage: _0xdef(0) → "str1"
```

**Complex pattern with initialization** (CRITICAL):
```javascript
var _0xabc = ["str1", "str2", ...];  // Initial array

// Shuffler - changes array order!
(function(_arr, _count) {
    while (--_count) {
        _arr.push(_arr.shift());  // Rotate!
    }
})(_0xabc, 0x123);  // Magic number determines final order

// Decoder with transformation
var _0xdef = function(idx, key) {
    idx = idx - 0x1a2;  // Offset
    return _decode(_0xabc[idx], key);  // May include RC4/base64/XOR
};
```

### 2.2 Analysis Strategy

**Step 1**: Identify components
```javascript
// Find array declaration
grep(pattern="_0x[a-f0-9]+\\s*=\\s*\\[", type="js", head_limit=20)

// Find shuffler (IIFE with shift/push)
grep(pattern="\\.shift\\(\\)|\\.push\\(", type="js", head_limit=20)

// Find accessor function
grep(pattern="function.*return.*_0x.*\\[", type="js", head_limit=20)
```

**Step 2**: Capture FINAL array state

**CRITICAL**: Array may be modified during init!

```javascript
// PREFERRED: Set logging breakpoint AFTER init completes
set_breakpoint(
    breakpointId="after_init",
    urlRegex=".*obfuscated\\.js.*",
    lineNumber=XX,  // After shuffler IIFE
    condition='console.log("Array:", JSON.stringify(_0xabc.slice(0,10))), false'
)

// ALTERNATIVE: Read global AFTER page fully loads (evaluate_script valid for globals only)
evaluate_script(function="() => JSON.stringify(window._0xabc)")
```

**Step 3**: Analyze decoder logic
```javascript
// Common patterns:
return _arr[idx - OFFSET];           // Simple offset
return atob(_arr[idx]);              // Base64
return _rc4(_arr[idx], key);         // RC4
return _xor(_base64(_arr[idx]), k);  // Combined
```

### 2.3 Dynamic Evaluation (For Global Decoder Functions)

When decoder is a global function (not local scope):

```javascript
// 1. Find all decoder calls
grep(pattern="_0xdef\\(0x[a-f0-9]+", type="js", head_limit=100)

// 2. Read decoded values (evaluate_script ONLY for global functions)
evaluate_script(function="() => {
    const r = {};
    r['0x1a2'] = window._0xdef(0x1a2);  // Must be global!
    r['0x1a3'] = window._0xdef(0x1a3);
    return JSON.stringify(r);
}")

// 3. Save to strings_decoded.json for AST replacement
```

> ⚠️ If decoder is local/scoped, use `set_breakpoint` with logging condition instead!

### 2.4 AST String Replacement

**Feature-driven approach**: Identify pattern → Write visitor → Replace nodes.

```javascript
const decoded = require('./strings_decoded.json');
const ast = parser.parse(code);

traverse(ast, {
    CallExpression(path) {
        const { callee, arguments: args } = path.node;
        // Pattern: _0xdef(0x123) where 0x123 is hex index
        if (t.isIdentifier(callee, { name: '_0xdef' }) && 
            args.length >= 1 && t.isNumericLiteral(args[0])) {
            // Convert to hex string key
            const idx = '0x' + args[0].value.toString(16);
            if (decoded[idx]) {
                // Replace function call with decoded string literal
                path.replaceWith(t.stringLiteral(decoded[idx]));
            }
        }
    }
});
```

**Alternative pattern** (if decoder accepts multiple args):
```javascript
CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (t.isIdentifier(callee, { name: '_0xdef' }) && 
        args.length >= 1 && t.isNumericLiteral(args[0])) {
        // Handle offset: _0xdef(0x1a2 - 0x100) → lookup 0xa2
        let idx = args[0].value;
        if (args.length > 1 && t.isBinaryExpression(args[0]) && 
            args[0].operator === '-') {
            // Extract actual index from offset calculation
            const { confident, value } = path.get('arguments.0').evaluate();
            if (confident) idx = value;
        }
        const key = '0x' + idx.toString(16);
        if (decoded[key]) {
            path.replaceWith(t.stringLiteral(decoded[key]));
        }
    }
}
```

### 2.5 Common Decoder Algorithms

**RC4**:
```javascript
function rc4(str, key) {
    let s = Array.from({length: 256}, (_, i) => i), j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
        [s[i], s[j]] = [s[j], s[i]];
    }
    let i = 0, k = 0, res = '';
    for (let y = 0; y < str.length; y++) {
        i = (i + 1) % 256;
        k = (k + s[i]) % 256;
        [s[i], s[k]] = [s[k], s[i]];
        res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[k]) % 256]);
    }
    return res;
}
```

**Base64 + XOR**:
```javascript
function decode(encoded, key) {
    const str = atob(encoded);
    return [...str].map((c, i) => 
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
}
```

---

## 3. AST Deobfuscation

> **Approach**: Feature-driven deobfuscation - **Identify pattern → Write Visitor → Transform code**

### 3.1 Setup

```bash
npm init -y && npm i @babel/parser @babel/traverse @babel/types @babel/generator
```

**Core workflow**: `Code → AST → Transform → Code`

### 3.2 Standard Flow

```javascript
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;

const code = fs.readFileSync('input.js', 'utf-8');
const ast = parser.parse(code);

traverse(ast, { /* visitors */ });

const output = generator(ast, { 
    jsescOption: { minimal: true },
    compact: false,  // Preserve formatting for readability
    comments: true   // Preserve comments if needed
}).code;
fs.writeFileSync('output.js', output);
```

### 3.3 Literals & Identifiers

| Obfuscated | Target | Strategy |
|------------|--------|----------|
| `0x1a2b` | `6699` | Delete `NumericLiteral.extra` |
| `"\x48\x65\x6c\x6c\x6f"` | `"Hello"` | Delete `StringLiteral.extra` |
| `obj['prop']` | `obj.prop` | Computed → dot access |

```javascript
// Restore hex/unicode literals
'NumericLiteral|StringLiteral'(path) {
    delete path.node.extra;
}

// Property access cleanup (Member Expression Unification)
MemberExpression(path) {
    const { property, computed } = path.node;
    // Convert computed string access to dot notation
    if (computed && t.isStringLiteral(property)) {
        const name = property.value;
        // Only convert if valid identifier (not reserved words, no special chars)
        if (/^[a-zA-Z_$][\w$]*$/.test(name)) {
            path.node.property = t.identifier(name);
            path.node.computed = false;
        }
    }
}
```

**Examples**:
- `window['document']['getElementById']` → `window.document.getElementById`
- `obj['prop-name']` → stays as `obj['prop-name']` (invalid identifier)

### 3.4 Expression Optimization

**Constant Folding** (Binary/Unary/Conditional):
```javascript
// Handles: arithmetic, logical, string concatenation, ternary
'BinaryExpression|UnaryExpression|ConditionalExpression'(path) {
    const { confident, value } = path.evaluate();
    if (confident) {
        // Edge cases: preserve Infinity/NaN as identifiers
        if (value === Infinity || value === -Infinity) {
            path.replaceWith(t.identifier(value === Infinity ? 'Infinity' : '-Infinity'));
        } else if (Number.isNaN(value)) {
            path.replaceWith(t.identifier('NaN'));
        } else {
            path.replaceWith(t.valueToNode(value));
        }
    }
}
```

**Examples**:
- `1 + 2 * 3` → `7`
- `'h' + 'i'` → `'hi'`
- `!![] ? 'yes' : 'no'` → `'yes'`
- `!0` → `true`

**Boolean Simplify**:
```javascript
UnaryExpression(path) {
    const { operator, argument } = path.node;
    if (operator === '!') {
        if (t.isArrayExpression(argument) && !argument.elements.length)
            path.replaceWith(t.booleanLiteral(false));  // ![] → false
        else if (t.isObjectExpression(argument) && !argument.properties.length)
            path.replaceWith(t.booleanLiteral(false));  // !{} → false
        else if (t.isNumericLiteral(argument))
            path.replaceWith(t.booleanLiteral(!argument.value));
    }
}
```

### 3.5 Comma Expression Unrolling

**Pattern**: Multiple statements compressed into comma expressions, often in return statements or standalone expressions.

**Obfuscated**:
```javascript
function foo() {
    return a = 1, b = 2, a + b;
}
var x = (log("a"), log("b"), 42);
```

**Visitor**:
```javascript
SequenceExpression(path) {
    const expressions = path.node.expressions;
    
    // Case 1: Standalone expression statement
    if (t.isExpressionStatement(path.parent)) {
        const statements = expressions.map(expr => t.expressionStatement(expr));
        path.parentPath.replaceWithMultiple(statements);
    }
    // Case 2: Return statement
    else if (t.isReturnStatement(path.parent)) {
        const last = expressions[expressions.length - 1];
        const rest = expressions.slice(0, -1);
        // Insert preceding expressions before return
        rest.forEach(expr => {
            path.parentPath.insertBefore(t.expressionStatement(expr));
        });
        path.replaceWith(last);  // Replace comma expr with last value
    }
    // Case 3: Variable declaration initializer
    else if (t.isVariableDeclarator(path.parent)) {
        const last = expressions[expressions.length - 1];
        const rest = expressions.slice(0, -1);
        rest.forEach(expr => {
            path.parentPath.insertBefore(t.expressionStatement(expr));
        });
        path.replaceWith(last);
    }
}
```

**Result**:
```javascript
function foo() {
    a = 1;
    b = 2;
    return a + b;
}
log("a");
log("b");
var x = 42;
```

### 3.6 Dead Code Removal

```javascript
IfStatement(path) {
    const { confident, value } = path.get('test').evaluate();
    if (confident) {
        if (value) {
            path.replaceWithMultiple(path.node.consequent.body || [path.node.consequent]);
        } else if (path.node.alternate) {
            path.replaceWithMultiple(path.node.alternate.body || [path.node.alternate]);
        } else {
            path.remove();
        }
    }
}
```

### 3.7 Control Flow Flattening (Non-VM)

**Pattern**: `while(true)` + `switch` + state array (but NOT full VM)

```javascript
var _state = "5|2|3|1|4".split("|"), _idx = 0;
while (true) {
    switch (_state[_idx++]) {
        case "1": /* block 1 */ break;
        case "2": /* block 2 */ break;
    }
}
```

**Restore Strategy**:
1. Extract state array: `"5|2|3|1|4".split("|")` → `['5', '2', '3', '1', '4']`
2. Build case map: `Map<caseValue, statementNodes[]>`
3. Reorder statements by state array order
4. Remove `break`/`continue` statements
5. Replace `while(true){switch}` with sequential statements

**Simplified Visitor**:
```javascript
WhileStatement(path) {
    const { test, body } = path.node;
    // Check: while(true) with switch inside
    if (t.isBooleanLiteral(test, { value: true }) && 
        t.isBlockStatement(body) && 
        body.body.length === 1 && 
        t.isSwitchStatement(body.body[0])) {
        
        const switchStmt = body.body[0];
        // Extract state array (simplified - may need more robust extraction)
        // Extract case blocks
        const caseMap = new Map();
        switchStmt.cases.forEach(c => {
            if (t.isStringLiteral(c.test)) {
                caseMap.set(c.test.value, c.consequent.filter(s => !t.isBreakStatement(s)));
            }
        });
        
        // Reorder and flatten (requires state array extraction - see full example)
        // path.replaceWithMultiple(newNodes);
    }
}
```

> If the switch dispatcher processes **bytecode/opcodes** with stack operations, it's a **JSVMP** - use `skills/jsvmp_analysis.md` instead.

---

## 4. Debugging & Verification Tips

### 4.1 Scope Handling

**CRITICAL**: Always use `path.scope` methods for variable renaming to handle references correctly.

```javascript
// ❌ WRONG: Direct name modification (breaks references)
path.node.id.name = 'newName';

// ✅ CORRECT: Scope-aware renaming
path.scope.rename('oldName', 'newName');
```

**Scope utilities**:
- `path.scope.rename(old, new)` - Rename all references in scope
- `path.scope.hasBinding(name)` - Check if variable exists
- `path.scope.getBinding(name)` - Get binding info (references, declarations)

### 4.2 Code Preview & Inspection

**Quick node preview**:
```javascript
// In visitor, log current node code
CallExpression(path) {
    console.log('Current:', path.toString());
    // Or specific sub-path
    console.log('Callee:', path.get('callee').toString());
}
```

**AST Explorer**: When encountering complex structures:
1. Copy obfuscated code snippet to [AST Explorer](https://astexplorer.net/)
2. Select parser: `@babel/parser`
3. Inspect JSON structure to understand node types
4. Write precise visitor selectors based on structure

### 4.3 Transform Development Workflow

1. **Isolate pattern**: Extract minimal obfuscated snippet
2. **Test visitor**: Run on isolated snippet first
3. **Verify output**: Check syntax and logic correctness
4. **Apply to full code**: Only after isolated test passes

---

## 5. Workflow

**CRITICAL**: Apply ONE transform at a time. Verify before next step. Bugs compound when stacked.

### 5.1 Transform Order

1. Anti-debug bypass (§1)
2. String array decode (§2)
3. Hex/Unicode decode (§3.3)
4. Member expression unification (§3.3)
5. Constant folding (§3.4)
6. Comma expression unrolling (§3.5)
7. Dead code removal (§3.6)
8. Control flow restore (§3.7)

### 5.2 Per-Step Verification

After EACH transform:
- `node --check output.js` - syntax valid
- Execute target function - no runtime error
- Compare output with original - logic unchanged
- Use `path.toString()` to inspect suspicious nodes

If any check fails: revert, fix transform, retry.

---

## 6. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `ReferenceError` | Scope error | Use `scope.rename()` |
| Constant folding fails | Runtime-dependent | Skip, keep original |
| String array wrong | Captured before init | Capture AFTER init phase |
| Debugger loop | Dynamic generation | Hook Function.constructor |

---

## 7. MCP Tools Quick Reference

```javascript
// Anti-debug bypass
add_js_replace_rule(ruleId, urlPattern, oldCode, newCode)
clear_all_js_replace_rules()

// ✅ PREFERRED: Logging breakpoint (capture values at any scope)
set_breakpoint(breakpointId, urlRegex, lineNumber, 
    condition='console.log("Decoded:", _decoder(0x123)), false')
list_console_messages(types=["log"])

// ✅ Read global decoder (ONLY for window.* globals)
evaluate_script(function="() => window._decoder(0x123)")

// ❌ FORBIDDEN: Don't use evaluate_script for hooks/intercepts
```

> **Rule**: Prefer `set_breakpoint` for any scoped values. Use `evaluate_script` ONLY for reading `window.*` globals.

---
