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

After each transform, sample 3 segments in parallel to assess effectiveness:

```
# Call these concurrently (head / middle / tail)
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

```javascript
module.exports = function(babel) {
    const { types: t } = babel;
    const ARRAY_NAME = '_0x1234';  // adjust per target
    const OFFSET = 0x100;
    const SHUFFLE_COUNT = 0;
    let stringArray = [], arrayFound = false;
    
    return {
        visitor: {
            Program: {
                enter(path) {
                    path.traverse({
                        VariableDeclarator(p) {
                            if (t.isIdentifier(p.node.id, { name: ARRAY_NAME }) && 
                                t.isArrayExpression(p.node.init)) {
                                stringArray = p.node.init.elements.map(e => e?.value ?? null);
                                for (let i = 0; i < SHUFFLE_COUNT; i++) stringArray.push(stringArray.shift());
                                arrayFound = true;
                                p.stop();
                            }
                        }
                    });
                }
            },
            CallExpression(path) {
                if (!arrayFound) return;
                const { callee, arguments: args } = path.node;
                if (t.isIdentifier(callee) && callee.name.match(/^_0x/) && 
                    args.length >= 1 && t.isNumericLiteral(args[0])) {
                    const idx = args[0].value - OFFSET;
                    if (idx >= 0 && idx < stringArray.length && stringArray[idx] !== null) {
                        path.replaceWith(t.stringLiteral(stringArray[idx]));
                        path.scope.crawl();
                    }
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
