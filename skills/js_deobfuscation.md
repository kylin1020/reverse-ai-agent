# JavaScript Deobfuscation Skill

## Core Principle

**Babel AST is the ONLY reliable method for true deobfuscation.** Other tools (ast-grep, ripgrep, browser extraction) are supplementary — useful for quick string extraction or pattern discovery, but NOT for actual code transformation.

---

## 1. Babel AST Deobfuscation (PRIMARY METHOD)

### 1.1 Setup

```bash
npm init -y && npm i @babel/parser @babel/traverse @babel/types @babel/generator
```

### 1.2 Standard Template

```javascript
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;

const code = fs.readFileSync('input.js', 'utf-8');
const ast = parser.parse(code, { sourceType: 'unambiguous' });

// Apply transforms
traverse(ast, { /* visitors */ });

// Generate output
const output = generator(ast, { compact: false, comments: true }).code;
fs.writeFileSync('output.js', output);
```

### 1.3 Transform Order (CRITICAL)

Execute transforms in this sequence — order matters:

1. **Anti-debug removal** — Remove debugger traps first
2. **Hex/Unicode normalization** — Restore readable literals
3. **String array decoding** — Replace decoder calls with actual strings
4. **Computed property cleanup** — `obj["prop"]` → `obj.prop`
5. **Constant folding** — Evaluate static expressions
6. **Dead code elimination** — Remove unreachable branches
7. **Control flow unflattening** — Restore natural flow (if applicable)

**After EACH transform**: `node --check output.js` to verify syntax validity.

### 1.4 Essential Transforms

#### Anti-Debug Removal

```javascript
// Remove debugger statements
Debugger(path) { path.remove(); }

// Remove setInterval/setTimeout with debugger
CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (t.isIdentifier(callee, { name: 'setInterval' }) || 
        t.isIdentifier(callee, { name: 'setTimeout' })) {
        const funcBody = args[0]?.body?.body || [];
        if (funcBody.some(n => t.isDebuggerStatement(n))) {
            path.remove();
        }
    }
}

// Remove console detection traps
IfStatement(path) {
    const test = path.get('test');
    if (test.isCallExpression() && 
        generator(test.node).code.includes('console')) {
        path.remove();
    }
}
```

#### Hex/Unicode Normalization

```javascript
// Restore readable number/string literals
'NumericLiteral|StringLiteral'(path) {
    delete path.node.extra;  // Removes hex representation
}
```

#### String Array Decoding

```javascript
// Step 1: Extract string array
let stringArray = [];
let arrayName = '';

traverse(ast, {
    VariableDeclarator(path) {
        if (path.node.id.name?.match(/^_0x[a-f0-9]+$/) && 
            t.isArrayExpression(path.node.init)) {
            arrayName = path.node.id.name;
            stringArray = path.node.init.elements.map(e => e?.value ?? null);
            path.stop();
        }
    }
});

// Step 2: Handle shuffler (if present)
traverse(ast, {
    CallExpression(path) {
        // Pattern: (function(arr, n) { while(--n) arr.push(arr.shift()); })(array, count)
        if (t.isFunctionExpression(path.node.callee)) {
            const args = path.node.arguments;
            if (t.isIdentifier(args[0], { name: arrayName }) && t.isNumericLiteral(args[1])) {
                const count = args[1].value;
                for (let i = 0; i < count; i++) stringArray.push(stringArray.shift());
                path.remove();  // Remove shuffler call
            }
        }
    }
});

// Step 3: Replace decoder calls
const OFFSET = 0x100;  // Common offset, adjust per target
traverse(ast, {
    CallExpression(path) {
        const { callee, arguments: args } = path.node;
        if (t.isIdentifier(callee) && callee.name.match(/^_0x/) && 
            args.length >= 1 && t.isNumericLiteral(args[0])) {
            const idx = args[0].value - OFFSET;
            if (stringArray[idx] !== undefined) {
                path.replaceWith(t.stringLiteral(stringArray[idx]));
            }
        }
    }
});
```

#### Computed Property Cleanup

```javascript
MemberExpression(path) {
    const { property, computed } = path.node;
    if (computed && t.isStringLiteral(property)) {
        // Only convert if valid identifier
        if (/^[a-zA-Z_$][\w$]*$/.test(property.value)) {
            path.node.property = t.identifier(property.value);
            path.node.computed = false;
        }
    }
}
```

#### Constant Folding

```javascript
'BinaryExpression|UnaryExpression'(path) {
    const { confident, value } = path.evaluate();
    if (confident && typeof value !== 'object' && value !== undefined) {
        path.replaceWith(t.valueToNode(value));
    }
}

// Conditional expression simplification
ConditionalExpression(path) {
    const test = path.get('test');
    const { confident, value } = test.evaluate();
    if (confident) {
        path.replaceWith(value ? path.node.consequent : path.node.alternate);
    }
}
```

#### Dead Code Elimination

```javascript
IfStatement(path) {
    const test = path.get('test');
    const { confident, value } = test.evaluate();
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

### 1.5 Advanced: Control Flow Unflattening

```javascript
// For switch-based control flow flattening
SwitchStatement(path) {
    const discriminant = path.get('discriminant');
    if (!t.isIdentifier(discriminant.node)) return;
    
    const stateVar = discriminant.node.name;
    const cases = path.node.cases;
    const blocks = new Map();
    
    // Build block map
    cases.forEach(c => {
        if (t.isNumericLiteral(c.test) || t.isStringLiteral(c.test)) {
            blocks.set(c.test.value, c.consequent);
        }
    });
    
    // Reconstruct flow (requires analysis of state transitions)
    // Implementation depends on specific obfuscation pattern
}
```

---

## 2. Supplementary Tools (FOR EXTRACTION ONLY)

These tools help with quick pattern discovery and string extraction — NOT for actual deobfuscation.

### 2.1 ast-grep (sg) — Pattern Discovery

```bash
# Find string array declarations
sg -p 'var $_NAME = [$$ELEMENTS]' source/file.js --json

# Find decoder function pattern
sg -p 'function $_($IDX) { return $_[$IDX - $_] }' source/file.js

# Find shuffler IIFE
sg -p '(function($A,$B){while(--$B)$A.push($A.shift())})($_,$_)' source/file.js
```

### 2.2 ripgrep — Quick Location

```bash
# Locate array position
rg -n "var _0x[a-f0-9]+ *= *\[" source/file.js | head -3

# Find decoder offset
rg -o '\[_0x[a-f0-9]+\s*-\s*(0x[a-f0-9]+)\]' source/file.js | head -1

# Find anti-debug patterns
rg -n "debugger|setInterval.*debug|console\[" source/file.js
```

### 2.3 Node.js Quick Eval — Simple Array Extraction

```bash
# Only for self-contained arrays (no dependencies)
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

### 2.4 Browser Extraction — LAST RESORT

**Only use when:**
- Decoder depends on runtime DOM/environment
- Complex runtime state that cannot be replicated
- Static analysis fails after multiple attempts

```javascript
// Via MCP browser tools
evaluate_script(function=`() => JSON.stringify(window._0xabc)`)
```

---

## 3. Common Decoder Implementations

When you identify the decoder algorithm, implement it locally in your Babel transform:

### RC4

```javascript
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
```

### Base64 + XOR

```javascript
const decode = (enc, key) => {
    const decoded = Buffer.from(enc, 'base64').toString();
    return decoded.split('')
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join('');
};
```

### Base64 + Rotation

```javascript
const decodeRotate = (enc, offset) => {
    const decoded = Buffer.from(enc, 'base64').toString();
    return decoded.split('')
        .map(c => String.fromCharCode(c.charCodeAt(0) - offset))
        .join('');
};
```

---

## 4. Troubleshooting

| Issue | Solution |
|-------|----------|
| Parser fails | Try `sourceType: 'script'` or `'module'` explicitly |
| Transform breaks syntax | Run `node --check` after each transform, isolate the breaking one |
| Decoder offset wrong | Search for `- 0x` pattern near decoder function |
| Shuffler count unknown | Look for numeric literal in shuffler IIFE call |
| Strings still encoded | Check for nested encoding (base64 + xor + rotation) |
| Control flow complex | Map state transitions manually before unflattening |

