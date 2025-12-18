# JS Code Extraction & Search Skill

> **Trigger**: Target logic is buried in HTML, inside a 5MB Webpack bundle, or minified on a single line.  
> **Goal**: Surgically extract specific functions/objects without reading the whole file.  
> **Tools**: `rg` (ripgrep), `sed`, `awk`, `grep`.

---

## 1. Smart Searching with `rg` (Ripgrep)

**Why**: `rg` is faster than `grep` and ignores `.gitignore` by default.

### 1.1 Finding Definitions (Not just usages)
Don't just search for "encrypt". Search for where it's *defined*.

```bash
# Find function definition (standard)
rg "function\s+encrypt\s*\(" source/

# Find variable assignment (var/let/const)
rg "(var|let|const)\s+key\s*=" source/

# Find object property definition (e.g., { sign: function... })
rg "sign\s*:\s*function" source/
```

### 1.2 Handling Minified Files (Critical)
Minified files often have 10,000+ characters per line. **NEVER** cat them directly.

```bash
# Print only the matching part (not the whole line)
rg -o ".{0,50}functionName.{0,50}" source/bundle.js

# Find the column number (to use with set_breakpoint)
rg --column "functionName" source/bundle.js
```

---

## 2. Precise Extraction (Slicing)

### 2.1 Extracting by Line Numbers (`sed`)
If you know the logic is between line 1500 and 1600:

```bash
# Extract lines 1500 to 1600 to a new file
sed -n '1500,1600p' source/bundle.js > source/logic_slice.js
```

### 2.2 Extracting Inline JS from HTML
When logic is inside `<script>...</script>` tags in `index.html`.

```bash
# Extract content between script tags (naive regex)
# Saves each script block to separate files: script_1.js, script_2.js
awk '/<script/{flag=1; next} /<\/script/{flag=0} flag' source/index.html | csplit -z - '/^$/' '{*}' --prefix=source/script_ --suffix-format='%02d.js'
```

---

## 3. Webpack Bundle Extraction

Webpack bundles (`app.1a2b.js`) pack modules into `(function(e){...})({ 1: [...], 2: [...] })`.

### 3.1 Locate the Module ID
If the code calls `n(123)` or `__webpack_require__(123)`, module `123` is your target.

```bash
# Search for the module definition start: "123: function(" or "123:("
rg "123\s*:\s*(function|\()" source/bundle.js
```

### 3.2 Extract Single Module (Json Extraction Method)
Webpack objects are often valid JSON-like structures.

```javascript
// Quick Node.js script to extract specific module from bundle
// usage: node extract_module.js bundle.js 123
const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8');

// Regex to find "123: function(..." and try to grab the block
// Note: This is brittle. Better to use AST if this fails.
const regex = new RegExp(`(?<!\\d)${process.argv[3]}\\s*:\\s*function`);
const match = content.match(regex);
if (match) {
    const start = match.index;
    const preview = content.substring(start, start + 500);
    console.log("Preview:\n", preview);
    console.log("\n[Tip] Use 'substring' in Node to extract strictly based on brace counting.");
}
```

---

## 4. AST-Based Extraction (The Robust Way)

Regex fails on nested braces. If `rg` finds the location but you can't copy-paste cleanly, use this AST script.

**Snippet (`tools/extract_func.js`)**:
```javascript
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;

const code = fs.readFileSync(process.argv[2], 'utf-8');
const targetName = process.argv[3]; // Function name to extract

const ast = parser.parse(code, { sourceType: 'module' });
let extracted = '';

traverse(ast, {
    FunctionDeclaration(path) {
        if (path.node.id && path.node.id.name === targetName) {
            extracted = generator(path.node).code;
        }
    },
    VariableDeclarator(path) {
        if (path.node.id.name === targetName) {
            extracted = generator(path.parent).code; // Extract "var x = ..."
        }
    }
});

console.log(extracted);
```

**Usage**:
```bash
node tools/extract_func.js source/app.js encryptFn > source/encryptFn.js
```

---

## 5. Workflow Summary

1.  **Locate**: `rg -n "keyword" source/` to find line numbers.
2.  **Preview**: `rg -o ".{0,50}keyword.{0,50}"` to see context in minified files.
3.  **Slice**: `sed -n 'start,endp' file > new.js` for rough cuts.
4.  **Refine**: Use AST script or manual brace counting to get executable code.
```
