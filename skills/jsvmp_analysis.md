# JSVMP Analysis Skill

> **Trigger**: `while(true) { switch(op) {...} }` VM dispatcher with stack operations  
> **Goal**: Recover algorithm from VM bytecode via breakpoint instrumentation  
> **Related**: `skills/js_deobfuscation.md` (for non-VM obfuscation)

---

## ⚠️ CORE METHODOLOGY: Trace → Reverse → Verify

**JSVMP is a black box. The ONLY way to understand it:**

```
1. INSTRUMENT → Set breakpoints at VM dispatcher
2. TRACE      → Capture runtime execution logs  
3. REVERSE    → Analyze trace to deduce algorithm logic
4. VERIFY     → Set targeted breakpoints to confirm hypothesis
5. IMPLEMENT  → Reproduce in Python
```

**Static analysis is USELESS.** You cannot read bytecode. You can only observe execution.

---

## ⚠️ RULE ZERO: NO PLAINTEXT SEARCH

**JSVMP compiles ALL logic into bytecode. Plaintext keywords DO NOT EXIST.**

```bash
# ❌ FORBIDDEN - POINTLESS in JSVMP:
rg "btoa|atob|base64|MD5|SHA|encrypt|sign" source/vm.js
rg "fromCharCode|charCodeAt" source/vm.js

# ✅ CORRECT - Identify algorithm from TRACE:
# - Runtime constants: 0x67452301 = MD5 IV, 0x6a09e667 = SHA256 IV
# - Operation patterns: XOR chains, bit rotations, S-Box lookups
# - Output format: 32-char hex = MD5, 64-char = SHA256
```

**VIOLATION = WASTED EFFORT.**

---

## Phase 1: Locate VM Dispatcher & Set Golden Breakpoints

**Task**: Find instrumentation points. Accuracy prevents log noise.

1. **VM Entry**: Just before `while(true)` → Capture bytecode array, keys, env
2. **Fetch-Decode (Golden BP)**: First line in loop where `op = bytecode[pc++]` → Primary trace point
3. **External Bridge**: `apply`/`call` handler → Detect native JS calls
4. **Memory Pool**: Variable storage array (not stack) → Track persistent data

---

## Phase 2: Instrumentation

**Template** (replace vars with actual minified names):
```javascript
console.log(`[T] PC:${PC}|OP:${OP}|STK:${JSON.stringify(STK.slice(-5))}`), false
```

---

## Phase 3: Trace Collection & Mining

```javascript
// Save logs to file (avoid context overflow)
list_console_messages(savePath="vm_trace.txt", types=["log"])
```

```bash
# ✅ SAFE - Use -o with context or -M to cap output
rg -o ".{0,50}OP:42.{0,100}" vm_trace.txt | head -50
rg -M 200 "your_input" vm_trace.txt | head -30
awk -F'|' '{print $1,$2}' vm_trace.txt | head -100

# ❌ FORBIDDEN - context explosion
rg "pattern" vm_trace.txt    # No limit = disaster
```

---

## Phase 4: Reverse Algorithm from Trace

**From trace logs, deduce:**

1. **Opcode Mapping**: `[10,20]→[30]` = ADD, `[10,20]→[200]` = MUL, etc.
2. **Constants**: `0x67452301` = MD5, `0x6a09e667` = SHA256, 256-byte array = S-Box
3. **Differential Analysis**: Compare trace_a (input "AAA") vs trace_b (input "AAB") → find divergence point

**Then VERIFY hypothesis with targeted breakpoint:**
```javascript
// Pause at suspected crypto round to inspect values
set_breakpoint(urlRegex=".*vm\.js.*", lineNumber=1, columnNumber=XXXX)
// Check: get_scope_variables(), evaluate_on_call_frame()
```

---

## Phase 4.5: Arithmetic Operation Tracing (Magic Constant Discovery)

**When standard trace is insufficient, instrument arithmetic operations (+, -, *, /, %, ^, &, |, >>).**

⚠️ **Warning**: Produces MASSIVE logs. Use only when algorithm structure is unclear.

**Why it works:**
- Crypto algorithms use magic constants in arithmetic: `0x5A827999` (SHA1), `0x61C88647` (TEA)
- Bit rotation patterns reveal algorithm type: `>>> 7, >>> 18` = SHA256 sigma
- Multiplication/modulo constants identify hash rounds

**Instrumentation template:**
```javascript
// At arithmetic operation handler in VM
console.log(`[ARITH] ${a} ${op} ${b} = ${result}`), false

// Example output reveals algorithm structure:
// [ARITH] 0x67452301 + 0xd76aa478 = 0x3EB1C779  ← MD5 round constant!
// [ARITH] x >>> 7 = y                            ← SHA256 sigma pattern
// [ARITH] x * 0x61C88647 = y                     ← TEA delta constant
```

**Mining arithmetic logs:**
```bash
# Find magic constants (hex patterns)
rg -o "0x[0-9a-fA-F]{6,8}" arith_trace.txt | sort | uniq -c | sort -rn | head -20

# Find rotation patterns
rg -o ">>> [0-9]+" arith_trace.txt | sort | uniq -c | sort -rn

# Find repeated multiplication constants
rg -o "\* 0x[0-9a-fA-F]+" arith_trace.txt | sort | uniq -c | sort -rn | head -10
```

**Known magic constants:**
| Constant | Algorithm |
|----------|-----------|
| `0x67452301, 0xEFCDAB89` | MD5 IV |
| `0x6A09E667, 0xBB67AE85` | SHA256 IV |
| `0x5A827999, 0x6ED9EBA1` | SHA1 round constants |
| `0x61C88647` | TEA delta |
| `0x9E3779B9` | Golden ratio (TEA, many hashes) |

---

## Phase 5: Deliverables

1. **Component Map**: PC, Stack, Bytecode, Opcode variable names
2. **Opcode Table**: `0x01: PUSH, 0x02: ADD, 0x03: XOR...`
3. **Algorithm Pseudo-code**: High-level logic reconstruction
4. **Python Implementation**: Functional reproduction

---

## Troubleshooting

- **Noisy logs?** Filter: `OP === 0x25 && console.log(...)`
- **Missing data?** Check for secondary stack or accumulator register
- **Undefined vars?** Wrong scope → use `get_scope_variables` to verify
- **Anti-debug?** Look for `Date.now()` / `performance.now()` timing checks