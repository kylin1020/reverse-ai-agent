# JavaScript Deobfuscation Skill

> **Trigger**: `_0x` vars, hex strings, large string arrays, anti-debug loops  
> **Output**: Save deobfuscated code to `source/<name>_clean.js`

---

## 0. Decision Tree

```
Code obfuscated?
├─ Anti-debugging (debugger loop)? → §1 Bypass first
├─ String array + decoder function? → §2 Decode strings
├─ `_0x` vars, hex literals? → §3 AST transforms
├─ `while(true){switch}` + stack? → SWITCH TO: skills/jsvmp_analysis.md
└─ Readable enough? → Skip this skill
```

---

## 1. Anti-Debugging Bypass

### Quick Bypasses

| Pattern | Solution |
|---------|----------|
| `debugger` statement | DevTools: Ctrl+F8 (deactivate breakpoints) |
| `Function("debugger")` | Hook constructor (see below) |
| Timing check (`Date.now`) | Hook with fake values |

### Function.constructor Hook

Run in DevTools Snippets BEFORE page load:

```javascript
const _orig = Function.prototype.constructor;
Function.prototype.constructor = function() {
    if (arguments[0]?.includes?.("debugger")) return function(){};
    return _orig.apply(this, arguments);
};
```

---

## 2. String Array Decoding

### 2.1 Pattern Recognition

```javascript
// Simple: array + accessor
var _0xabc = ["str1", "str2", ...];
var _0xdef = function(idx) { return _0xabc[idx]; };

// Complex: shuffler + decoder
var _0xabc = ["str1", "str2"];
(function(arr, n) { while(--n) arr.push(arr.shift()); })(_0xabc, 0x123);
var _0xdef = function(idx) { return atob(_0xabc[idx - 0x100]); };
```

### 2.2 Capture Final Array State

**CRITICAL**: Array may be shuffled during init. Capture AFTER init completes.

```javascript
// Set breakpoint AFTER shuffler IIFE
// ⚠️ urlRegex: Use SINGLE backslash (MCP handles JSON escaping)
set_breakpoint(
    breakpointId="capture_array",
    urlRegex=".*obfuscated\.js.*",
    lineNumber=XX,  // After init
    condition='console.log("Array:", JSON.stringify(_0xabc.slice(0,20))), false'
)
```

### 2.3 Decode & Verify

```javascript
// Sample verification (MANDATORY before AST replacement)
// ⚠️ urlRegex: Use SINGLE backslash
set_breakpoint(
    breakpointId="verify",
    urlRegex=".*target\.js.*",
    lineNumber=XX,
    condition='console.log("VERIFY:", JSON.stringify({
        "0x1a2": _0xdef(0x1a2),
        "0x1a5": _0xdef(0x1a5)
    })), false'
)
```

Compare browser output with local decoder. **100% match required** before proceeding.

### 2.4 Common Decoder Algorithms

```javascript
// RC4
function rc4(str, key) {
    let s = [...Array(256).keys()], j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
        [s[i], s[j]] = [s[j], s[i]];
    }
    let i = 0, k = 0, res = '';
    for (let c of str) {
        i = (i + 1) % 256; k = (k + s[i]) % 256;
        [s[i], s[k]] = [s[k], s[i]];
        res += String.fromCharCode(c.charCodeAt(0) ^ s[(s[i] + s[k]) % 256]);
    }
    return res;
}

// Base64 + XOR
const decode = (enc, key) => [...atob(enc)].map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
).join('');
```

---

## 3. AST Deobfuscation

### 3.1 Setup

```bash
npm init -y && npm i @babel/parser @babel/traverse @babel/types @babel/generator
```

### 3.2 Template

```javascript
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;

const code = fs.readFileSync('input.js', 'utf-8');
const ast = parser.parse(code);

traverse(ast, {
    // Add visitors here
});

fs.writeFileSync('output.js', generator(ast, { compact: false }).code);
```

### 3.3 Common Transforms

**Hex/Unicode Literals → Readable**
```javascript
'NumericLiteral|StringLiteral'(path) {
    delete path.node.extra;  // 0x1a2b → 6699, "\x48" → "H"
}
```

**Computed Property → Dot Notation**
```javascript
MemberExpression(path) {
    const { property, computed } = path.node;
    if (computed && t.isStringLiteral(property) && /^[a-zA-Z_$][\w$]*$/.test(property.value)) {
        path.node.property = t.identifier(property.value);
        path.node.computed = false;
    }
}
```

**Constant Folding**
```javascript
'BinaryExpression|UnaryExpression|ConditionalExpression'(path) {
    const { confident, value } = path.evaluate();
    if (confident && typeof value !== 'object') {
        path.replaceWith(t.valueToNode(value));
    }
}
```

**String Decoder Replacement**
```javascript
const decoded = require('./strings_decoded.json');  // From §2

CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (t.isIdentifier(callee, { name: '_0xdef' }) && t.isNumericLiteral(args[0])) {
        const key = '0x' + args[0].value.toString(16);
        if (decoded[key]) path.replaceWith(t.stringLiteral(decoded[key]));
    }
}
```

**Dead Code Removal**
```javascript
IfStatement(path) {
    const { confident, value } = path.get('test').evaluate();
    if (confident) {
        value ? path.replaceWithMultiple(path.node.consequent.body || [path.node.consequent])
              : path.node.alternate ? path.replaceWithMultiple(path.node.alternate.body || [path.node.alternate])
              : path.remove();
    }
}
```

---

## 4. Transform Order

Apply ONE at a time. Verify after each step.

1. Anti-debug bypass (§1)
2. String array decode (§2)
3. Hex/Unicode restore (§3.3)
4. Property access cleanup (§3.3)
5. Constant folding (§3.3)
6. Dead code removal (§3.3)

**After EACH transform**:
- `node --check output.js` (syntax valid)
- Browser verify key values
- Compare logic with original

---

## 5. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| String array wrong | Captured before init | Capture AFTER shuffler |
| Decoder mismatch | Wrong offset/algorithm | Re-analyze decoder logic |
| `ReferenceError` | Scope error | Use `path.scope.rename()` |
| Constant folding fails | Runtime-dependent | Skip, keep original |

---

## MCP Quick Reference

```javascript
// Logging breakpoint (capture values)
// ⚠️ urlRegex: Use SINGLE backslash (MCP handles JSON escaping)
set_breakpoint(breakpointId, urlRegex=".*target\.js.*", lineNumber,
    condition='console.log("VAL:", expr), false')

// Retrieve logs
list_console_messages(types=["log"])

// Read global (ONLY for window.* globals)
evaluate_script(function="() => window._decoder(0x123)")
```
