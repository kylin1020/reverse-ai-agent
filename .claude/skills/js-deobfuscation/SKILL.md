# JavaScript Deobfuscation Skill

**Core Principle**: Babel AST is the ONLY reliable method for true deobfuscation. Use `apply_custom_transform` for transforms, smart-fs tools for code analysis.

## Babel Plugin Format

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

## Transform Order

1. **Anti-debug removal** — Remove debugger traps
2. **Hex/Unicode normalization** — Restore readable literals
3. **String array decoding** — Replace decoder calls
4. **Computed property cleanup** — `obj["prop"]` → `obj.prop`
5. **Constant folding** — Evaluate static expressions
6. **Dead code elimination** — Remove unreachable branches
7. **Control flow unflattening** — Restore natural flow

## Verify Deobfuscation Results

### Syntax Validation (MANDATORY)
```bash
# Validate transform script
npx eslint --no-eslintrc --env es2020 transforms/*.js

# Validate deobfuscated output
npx eslint --no-eslintrc --parser-options=ecmaVersion:2020 source/*_deob.js
```

### Readability Check
Sample 3 segments (head / middle / tail):
```
read_code_smart(file_path="output.js", start_line=1, end_line=50)
read_code_smart(file_path="output.js", start_line=200, end_line=300)
read_code_smart(file_path="output.js", start_line=450, end_line=500)
```

## Essential Transforms

### Anti-Debug Removal

Pattern: Remove debugger statements, setInterval/setTimeout with debugger, console checks

### Hex/Unicode Normalization

Pattern: Delete `node.extra` to normalize literals

### String Array Decoding

**RULE: Large arrays (>50 items) or long strings (>200 chars) must be extracted to file first, NEVER hardcode in transform.**

#### Step 1: Analyze Pattern

Use `search_code_smart` to identify:
- Array variable name: `_0x1234`
- Decoder function name: `_0xabcd`
- Index offset: `0x100` (look for `idx - 0x???`)
- Shuffle count: Check if array is rotated

#### Step 2: Extract Array to File

Run extraction script with node to save array to `raw/string_array.txt` and metadata to `raw/string_array_meta.txt`

#### Step 3: Transform Using Extracted Data

Load extracted data, apply shuffle if needed, replace decoder calls with actual strings

### Computed Property Cleanup

Pattern: Convert `obj["prop"]` to `obj.prop` when property is valid identifier

### Constant Folding

Pattern: Evaluate `BinaryExpression`, `UnaryExpression`, `ConditionalExpression` when confident

### Dead Code Elimination

Pattern: Remove unreachable branches in `IfStatement` when test is constant

## Code Analysis Tools

```
# Read beautified code with source map coords
read_code_smart(file_path="source.js", start_line=1, end_line=100)

# Search patterns in beautified code
search_code_smart(file_path="source.js", query="var _0x.*= *\\[")

# Find variable definitions and references (AST scope analysis)
find_usage_smart(file_path="source.js", identifier="_0x1234", line=50)
```

## Common Decoders

### RC4
Pattern: KSA + PRGA with key scheduling

### Base64 + XOR
Pattern: Base64 decode then XOR with key

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Parser fails | Check encoding, try different sourceType |
| Transform breaks | Use `read_code_smart` to inspect output |
| Wrong offset | `search_code_smart` for `- 0x` pattern |
| Unknown shuffle | `find_usage_smart` to trace shuffler call |
