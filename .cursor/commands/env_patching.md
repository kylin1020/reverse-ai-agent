---
inclusion: manual
---

# JS Environment Patching

Emulate browser APIs in Node.js to run extracted JS code.

**Core Principle**: NEVER blind-patch. Trace first, patch only what's accessed and MISSING.

## Trace-First Workflow

**DO NOT blind-patch environments!** Patching without tracing is wrong because:
- You don't know what properties the JS actually accesses
- Cannot optimize precisely, wastes resources
- May introduce unnecessary detection points

**Correct flow**: Trace with Proxy → Analyze MISSING list → Patch only missing → Re-trace → Repeat

## When to Use

- Target algorithm requires browser globals (`window`, `document`, `navigator`)
- Pure Python reproduction is blocked by complex browser dependencies
- Code uses DOM APIs, Canvas, or Web Crypto

## Prerequisites

Before patching, verify:
1. Entry point located via stack trace (not grep)
2. Code deobfuscated if contains `_0x`, `\x` patterns
3. Dependencies identified via closure analysis
4. Extracted code runs but fails only on browser APIs

## Pipeline

LOCATE → EXTRACT → TRACE → ANALYZE MISSING → PATCH → RE-TRACE → VERIFY

**AI must execute the full loop autonomously** - run tracer, analyze output, patch, re-run, repeat until done. Do NOT stop and ask user to run commands.

**CRITICAL RULES:**
1. Only patch **browser properties** - if a property is not a standard browser API, do NOT patch it
2. **NEVER read original JS directly** - use `read_code_smart` / `search_code_smart` tools for all code reading
3. Loop until all browser-related MISSING properties are patched

The key output is the **MISSING list** - properties that were accessed but returned undefined.

## Code Reading Rules

**⚠️ NEVER use `readFile`, `cat`, `head`, `tail`, `grep` to read JS source code!**

Always use Smart-FS tools with **ABSOLUTE paths**:

| Action | Tool | Example |
|--------|------|---------|
| Read code | `read_code_smart` | `file_path="/abs/path/source/main.js", start_line=1, end_line=50` |
| Search pattern | `search_code_smart` | `file_path="/abs/path/source/main.js", query="navigator"` |
| Trace variable | `find_usage_smart` | `file_path="/abs/path/source/main.js", identifier="_0xabc", line=105` |

**Why**: Original JS is minified/obfuscated. Smart-FS tools beautify and provide source mapping.

## Phase 1: Locate Entry Point

Hook network calls to find param generation:

```javascript
(function() {
    const TARGET = 'signature';
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (body?.includes(TARGET)) {
            console.log("### TRAP ###");
            console.trace();
        }
        return _send.apply(this, arguments);
    };
})();
```

## Phase 2: Extract Code

1. Identify free variables (used but not defined locally)
2. Trace definitions in parent scopes
3. Extract with Babel Generator
4. Test: `node extracted.js` should fail only on browser APIs

## Phase 3: Transparent Proxy Tracing

### Core Goal: Detect MISSING Properties

The tracer's job is NOT to list all browser properties. It must:
1. Detect what the JS code actually accesses
2. Report which accessed properties are NOT implemented (MISSING)
3. Guide iterative patching - fix missing → re-trace → repeat

The **MISSING list** is the actionable output that drives patching work.

### Design Principles

1. **Use Reflect for ALL operations** - prevents proxy detection, maintains native behavior
2. **Track accessed AND missing** - flag properties that returned undefined
3. **Nested depth tracking** - know exactly which level is missing
4. **Wrap real JSDOM objects** - not empty objects with property maps

### Why Reflect Matters

- `Reflect.get(target, prop, receiver)` preserves `this` binding (vs `target[prop]`)
- `Reflect.has(target, prop)` matches native `in` operator behavior
- `Reflect.ownKeys(target)` returns same as native `Object.keys`
- Fully transparent proxy that passes anti-bot detection

### Proxy Detection Prevention

Anti-bot scripts detect proxies via toString behavior, property descriptor mismatches, prototype chain checks, and ownKeys enumeration. Using Reflect for ALL operations ensures the proxy is undetectable.

### Key Implementation

The tracer must be **fully transparent** - return exactly what the real object returns (including undefined). Only log and report at the end.

```javascript
const accessLog = [];
const missingLog = [];

function createTracingProxy(name, target, depth = 0) {
    if (depth > 20) return target;
    if (target === null || target === undefined) return target;
    if (typeof target !== 'object' && typeof target !== 'function') return target;
    
    const handler = {
        get(target, prop, receiver) {
            if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
            
            const path = `${name}.${prop}`;
            const value = Reflect.get(target, prop, receiver);
            
            // Check if missing (undefined AND not a defined property)
            const isMissing = value === undefined && !(prop in target);
            
            accessLog.push({ type: 'get', path, depth, missing: isMissing });
            if (isMissing) {
                missingLog.push({ path, reason: 'property not defined' });
            }
            
            // CRITICAL: Return actual value, even if undefined!
            // Do NOT return a proxy for missing properties - that changes behavior
            if (value && typeof value === 'object') {
                return createTracingProxy(path, value, depth + 1);
            }
            if (typeof value === 'function') {
                return createTracingFunction(path, value, target);
            }
            return value;  // Returns undefined if missing - this is correct!
        },
        
        has(target, prop) {
            const path = `${name}.${prop}`;
            const exists = Reflect.has(target, prop);
            accessLog.push({ type: 'has', path, exists });
            if (!exists) {
                missingLog.push({ path, reason: 'in check failed' });
            }
            return exists;  // Return real boolean
        },
        
        set(target, prop, value, receiver) {
            accessLog.push({ type: 'set', path: `${name}.${prop}` });
            return Reflect.set(target, prop, value, receiver);
        },
        
        // All traps delegate to Reflect - fully transparent
        deleteProperty: (t, p) => Reflect.deleteProperty(t, p),
        ownKeys: (t) => Reflect.ownKeys(t),
        getOwnPropertyDescriptor: (t, p) => Reflect.getOwnPropertyDescriptor(t, p),
        getPrototypeOf: (t) => Reflect.getPrototypeOf(t),
    };
    
    return new Proxy(target, handler);
}
```

**Key rule**: The proxy only LOGS access, it does NOT change behavior. Missing properties return undefined, just like the real object would. The MISSING report is generated at exit.

### Setup with Real JSDOM Objects

```javascript
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>', { url: 'https://example.com' });
const realWindow = dom.window;

// Proxy wraps REAL objects, Reflect returns real values
global.window = createTracingProxy('window', realWindow, 0);
global.document = createTracingProxy('document', realWindow.document, 0);
global.navigator = createTracingProxy('navigator', realWindow.navigator, 0);
```

### Report Generator

```javascript
function generateReport() {
    const uniqueMissing = [...new Map(missingLog.map(m => [m.path, m])).values()];
    
    console.log(`\n❌ MISSING (${uniqueMissing.length}) - PATCH THESE:`);
    uniqueMissing.forEach(m => console.log(`  ${m.path} - ${m.reason}`));
    
    console.log(`\n📝 PATCH TODO:`);
    uniqueMissing.forEach(m => console.log(`// TODO: ${m.path}`));
}
process.on('exit', generateReport);
```

## Phase 4: Targeted Patching

**Only patch BROWSER properties from the MISSING list!**

### Browser Property Check

Before patching any property, verify it's a standard browser API:
- `window.*`, `document.*`, `navigator.*`, `screen.*`, `location.*` → Browser API ✅
- `performance.*`, `crypto.*`, `localStorage.*`, `sessionStorage.*` → Browser API ✅
- `XMLHttpRequest`, `fetch`, `WebSocket`, `Worker` → Browser API ✅
- `Canvas`, `WebGL`, `AudioContext` → Browser API ✅
- Custom properties like `window.bdms`, `window._customVar` → NOT browser API ❌ (skip)

**Do NOT patch non-browser properties** - they are application-specific and should remain undefined.

| Trace Type | Meaning | Patch Strategy |
|------------|---------|----------------|
| GET missing | Code reads undefined property | Return appropriate value (if browser API) |
| HAS failed | Code checks `prop in obj` | Ensure property exists (if browser API) |
| CALL | Code invokes function | Implement function logic (if browser API) |

### Depth-Aware Patching

If trace shows nested access like `navigator.connection.effectiveType`, patch all levels:

```javascript
global.navigator.connection = { effectiveType: '4g', rtt: 50 };
```

## Phase 5: Iterative Refinement

**AI must run this loop autonomously without user intervention:**

1. Run tracer: `node env_tracer.js` → capture MISSING list from output
2. Patch missing properties in env.js
3. Re-run tracer → check for new missing (child props of newly patched parents)
4. Repeat until MISSING list is empty and output matches expected

Do NOT stop after creating files and ask user to run. Execute the commands, read the output, iterate automatically.

## Verification (Phase 1 Complete)

Success criteria for **Phase 1 (Environment Detection)**:
- JS loads without errors
- No browser-related MISSING properties
- Exported functions/objects are accessible

**⚠️ Phase 1 completion does NOT mean the work is done!**

## Phase 2: Function Debugging (User Interaction Required)

After environment detection completes successfully, **MUST ASK the user**:

```
✅ Phase 1 Complete - Environment detection done. JS loaded successfully.
   Exported: [list exported functions/objects]

To continue with Phase 2 (function debugging), I need:
1. Which function to test?
2. Example input parameters (from browser DevTools)
3. Expected output (from browser DevTools)

Note: Init functions may need config/token values. Please provide if applicable.
```

### Why User Input is Required

- Init functions need specific parameters (config, tokens, timestamps)
- Signature functions need real input to verify correctness
- Without browser-captured examples, cannot verify output
- Runtime values may affect results

### Phase 2 Workflow

1. User provides: function + input + expected output
2. AI writes test, runs it, compares output
3. If mismatch → trace, find more missing env
4. Repeat until output matches

## Autonomous Execution Rules

1. **Run commands yourself** - use `executeBash` to run tracer, don't tell user to run
2. **Parse output** - extract MISSING list from command output
3. **Filter browser APIs only** - skip non-browser properties in MISSING list
4. **Patch immediately** - update env.js based on filtered missing list
5. **Re-run automatically** - execute tracer again after patching
6. **Loop until done** - continue until no browser-related missing properties
7. **Use Smart-FS for code reading** - never use readFile/cat/grep for JS files
8. **Report only when complete** - show final status, not intermediate steps

Example autonomous flow:
```
AI: [runs node env_tracer.js]
AI: [reads output, finds 5 missing: navigator.connection, window.bdms, screen.width, ...]
AI: [filters: navigator.connection ✅ browser, window.bdms ❌ skip, screen.width ✅ browser]
AI: [patches env.js with browser properties only]
AI: [runs node env_tracer.js again]
AI: [reads output, finds 1 new missing: navigator.connection.rtt ✅ browser]
AI: [patches env.js]
AI: [runs again, remaining missing are all non-browser → done]
AI: "Done. Patched 4 browser properties."
```

## Status Report

```
📊 ENV PATCH STATUS:
- Phase: [Tracing|Patching|Verification]
- Missing: [count] properties
- TODO: [list of missing paths]
- Blocker: [specific issue]
```

## File Structure

```
artifacts/jsrev/{domain}/
├── lib/
│   ├── env_tracer.js   # Tracing proxy
│   └── env.js          # Final patches (from MISSING list)
├── logs/
│   └── access_log.json # Trace output with missing flags
└── source/             # Extracted JS code
```

## Anti-Patterns

### ❌ Reading JS with readFile/cat/grep
```javascript
// WRONG: Direct file reading
readFile({ path: "source/main.js" })  // ❌ Minified, unreadable
executeBash({ command: "cat source/main.js" })  // ❌ Same problem

// RIGHT: Use Smart-FS tools
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 1, end_line: 50 })
search_code_smart({ file_path: "/abs/path/source/main.js", query: "navigator" })
```

### ❌ Patching Non-Browser Properties
```javascript
// WRONG: Patching application-specific properties
global.window.bdms = {};  // ❌ Not a browser API
global.window._customTracker = {};  // ❌ Not a browser API

// RIGHT: Only patch standard browser APIs
global.navigator.connection = { effectiveType: '4g' };  // ✅ Browser API
global.screen.width = 1920;  // ✅ Browser API
```

### ❌ Blind Patching
```javascript
// WRONG: Patching without knowing what's accessed
global.navigator = { userAgent, platform, language, ... };  // 100+ props
```

### ❌ Tracer Without MISSING Detection
```javascript
// WRONG: Only logs, doesn't report what's missing
get(target, prop) {
    console.log(`accessed: ${prop}`);  // Useless - is it implemented?
    return Reflect.get(target, prop);
}
```

### ❌ Returning Proxy for Missing Properties
```javascript
// WRONG: Returns proxy instead of undefined - changes code behavior!
if (isMissing) {
    return createTracingProxy(path, {}, depth + 1);  // Code sees object, not undefined!
}

// RIGHT: Return undefined, just log it
if (isMissing) {
    missingLog.push({ path });
}
return value;  // undefined - preserves original behavior
```

### ✅ Correct Approach
```javascript
// 1. Run tracer, get MISSING list
// 2. Patch ONLY missing:
global.navigator.connection = { effectiveType: '4g' };
// 3. Re-trace, find new missing
// 4. Repeat until done
```
