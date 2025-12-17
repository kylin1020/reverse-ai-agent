# JSVMP Analysis Skill

> **Trigger**: `while(true) { switch(op) {...} }` VM dispatcher with stack operations  
> **Goal**: Recover algorithm from VM bytecode via breakpoint instrumentation  
> **Related**: `skills/js_deobfuscation.md` (for non-VM obfuscation)  
> **Tools**: Use `set_breakpoint` for logging. `evaluate_script` ONLY for triggering globals.

---

## 0. When to Load This Skill

```
Is it JSVMP?
  │
  ├─ while(true) + switch(opcode) dispatcher? 
  │     └─ YES → Continue
  │
  ├─ Stack operations (push/pop) inside cases?
  │     └─ YES → Continue
  │
  ├─ Bytecode array or encoded string feeding the switch?
  │     └─ YES → This is JSVMP → Use this skill
  │
  └─ Simple control flow flatten (state array, no stack)?
        └─ NO stack ops → Use skills/js_deobfuscation.md §3.6
```

> **IMPORTANT**: JSVMP compiles code to bytecode executed by custom interpreter. **Static AST cannot restore it**. Use **dynamic analysis with breakpoint logging**.

---

## 1. Component Identification

### 1.1 Core VM Components

| Component | Pattern | Role |
|-----------|---------|------|
| **Interpreter** | `while(true) { switch(op) {...} }` | Executes bytecode |
| **Program Counter** | `pc++`, `idx++`, `_i++` | Execution position |
| **Stack** | Array with `push()`/`pop()` | Operand storage |
| **Accumulator** | Single variable (temp) | Intermediate results |
| **Bytecode** | Large array or encoded string | Opcode sequence |
| **Opcode** | Index/value controlling switch | Current instruction |

### 1.2 Quick Identification

```javascript
// Search for VM dispatcher
grep(pattern="while\\s*\\(\\s*(!0|true|1)\\s*\\).*switch", type="js", head_limit=10)

// Search for stack operations
grep(pattern="\\.push\\(|\\.pop\\(", type="js", head_limit=30)

// Search for program counter patterns
grep(pattern="\\+\\+|\\[.*\\+\\+\\]", type="js", head_limit=20)
```

### 1.3 Example VM Structure

```javascript
// Typical JSVMP structure
var _bytecode = [23, 15, 42, 7, ...];  // or encoded string
var _stack = [];
var _pc = 0;

while (true) {
    var _op = _bytecode[_pc++];
    switch (_op) {
        case 1:  // PUSH_CONST
            _stack.push(_bytecode[_pc++]);
            break;
        case 2:  // ADD
            var b = _stack.pop();
            var a = _stack.pop();
            _stack.push(a + b);
            break;
        case 3:  // CALL
            var fn = _stack.pop();
            var args = _stack.pop();
            _stack.push(fn.apply(null, args));
            break;
        case 255:  // HALT
            return _stack.pop();
    }
}
```

---

## 2. Breakpoint Instrumentation

### 2.1 Strategy

**Goal**: Log VM state at each instruction via conditional breakpoints (no pause, no code modification).

**Key positions to instrument**:

| Location | What to log | Purpose |
|----------|-------------|---------|
| Switch entry | PC, opcode | Track execution flow |
| After stack push | Stack top 3-5 | Data flow |
| After stack pop | Popped value | Value consumption |
| External calls | Function name, args | API interactions |

### 2.2 Setting Up Logging Breakpoint

```javascript
// Step 1: Find dispatcher line number
grep(pattern="switch.*_op|switch.*opcode", type="js", head_limit=5)

// Step 2: Set logging breakpoint (NO PAUSE)
set_breakpoint(
    breakpointId="vm_trace",
    urlRegex=".*target\\.js.*",
    lineNumber=1234,  // First line inside while loop
    condition='console.log("[PC:" + _pc + "] OP:" + _op + " | Stack:", JSON.stringify(_stack.slice(-5))), false'
)

// ⚠️ The trailing ", false" is CRITICAL - prevents pausing!
```

### 2.3 Common Variable Names to Log

```javascript
// Adapt condition based on actual variable names found:

// Pattern A: Explicit names
condition='console.log("[PC:"+pc+"] OP:"+opcode+" Stack:"+JSON.stringify(stack.slice(-3))), false'

// Pattern B: Minified (_0x style)
condition='console.log("[PC:"+_0x1234+"] OP:"+_0x5678+" Stack:"+JSON.stringify(_0xabcd.slice(-3))), false'

// Pattern C: With accumulator
condition='console.log("[PC:"+i+"] OP:"+op+" Stack:"+JSON.stringify(s.slice(-3))+" Acc:"+acc), false'
```

### 2.4 MCP Workflow

```javascript
// 1. Set logging breakpoint (NO PAUSE)
set_breakpoint(breakpointId="vm_log", urlRegex=".*vm\\.js.*", lineNumber=100,
    condition='console.log("[PC:"+pc+"] OP:"+op), false')

// 2. Trigger execution via:
//    - User interaction (click button, submit form)
//    - evaluate_script ONLY for calling global functions:
evaluate_script(function="() => window.targetFunction('test_input')")

// 3. Retrieve logs
list_console_messages(types=["log"], pageSize=100)

// 4. Get specific message details if needed
get_console_message(msgid=123)
```

> ⚠️ **evaluate_script restrictions**: ONLY use for triggering global functions. Never for hooking, intercepting, or logging—use `set_breakpoint` instead!

---

## 3. Log Analysis

### 3.1 Log Format

```
[PC:0042] OP:15 | Stack: [1234, "abc", null]
[PC:0043] OP:23 | Stack: [1234, "abc"]
[PC:0044] OP:07 | Stack: [1234, 97]
[PC:0045] OP:12 | Stack: [1234, 97, "key"]
[PC:0046] OP:18 | Stack: [1234, 28]  ← XOR result (97 ^ "key"[0])
```

### 3.2 Algorithm Recovery Steps

1. **Locate input**: Search logs for known input string's first appearance
2. **Track data flow**: Follow values through stack operations
3. **Identify operations**:
   - `[a, b] → [a+b]` = ADD
   - `[a, b] → [a^b]` = XOR
   - `[a, b] → [a*b]` = MUL
   - `[a] → [a<<n]` = Left shift
   - `["str"] → [97, 98, 99]` = String to char codes
4. **Mark algorithm range**: "input appears" → "result produced"
5. **Extract sequence**: List operations in order

### 3.3 Diff Analysis (Two-Input Comparison)

```bash
# Trigger with input "AAAAAA", save logs
# Trigger with input "BAAAAA", save logs
# Compare to find input-dependent instructions

diff log_input_a.txt log_input_b.txt
```

**Purpose**: 
- Quickly isolate input-dependent code
- Filter out init/env detection noise
- Find encryption entry point

### 3.4 Conditional Pause Breakpoints

When you need to inspect specific state:

```javascript
// Pause when specific value appears on stack
set_breakpoint(
    breakpointId="pause_on_match",
    urlRegex=".*vm\\.js.*",
    lineNumber=100,
    condition='_stack[_stack.length-1]?.includes?.("SearchString")'  // No ", false" = PAUSES
)

// Pause at specific opcode
set_breakpoint(
    breakpointId="pause_op42",
    urlRegex=".*vm\\.js.*",
    lineNumber=100,
    condition='_op === 42'
)
```

⚠️ **WARNING**: Pausing breakpoints block MCP calls! After inspection:
```javascript
resume_execution()
// or
clear_all_breakpoints()
```

### 3.5 Inspecting When Paused

```javascript
// Get current state
get_debugger_status()

// Get all local variables
get_scope_variables(frameIndex=0)

// Evaluate specific expression
evaluate_on_call_frame(expression="_stack.slice(-10)")
evaluate_on_call_frame(expression="JSON.stringify(_bytecode.slice(_pc, _pc+20))")
```

---

## 4. Opcode Mapping

### 4.1 Common Opcode Categories

| Category | Opcodes | Stack Effect |
|----------|---------|--------------|
| **Constants** | PUSH_CONST, PUSH_NULL | `[] → [value]` |
| **Variables** | LOAD_VAR, STORE_VAR | `[] → [value]`, `[value] → []` |
| **Arithmetic** | ADD, SUB, MUL, DIV, MOD | `[a, b] → [result]` |
| **Bitwise** | AND, OR, XOR, NOT, SHL, SHR | `[a, b] → [result]` |
| **Comparison** | EQ, NE, LT, GT, LE, GE | `[a, b] → [bool]` |
| **Control** | JMP, JMP_IF, JMP_IFNOT | PC changes |
| **Call** | CALL, RETURN | `[args, fn] → [result]` |
| **Object** | GET_PROP, SET_PROP | `[obj, key] → [value]` |

### 4.2 Example Opcode Table

| Opcode | Name | Operation | Stack Change |
|--------|------|-----------|--------------|
| 0x01 | PUSH_CONST | Push literal | `[] → [const]` |
| 0x02 | PUSH_VAR | Push variable | `[] → [var]` |
| 0x10 | ADD | Addition | `[a, b] → [a+b]` |
| 0x11 | SUB | Subtraction | `[a, b] → [a-b]` |
| 0x12 | XOR | Bitwise XOR | `[a, b] → [a^b]` |
| 0x13 | AND | Bitwise AND | `[a, b] → [a&b]` |
| 0x20 | CALL | Function call | `[args, fn] → [result]` |
| 0x21 | CALL_METHOD | Method call | `[args, obj, method] → [result]` |
| 0x30 | JMP | Jump | `pc = addr` |
| 0x31 | JMP_IF | Conditional jump | `[cond] → [], if true: pc = addr` |
| 0xFF | HALT | Stop execution | Return stack top |

### 4.3 Building Your Opcode Map

```javascript
// Set breakpoint to log opcode with full context
set_breakpoint(
    breakpointId="opcode_map",
    urlRegex=".*vm\\.js.*",
    lineNumber=100,
    condition='console.log("OP:"+_op+" BEFORE:"+JSON.stringify(_stack.slice(-3))), false'
)

// Also log after each case block executes (if possible)
// Compare BEFORE and AFTER to determine operation
```

---

## 5. Magic Numbers (Crypto Detection)

| Magic / Pattern | Algorithm |
|-----------------|-----------|
| `0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476` | MD5 IV |
| `0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0` | SHA-1 IV |
| `0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a` | SHA-256 IV |
| `0x63, 0x7c, 0x77, 0x7b` (S-Box start) | AES |
| 64 rounds with `>>>`, `^`, `&` | MD5/SHA family |
| `0x61707865, 0x3320646e, 0x79622d32, 0x6b206574` | ChaCha20 |
| `0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6` | SHA-1 K constants |

```javascript
// Search for magic numbers in bytecode or VM code
grep(pattern="0x67452301|0x6a09e667|0x5A827999", type="js", head_limit=10)
```

---

## 6. External Call Tracking

### 6.1 DOM/BOM Calls

Many VMs call external functions for crypto, encoding, or fingerprinting:

```javascript
// Find where VM calls external functions
// Look for CALL opcodes, then trace what's being called

// Set breakpoint on common APIs
set_breakpoint(
    breakpointId="log_btoa",
    urlRegex=".*",
    lineNumber=1,  // Won't work - need actual line
    condition='...'  // Use inject_console_log instead
)

// Better: Inject logging into the JS file
inject_console_log(
    ruleId="trace_calls",
    urlPattern="vm.js",
    targetCode="function callExternal",
    logMessage="External call",
    logVariables=["fnName", "args"]
)
```

### 6.2 Common External Calls to Watch

| Function | Purpose | Look For |
|----------|---------|----------|
| `btoa`/`atob` | Base64 | Encoding phase |
| `String.fromCharCode` | Byte to string | Output assembly |
| `charCodeAt` | String to bytes | Input processing |
| `Math.random` | Randomness | Nonce generation |
| `Date.now` | Timestamp | Time-based params |
| `TextEncoder` | UTF-8 encoding | Modern crypto |

---

## 7. Workflow Summary

```
1. IDENTIFY VM
   └─ grep for while(true)+switch, stack ops
   
2. LOCATE COMPONENTS
   └─ Find PC, stack, opcode variables
   
3. SET LOGGING BREAKPOINT (use debugger tools!)
   └─ set_breakpoint(condition='console.log(...), false')
   
4. TRIGGER EXECUTION
   ├─ User interaction (PREFERRED)
   └─ evaluate_script for global functions only
   
5. COLLECT LOGS
   └─ list_console_messages
   
6. ANALYZE
   ├─ Locate input in logs
   ├─ Track transformations
   ├─ Build opcode map
   └─ Identify algorithm
   
7. REPRODUCE
   └─ Implement in Python
```

> ⚠️ **Tool Priority**: `set_breakpoint` for logging → `get_scope_variables` when paused → `evaluate_script` ONLY for globals

---

## 8. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Too many logs | Every instruction logged | Add opcode filter: `_op===42 && console.log(...)` |
| Missing logs | Breakpoint not hit | Check urlRegex matches actual URL |
| "no matching scripts" | Wrong pattern | Use `list_network_requests` to find actual URL |
| Logs truncated | Large stack | Use `.slice(-5)` not full array |
| MCP blocked | Pausing breakpoint | `resume_execution()` or user F8 |

---

## 9. MCP Tools Quick Reference

### Debugger Tools (PRIMARY - Use These!)

```javascript
// ✅ Logging breakpoint (safe, no pause)
set_breakpoint(breakpointId, urlRegex, lineNumber, 
    condition='console.log("...", var), false')

// ✅ Retrieve logs
list_console_messages(types=["log"], pageSize=100)
get_console_message(msgid=123)

// ⚠️ Pausing breakpoint (careful - blocks MCP!)
set_breakpoint(breakpointId, urlRegex, lineNumber, condition='_op===42')

// ✅ When paused - use debugger tools
get_debugger_status()
get_scope_variables(searchTerm="stack")
evaluate_on_call_frame(expression="_stack.slice(-10)")  // NOT evaluate_script!
step_over() / step_into() / step_out()
resume_execution()

// Cleanup
clear_all_breakpoints()
disable_debugger()
```

### evaluate_script (RESTRICTED)

```javascript
// ✅ ONLY valid uses:
evaluate_script(function="() => window.globalFunc('input')")  // Trigger global
evaluate_script(function="() => window.CONFIG")               // Read global

// ❌ FORBIDDEN - use set_breakpoint instead:
// - Hooking functions
// - Adding console.log
// - Intercepting calls
// - Overriding methods
```

---


