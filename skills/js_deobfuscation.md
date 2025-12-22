# JavaScript Deobfuscation Skill

> **Trigger**: `_0x` vars, hex strings, large string arrays, anti-debug loops
> **Output**: `output/<name>_deobfuscated.js` — MANDATORY before returning to jsrev.md

---

## ⛔ COMPLETION GATE

**EXIT CONDITION**: `output/*_deobfuscated.js` MUST exist before returning to algorithm analysis.

**FORBIDDEN** while in this skill: searching parameters, analyzing logic, setting analysis breakpoints, monitoring requests.

**ALLOWED**: static AST extraction, building transforms, producing deobfuscated file.

---

## 0. Decision Tree

```
Code obfuscated?
├─ Anti-debugging (debugger loop)? → §1 Bypass first
├─ String array + decoder function? → §2 Static extraction (sg/Babel)
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

### 2.2 Static Extraction (PREFERRED)

**⚠️ ALWAYS try static analysis FIRST — browser extraction is LAST RESORT.**

#### Method 1: ast-grep (sg) — Fastest

```bash
# Find string array declarations
sg -p 'var $_NAME = [$$$ELEMENTS]' source/file.js --json | jq '.[] | .metaVariables'

# Extract array with specific pattern (_0x prefix)
sg -p 'var $NAME = [$$$]' source/file.js -r '$NAME: [$$$]' 

# Complex: extract IIFE-wrapped arrays
sg -p '(function($ARR, $_){while(--$_)$ARR.push($ARR.shift())})($NAME, $_)' source/file.js
```

#### Method 2: ripgrep + jq — Quick extraction

```bash
# Locate array position
rg -n "var _0x[a-f0-9]+ *= *\[" source/file.js | head -3

# Extract array content (if single line)
rg -o '\[("[^"]*",?\s*)+\]' source/file.js | head -1 > strings_raw.json

# For multi-line arrays, use sed range
sed -n '/var _0x[a-f0-9]* *= *\[/,/\];/p' source/file.js > array_block.js
```


#### Method 3: Babel AST — Most reliable

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
            fs.writeFileSync('strings_raw.json', JSON.stringify(strings, null, 2));
            console.log(`Extracted ${strings.length} strings`);
            path.stop();
        }
    }
});
```

#### Method 4: Node.js eval (static, no browser)

```bash
# If array is self-contained, extract and eval locally
node -e "
const code = require('fs').readFileSync('source/file.js', 'utf-8');
const match = code.match(/var (_0x[a-f0-9]+)\s*=\s*(\[[^\]]+\])/);
if (match) {
    const arr = eval(match[2]);
    require('fs').writeFileSync('strings_raw.json', JSON.stringify(arr, null, 2));
    console.log('Extracted', arr.length, 'strings');
}
"
```

### 2.3 Handling Shuffled Arrays

**If array is shuffled by IIFE, extract the shuffler logic statically:**

```bash
# Find shuffler pattern
sg -p '(function($A,$B){while(--$B)$A.push($A.shift())})($_,$_)' source/file.js

# Extract shuffle count
rg -o '\)\(_0x[a-f0-9]+,\s*(0x[a-f0-9]+)\)' source/file.js
```

```javascript
// Apply shuffle locally (no browser needed)
const raw = require('./strings_raw.json');
const shuffleCount = 0x123; // extracted value
for (let i = 0; i < shuffleCount; i++) raw.push(raw.shift());
fs.writeFileSync('strings_shuffled.json', JSON.stringify(raw, null, 2));
```

### 2.4 Browser Extraction (LAST RESORT)

**Only use when:**
- Array depends on runtime DOM/environment
- Decoder uses complex runtime state
- Static analysis fails after multiple attempts

```javascript
// Capture array state after shuffler executes
evaluate_script(function=`() => JSON.stringify(window._0xabc)`)
```

### 2.5 Common Decoders (Static Implementation)

```javascript
// RC4 - implement locally, no browser needed
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
const decode = (enc, key) => Buffer.from(enc, 'base64').toString()
    .split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');

// Base64 + rotation
const decodeRotate = (enc, offset) => {
    const decoded = Buffer.from(enc, 'base64').toString();
    return decoded.split('').map(c => String.fromCharCode(c.charCodeAt(0) - offset)).join('');
};
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

1. Anti-debug bypass → 2. Static string extraction → 3. Hex restore → 4. Property cleanup → 5. Constant fold

**After EACH**: `node --check output.js` to verify syntax

---

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| sg pattern not matching | Try simpler pattern, check escaping |
| Array extraction incomplete | Use Babel AST instead of regex |
| Shuffler logic complex | Extract shuffle count, apply locally |
| Decoder uses runtime state | ONLY THEN use browser extraction |

---

## ⛔ EXIT CHECKLIST

- [ ] `output/*_deobfuscated.js` exists
- [ ] All decoder calls replaced with strings
- [ ] Keywords searchable (sign, encrypt, md5)

**Not complete? Continue deobfuscation. Do NOT return to jsrev.md.**
