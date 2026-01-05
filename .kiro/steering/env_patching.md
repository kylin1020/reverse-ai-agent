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

The key output is the **MISSING list** - properties that were accessed but returned undefined.

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

**Only patch what's in the MISSING list!**

| Trace Type | Meaning | Patch Strategy |
|------------|---------|----------------|
| GET missing | Code reads undefined property | Return appropriate value |
| HAS failed | Code checks `prop in obj` | Ensure property exists |
| CALL | Code invokes function | Implement function logic |

### Depth-Aware Patching

If trace shows nested access like `navigator.connection.effectiveType`, patch all levels:

```javascript
global.navigator.connection = { effectiveType: '4g', rtt: 50 };
```

## Phase 5: Iterative Refinement

This is a LOOP, not one-shot:

1. TRACE → Get MISSING list
2. PATCH → Fix missing properties
3. RE-TRACE → New missing may appear (child props of newly patched parents)
4. Repeat until no missing and output matches browser

Each iteration reveals NEW missing properties that weren't accessed before because their parent was undefined.

## Verification

Success criteria:
- Node output matches browser output byte-for-byte
- Works with fresh inputs, not just captured values
- No `undefined` or `NaN` in output
- MISSING list is empty

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
