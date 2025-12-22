# JavaScript Deobfuscation Skill

> **Trigger**: `_0x` vars, hex strings, large string arrays, anti-debug loops
> **Output**: `output/<name>_deobfuscated.js` — MANDATORY before returning to jsrev.md

---

## ⛔ COMPLETION GATE

**EXIT CONDITION**: `output/*_deobfuscated.js` MUST exist before returning to algorithm analysis.

**FORBIDDEN** while in this skill: searching parameters, analyzing logic, setting analysis breakpoints, monitoring requests.

**ALLOWED**: capturing decoder outputs, building AST transforms, producing deobfuscated file.

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

| Pattern | Solution |
|---------|----------|
| `debugger` statement | DevTools: Ctrl+F8 (deactivate breakpoints) |
| `Function("debugger")` | Hook constructor (below) |
| Timing check (`Date.now`) | Hook with fake values |

```javascript
// Function.constructor Hook - run BEFORE page load
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

### 2.2 Extracting Large Arrays

**⛔ NEVER read large string arrays directly — use code/commands to extract.**

```bash
# Locate array
rg -n "var _0x[a-f0-9]+ *= *\[" source/file.js | head -3
```

**Option A: Babel AST (recommended)**
```javascript
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const ast = parser.parse(fs.readFileSync('source/file.js', 'utf-8'));

traverse(ast, {
    VariableDeclarator(path) {
        if (path.node.id.name?.match(/^_0x[a-f0-9]+$/) && 
            path.node.init?.type === 'ArrayExpression') {
            const strings = path.node.init.elements.map(e => e?.value ?? null);
            fs.writeFileSync('strings_raw.json', JSON.stringify(strings));
            console.log(`Extracted ${strings.length} strings`);
            path.stop();
        }
    }
});
```

**Option B: Browser runtime (if shuffled)**
```javascript
evaluate_script(function=`() => JSON.stringify(window._0xabc)`)
```

### 2.3 Verify Decoder

```javascript
// Sample verification before AST replacement
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=XX,
    condition='console.log("VERIFY:", _0xdef(0x1a2), _0xdef(0x1a5)), false')
```

### 2.4 Common Decoders

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
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
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

const ast = parser.parse(fs.readFileSync('input.js', 'utf-8'));
traverse(ast, { /* visitors */ });
fs.writeFileSync('output.js', generator(ast, { compact: false }).code);
```

### 3.3 Common Transforms

```javascript
// Hex/Unicode → Readable
'NumericLiteral|StringLiteral'(path) { delete path.node.extra; }

// Computed → Dot notation
MemberExpression(path) {
    const { property, computed } = path.node;
    if (computed && t.isStringLiteral(property) && /^[a-zA-Z_$][\w$]*$/.test(property.value)) {
        path.node.property = t.identifier(property.value);
        path.node.computed = false;
    }
}

// Constant folding
'BinaryExpression|UnaryExpression'(path) {
    const { confident, value } = path.evaluate();
    if (confident && typeof value !== 'object') path.replaceWith(t.valueToNode(value));
}

// String decoder replacement
const strings = require('./strings_raw.json');
const OFFSET = 0x100;
CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (t.isIdentifier(callee) && callee.name.match(/^_0x/) && t.isNumericLiteral(args[0])) {
        const decoded = strings[args[0].value - OFFSET];
        if (decoded) path.replaceWith(t.stringLiteral(decoded));
    }
}
```

---

## 4. Transform Order

1. Anti-debug bypass → 2. String decode → 3. Hex restore → 4. Property cleanup → 5. Constant fold

**After EACH**: `node --check output.js` + browser verify

---

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrong array state | Capture AFTER shuffler |
| Decoder mismatch | Re-analyze offset/algorithm |
| Constant fold fails | Skip, keep original |

---

## ⛔ EXIT CHECKLIST

- [ ] `output/*_deobfuscated.js` exists
- [ ] All decoder calls replaced with strings
- [ ] Keywords searchable (sign, encrypt, md5)

**Not complete? Continue deobfuscation. Do NOT return to jsrev.md.**
