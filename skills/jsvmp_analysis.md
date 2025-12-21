# Advanced JSVMP Reverse Engineering Skill

> **Trigger**: Infinite Loop Logic (any syntax) + Bytecode Array + Virtual Instruction Pointer (VIP)  
> **Goal**: Map Virtual Opcodes to Real Logic & Reconstruct Algorithms  
> **Core Concept**: JSVMP is a **State Machine**. Focus on **Data Flow** (Stack/Context changes) rather than **Control Flow** (Loop syntax).

---

## ⚠️ Core Concept: The 3 Forms of Dispatchers

Do not limit your search to `switch` statements. A VM Dispatcher is simply a mechanism mapping `Opcode -> Handler`. There are three common implementations:

1.  **Switch-Case (Classic)**:
    *   **Pattern**: `switch(op) { case 1: ... case 2: ... }`
    *   **Weakness**: Structurally obvious; easily reconstructed via AST.
2.  **If-Else Chain (Flattened)**:
    *   **Pattern**: `if(op == 1) ... else if(op == 2) ...` (often nested or using binary search).
    *   **Weakness**: High code volume, lower execution efficiency, but functionality is identical to switch.
3.  **Direct Threading / Lookup Table (Advanced)**:
    *   **Pattern**: `handlers[op](context)` or `funcs[instruction & 255].apply(...)`.
    *   **Stealth**: No `switch`, no `if`. Just a single array access and function call.
    *   **Weakness**: Requires maintaining a large function array in memory.

---

## Phase 1: Locate the VM Core (The "CPU")

**Do not search for keywords.** Locate the VM based on **Runtime Behavior**.

**Feature 1: Massive Instruction Set (Bytecode)**
*   Look for unusually long `Strings` (Base64) or `Integer Arrays` (Hex) in the source code.

**Feature 2: Virtual Instruction Pointer (VIP/PC)**
*   Inside a loop, identify a variable that strictly increments or jumps (e.g., `pc++`, `pc += 3`, `pc = target`).

**Feature 3: Virtual Stack/Register Context**
*   An array defined *outside* the loop that is frequently accessed *inside* the loop using `push`, `pop`, or `stack[sp--]`.

**Universal Location Strategy (Timeline Analysis)**:
1.  Record a session in the Chrome DevTools **Performance** tab.
2.  Find the function with the longest "Self Time" (usually a solid yellow bar).
3.  Dive into that function and look for the **innermost loop structure** (whether it's `for`, `while`, `do-while`, or recursive calls).

---

## Phase 2: Instrumentation Strategy

The injection point depends on the Dispatcher structure.

### Scenario A: Classic Switch or If-Else
**Point**: Inside the loop, immediately after the Opcode is fetched.

```javascript
// Pseudo-code
while (true) { // or for(;;)
    var op = bytecode[pc++]; // <--- GOLDEN POINT: Fetch
    // INJECT HERE: log(pc, op, stack_snapshot)
    
    if (op == 1) { ... }
    else if (op == 2) { ... }
}
```

### Scenario B: Function Array (Lookup Table)
**Point**: Hook the function call or the array access.

```javascript
// Pseudo-code
var op = bytecode[pc++];

// Original: handlers[op](ctx);

// INJECTED:
(function(){
    console.log(`[VM] PC:${pc-1} OP:${op} Stack:${ctx.stack.slice(-5)}`);
    return handlers[op](ctx); 
})();
```

### Scenario C: Arithmetic Hooking (The "Nuclear Option")
If the Dispatcher is heavily obfuscated, hook JavaScript's primitive operations to reveal the algorithm (e.g., MD5/AES logic) directly.

```javascript
// Example: Hooking toString or valueOf for implicit conversions
// Or use Proxy on the Environment Object if accessible.
```

---

## Phase 3: Smart Tracing & Analysis

Logging simple Opcodes is often insufficient. You must record **Side Effects**.

**Recommended Log Format**:
```json
{
  "PC": 1024,
  "OP": 35,
  "Stack_Top": [10, 20], 
  "Action": "Unknown" 
}
```

**Technique: Differential Analysis**
1.  Input `AAAA` -> Run -> Save `trace_A.log`
2.  Input `AAAB` -> Run -> Save `trace_B.log`
3.  **Compare**: The first line where the logs diverge is exactly where the **input is read** and **processed**.

---

## Phase 4: Reconstruction (Reverse -> Implement)

### 1. Identify Control Flow (Jumps)
In a VM, `if-else` logic usually manifests as manipulating the `PC`.
*   **JUMP**: `PC` changes abruptly (not `+1` or `+instruction_length`).
*   **CONDITIONAL JUMP (JZ/JNZ)**: `if (Stack.pop() == true) PC = target`.

### 2. Identify Cryptography (Bitwise Signatures)
Standard crypto algorithms rely on bitwise operations. Search your logs for:
*   **Hash Signatures**: `>>> 0` (Unsigned Right Shift), `& 0xFFFFFFFF`.
*   **Encryption (AES/DES)**: Frequent `XOR` operations and S-Box lookups (manifests as `Array[Index]` reads).

### 3. Handling Nested VMs
Advanced protectors (e.g., Akamai) may nest VMs.
*   **Symptom**: The decoded Opcode instruction seems to be manipulating *another* Bytecode array.
*   **Solution**: Ignore the outer interpreter. Focus on the data flow of the **inner** VM.

---

## Phase 5: Deliverable (Python Implementation)

Your goal is to write a Python emulator, not to beautify the JS.

```python
class SimpleVM:
    def __init__(self, bytecode):
        self.pc = 0
        self.bytecode = bytecode
        self.stack = []

    def step(self):
        op = self.bytecode[self.pc]
        self.pc += 1
        
        if op == 0x01: # PUSH
            val = self.bytecode[self.pc]
            self.stack.append(val)
            self.pc += 1
        elif op == 0x02: # ADD
            b = self.stack.pop()
            a = self.stack.pop()
            self.stack.append(a + b)
        elif op == 0x03: # JNZ (Jump if Not Zero)
            target = self.bytecode[self.pc]
            cond = self.stack.pop()
            if cond != 0:
                self.pc = target
            else:
                self.pc += 1
```

---

## Summary: The Modern JSVMP Methodology

1.  **Find the Loop**: Locate the "hottest" loop via Performance tools (ignore specific syntax).
2.  **Map the Trinity**: Identify **PC**, **Stack**, and **Bytecode**.
3.  **Instrument**: Log `PC` and `Stack` state at the "Fetch" stage.
4.  **Diff**: Change inputs to find the "Fork Point" in the execution trace.
5.  **Reconstruct**: Identify bitwise math and jumps to rebuild logic in Python.