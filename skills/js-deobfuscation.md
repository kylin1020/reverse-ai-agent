# JavaScript Deobfuscation Skill

## Core Principle

**Babel AST is the ONLY reliable method for true deobfuscation.** Use `apply_custom_transform` for transforms, smart-fs tools for code analysis.

---

## 1. Babel Plugin Format (for apply_custom_transform)

```javascript
// plugin.js — must export function returning visitor
module.exports = function(babel) {
    const { types: t } = babel;
    return {
        visitor: {
            // visitors here
        }
    };
};
```

Usage: `apply_custom_transform(target_file="source.js", script_path="plugin.js")`

---

## 2. Transform Order (CRITICAL)

1. **Anti-debug removal** — Remove debugger traps
2. **Hex/Unicode normalization** — Restore readable literals
3. **String array decoding** — Replace decoder calls
4. **Computed property cleanup** — `obj["prop"]` → `obj.prop`
5. **Constant folding** — Evaluate static expressions
6. **Dead code elimination** — Remove unreachable branches
7. **Control flow unflattening** — Restore natural flow

---

## 3. Verify Deobfuscation Results

### Syntax Validation (MANDATORY)
```bash
# Validate transform script before use
npx eslint --no-eslintrc --env es2020 transforms/*.js

# Validate deobfuscated output
npx eslint --no-eslintrc --parser-options=ecmaVersion:2020 source/*_deob.js
```

### Readability Check
Sample 3 segments in parallel (head / middle / tail):
```
read_code_smart(file_path="output.js", start_line=1, end_line=50)
read_code_smart(file_path="output.js", start_line=200, end_line=300)
read_code_smart(file_path="output.js", start_line=450, end_line=500)
```

---

## 4. Essential Transforms

### Anti-Debug Removal

```javascript
module.exports = function(babel) {
    const { types: t } = babel;
    const generate = require('@babel/generator').default;
    return {
        visitor: {
            Debugger(path) { path.remove(); path.scope.crawl(); },
            CallExpression(path) {
                const { callee, arguments: args } = path.node;
                if (t.isIdentifier(callee, { name: 'setInterval' }) || 
                    t.isIdentifier(callee, { name: 'setTimeout' })) {
                    const funcBody = args[0]?.body?.body || [];
                    if (funcBody.some(n => t.isDebuggerStatement(n))) { path.remove(); path.scope.crawl(); }
                }
            },
            IfStatement(path) {
                const test = path.get('test');
                if (test.isCallExpression() && generate(test.node).code.includes('console')) {
                    path.remove(); path.scope.crawl();
                }
            }
        }
    };
};
```

### Hex/Unicode Normalization

```javascript
module.exports = function(babel) {
    return {
        visitor: {
            'NumericLiteral|StringLiteral'(path) { delete path.node.extra; }
        }
    };
};
```

### String Array Decoding

**⚠️ RULE: Large arrays (>50 items) or long strings (>200 chars) must be extracted to file first, NEVER hardcode in transform.**

#### Why Extract First?
- AI output has token limits — large arrays get truncated or cause errors
- Hardcoded data bloats transform scripts and makes them hard to debug
- Extracted files can be reused across multiple transforms

#### Step 1: Analyze the Obfuscation Pattern

Use `search_code_smart` to identify:
```javascript
// Common patterns to look for:
var _0x1234 = ["string1", "string2", ...];  // String array declaration
function _0xabcd(idx) { return _0x1234[idx - 0x100]; }  // Decoder function
_0xabcd(0x105)  // Decoder call (returns "string1" if offset is 0x100)
```

Key values to extract:
- **Array variable name**: `_0x1234`
- **Decoder function name**: `_0xabcd`
- **Index offset**: `0x100` (look for `idx - 0x???` pattern)
- **Shuffle count**: Check if array is rotated before use


#### Step 2: Extract Array to File (run with node)

```javascript
// transforms/extract_strings.js
const fs = require('fs');
const path = require('path');

// Read source file
const sourceFile = process.argv[2] || 'source/main.js';
const code = fs.readFileSync(sourceFile, 'utf8');

// Match string array declaration (adjust regex for specific obfuscator)
const arrayRegex = /var\s+(_0x[a-f0-9]+)\s*=\s*\[([\s\S]*?)\];/;
const match = code.match(arrayRegex);

if (!match) {
    console.error('String array not found. Try adjusting the regex pattern.');
    process.exit(1);
}

const arrayName = match[1];
const arrayContent = match[2];

// Parse array elements (handles both single and double quotes)
const strings = [];
const elementRegex = /["']((?:[^"'\\]|\\.)*)["']/g;
let elemMatch;
while ((elemMatch = elementRegex.exec(arrayContent)) !== null) {
    const str = elemMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1');
    strings.push(str);
}

console.log(`Found array "${arrayName}" with ${strings.length} elements`);

// Save as newline-delimited file
const hasNewlines = strings.some(s => s.includes('\n'));
const delimiter = hasNewlines ? '\x00' : '\n';
const outputFile = 'raw/string_array.txt';

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, strings.join(delimiter));
fs.writeFileSync('raw/string_array_meta.txt', `name=${arrayName}\ncount=${strings.length}\ndelimiter=${hasNewlines ? 'null' : 'newline'}`);

console.log(`Saved to ${outputFile}`);
```

Run: `node transforms/extract_strings.js source/main.js`

#### Step 3: Transform Using Extracted Data

```javascript
// transforms/decode_strings.js
const fs = require('fs');

// Load extracted string array
const meta = Object.fromEntries(
    fs.readFileSync('raw/string_array_meta.txt', 'utf8')
        .split('\n').filter(Boolean).map(l => l.split('='))
);
const delimiter = meta.delimiter === 'null' ? '\x00' : '\n';
const stringArray = fs.readFileSync('raw/string_array.txt', 'utf8').split(delimiter);

// Configuration (adjust per target)
const DECODER_PATTERN = /^_0x[a-f0-9]+$/;  // Decoder function name pattern
const OFFSET = 0x100;  // Index offset (find via: search for "- 0x" in decoder)
const SHUFFLE_COUNT = 0;  // Array rotation count (0 if no shuffle)

// Apply shuffle if needed
for (let i = 0; i < SHUFFLE_COUNT; i++) {
    stringArray.push(stringArray.shift());
}

module.exports = function({ types: t }) {
    return {
        visitor: {
            CallExpression(path) {
                const { callee, arguments: args } = path.node;
                
                // Match decoder calls: _0xabcd(0x105) or _0xabcd(261)
                if (!t.isIdentifier(callee) || !DECODER_PATTERN.test(callee.name)) return;
                if (args.length < 1 || !t.isNumericLiteral(args[0])) return;
                
                const idx = args[0].value - OFFSET;
                if (idx >= 0 && idx < stringArray.length) {
                    const decoded = stringArray[idx];
                    path.replaceWith(t.stringLiteral(decoded));
                    path.scope.crawl();
                }
            }
        }
    };
};
```

### Computed Property Cleanup

```javascript
module.exports = function(babel) {
    const { types: t } = babel;
    return {
        visitor: {
            MemberExpression(path) {
                const { property, computed } = path.node;
                if (computed && t.isStringLiteral(property) && /^[a-zA-Z_$][\w$]*$/.test(property.value)) {
                    path.node.property = t.identifier(property.value);
                    path.node.computed = false;
                }
            }
        }
    };
};
```

### Constant Folding

```javascript
module.exports = function(babel) {
    const { types: t } = babel;
    return {
        visitor: {
            'BinaryExpression|UnaryExpression'(path) {
                const { confident, value } = path.evaluate();
                if (confident && typeof value !== 'object' && value !== undefined) {
                    path.replaceWith(t.valueToNode(value));
                    path.scope.crawl();
                }
            },
            ConditionalExpression(path) {
                const { confident, value } = path.get('test').evaluate();
                if (confident) { path.replaceWith(value ? path.node.consequent : path.node.alternate); path.scope.crawl(); }
            }
        }
    };
};
```

### Dead Code Elimination

```javascript
module.exports = function(babel) {
    const { types: t } = babel;
    return {
        visitor: {
            IfStatement(path) {
                const { confident, value } = path.get('test').evaluate();
                if (confident) {
                    if (value) path.replaceWithMultiple(path.node.consequent.body || [path.node.consequent]);
                    else if (path.node.alternate) path.replaceWithMultiple(path.node.alternate.body || [path.node.alternate]);
                    else path.remove();
                    path.scope.crawl();
                }
            }
        }
    };
};
```

---

## 5. Code Analysis Tools

```
# Read beautified code with source map coords
read_code_smart(file_path="source.js", start_line=1, end_line=100)

# Search patterns in beautified code
search_code_smart(file_path="source.js", query="var _0x.*= *\\[")

# Find variable definitions and references (AST scope analysis)
find_usage_smart(file_path="source.js", identifier="_0x1234", line=50)
```

---

## 6. Common Decoders

### RC4
```javascript
function rc4(str, key) {
    let s = [...Array(256).keys()], j = 0;
    for (let i = 0; i < 256; i++) { j = (j + s[i] + key.charCodeAt(i % key.length)) % 256; [s[i], s[j]] = [s[j], s[i]]; }
    let i = 0, k = 0, res = '';
    for (let c of str) { i = (i + 1) % 256; k = (k + s[i]) % 256; [s[i], s[k]] = [s[k], s[i]]; res += String.fromCharCode(c.charCodeAt(0) ^ s[(s[i] + s[k]) % 256]); }
    return res;
}
```

### Base64 + XOR
```javascript
const decode = (enc, key) => Buffer.from(enc, 'base64').toString().split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
```

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| Parser fails | Check encoding, try different sourceType |
| Transform breaks | Use `read_code_smart` to inspect output |
| Wrong offset | `search_code_smart` for `- 0x` pattern |
| Unknown shuffle | `find_usage_smart` to trace shuffler call |
