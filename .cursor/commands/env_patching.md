# JS Environment Patching

Emulate browser APIs in Node.js to run extracted JS code.

**Core Principle**: Trace, don't guess. The browser is the source of truth.

## When to Use

- Target algorithm requires browser globals (`window`, `document`, `navigator`)
- Pure Python reproduction is blocked by complex browser dependencies
- Code uses DOM APIs, Canvas, or Web Crypto

## Prerequisites

Before patching, verify:
1. Entry point located via stack trace (not grep)
2. Code deobfuscated if contains `_0x`, `\x` patterns
3. Dependencies identified via closure analysis
4. Extracted code runs but fails only on browser APIs (no ReferenceErrors)

## Pipeline

```
LOCATE → EXTRACT → SNIFF → PATCH → VERIFY
```

## Phase 1: Locate Entry Point

Hook network calls to find param generation:

```javascript
// Inject via evaluate_script
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

## Phase 3: Environment Sniffing

Detect missing APIs with recursive Proxy:

```javascript
const missing = new Set();
const proxy = (path) => new Proxy(() => {}, {
    get(_, prop) {
        if (prop === Symbol.toPrimitive) return () => '';
        if (prop === 'toString' || prop === 'valueOf') return () => '';
        missing.add(`${path}.${String(prop)}`);
        return proxy(`${path}.${String(prop)}`);
    },
    apply() { return proxy(`${path}()`); },
    construct() { return proxy(`new ${path}`); }
});

global.window = proxy("window");
global.document = proxy("document");
global.navigator = proxy("navigator");

process.on('exit', () => {
    console.log('\n=== MISSING APIs ===');
    [...missing].sort().forEach(p => console.log(p));
});
```

## Phase 4: Patching Levels

Patch incrementally. Run after each level.

| Level | Scope | Examples |
|-------|-------|----------|
| L1 | Simple mocks | `btoa`, `atob`, `navigator.userAgent` |
| L2 | JSDOM | `document.createElement`, DOM traversal |
| L3 | Native fixes | `toString()` detection, `instanceof` checks |

### L1: Basic Globals

```javascript
global.window = global;
global.btoa = (s) => Buffer.from(s).toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString();
global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' };
```

### L2: JSDOM

```javascript
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>');
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
```

### L3: Anti-Detection

```javascript
const makeNative = (fn, name) => {
    Object.defineProperty(fn, 'toString', {
        value: () => `function ${name}() { [native code] }`
    });
    return fn;
};

global.btoa = makeNative((s) => Buffer.from(s).toString('base64'), 'btoa');
```

## Verification

Success criteria:
- Node output matches browser output byte-for-byte
- Works with fresh inputs, not just captured values
- No `undefined` or `NaN` in output

## Status Report

When blocked:

```
📊 ENV PATCH STATUS:
- Phase: [Location|Extraction|Sniffing|Patching]
- Missing APIs: [list from sniffer]
- Blocker: [specific issue]
- Options: A) ... B) ...
```

## File Structure

```
artifacts/jsrev/{domain}/
├── lib/env.js      # Environment patches
├── lib/sign.js     # Extracted signing logic
├── tests/env*.js   # Patch verification
└── output/         # Extracted/modified code
```
