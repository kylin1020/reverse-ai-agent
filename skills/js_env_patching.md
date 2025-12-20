# JS Environment Patching & Emulation Skill

> **Trigger**: `ReferenceError`, "Bot Detected" flags, or when `debugger` statements trigger environment checks.
> **Goal**: Create a "Transparent" browser simulation that passes both property existence tests and deep structural integrity checks.

---

## 1. Strategy Selector

```
Check detection level:
  │
  ├─ Level 1: Basic logic (e.g., uses btoa, userAgent)
  │     └─ Action: Simple Object Mocks ({ userAgent: '...' })
  │
  ├─ Level 2: Structural checks (e.g., instanceof, prototype)
  │     └─ Action: Use Happy-DOM or JSDOM + Prototype Restoration (§3)
  │
  └─ Level 3: Anti-Emulation (e.g., checks Proxy, toString, Descriptors)
        └─ Action: Proxy Sniffing (§2) + Native Function Hooks (§4) + Descriptor Patching (§5)
```

---

## 2. Advanced Proxy Sniffing (The "Transparent" Detective)

A basic Proxy is easily detected. This version uses `Reflect` to ensure the Proxy behaves exactly like the target object while logging missing properties.

```javascript
const envSniffer = (name, target = {}) => {
    return new Proxy(target, {
        get(target, prop, receiver) {
            // 1. Avoid infinite recursion for internal symbols
            if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
            
            const value = Reflect.get(target, prop, receiver);
            if (value !== undefined) return value;

            // 2. Log missing properties to identify what to patch next
            console.warn(`[MISSING] ${name}.${String(prop)} accessed.`);
            
            // 3. Return a recursive proxy to prevent "cannot read property of undefined"
            return envSniffer(`${name}.${String(prop)}`);
        },
        getOwnPropertyDescriptor(target, prop) {
            const desc = Reflect.getOwnPropertyDescriptor(target, prop);
            if (!desc) console.warn(`[CHECK] Descriptor for ${name}.${String(prop)}`);
            return desc;
        }
    });
};

global.window = envSniffer('window', global);
global.navigator = envSniffer('navigator');
```

---

## 3. Prototype Chain & Type Identity

Scripts often use `Object.prototype.toString.call(obj)` to verify if an object is truly a browser element.

```javascript
// Ensure [object HTMLDivElement] instead of [object Object]
const patchToStringTag = (obj, tag) => {
    Object.defineProperty(obj, Symbol.toStringTag, {
        value: tag,
        configurable: true
    });
};

// Example: Patching a mock Canvas
const canvas = { getContext: () => ({}) };
patchToStringTag(canvas, 'HTMLCanvasElement');

// Standard Prototype Restoration
class EventTarget {}
class Node extends EventTarget {}
class Element extends Node {}
class HTMLElement extends Element {}
global.HTMLElement = HTMLElement; 
```

---

## 4. Perfect "Native Code" Emulation

Modern scripts check `fn.toString()` and `fn.prototype`. If you hook a function, you must hide the evidence.

```javascript
const makeNative = (() => {
    const fnToString = Function.prototype.toString;
    const registry = new WeakSet();

    // The Master Hook
    Function.prototype.toString = function() {
        if (registry.has(this)) {
            return `function ${this.name}() { [native code] }`;
        }
        return fnToString.call(this);
    };

    return (fn, name) => {
        if (name) Object.defineProperty(fn, 'name', { value: name });
        registry.add(fn);
        return fn;
    };
})();

// Usage:
global.setTimeout = makeNative(() => { /* custom logic */ }, 'setTimeout');
```

---

## 5. Property Descriptor Patching (Critical)

In real browsers, `navigator.userAgent` is **not** a simple property; it is a **getter** on the `Navigator.prototype`. Bots check this to detect simple object mocks.

```javascript
// ❌ BAD: navigator.userAgent = "..." (Detected)
// ✅ GOOD: Use a getter on the prototype
const patchGetter = (obj, prop, value) => {
    Object.defineProperty(obj, prop, {
        get: makeNative(() => value, `get ${prop}`),
        configurable: true,
        enumerable: true
    });
};

patchGetter(Navigator.prototype, 'userAgent', 'Mozilla/5.0...');
patchGetter(Navigator.prototype, 'webdriver', false);
```

---

## 6. Execution Sandbox (Memory Safety)

Don't run environment-sensitive code in the raw Node.js `global`. Use the `vm` module to prevent the script from detecting Node.js globals like `process` or `require`.

```javascript
const vm = require('vm');

const code = `(function() { return navigator.userAgent; })()`;
const context = {
    navigator: { userAgent: 'Chrome/120.0' },
    console: console
};

vm.createContext(context);
const result = vm.runInContext(code, context);
```

---

## 7. Troubleshooting Checklist

| Detection Method | Countermeasure |
| :--- | :--- |
| `instanceof HTMLDivElement` | Define class hierarchy (`class Element {}`, etc.) |
| `toString()` returns custom code | Use the `makeNative` hook (§4) |
| `Symbol.toStringTag` | Use `Object.defineProperty(obj, Symbol.toStringTag, ...)` |
| `Reflect.ownKeys()` | Ensure your Proxy doesn't return unexpected extra keys |
| `Stack Trace` checks | Ensure your patched functions don't add extra frames to `Error().stack` |
| `Canvas/WebGL` fingerprinting | Use `Happy-DOM` or return static "Golden" hashes for `toDataURL` |

---

## 8. Summary of the "Golden" Workflow

1.  **Initial Run**: Run with the **Advanced Proxy Sniffing** (§2) to see every property accessed.
2.  **Stubbing**: Create basic objects for `window`, `document`, `navigator`.
3.  **Refinement**: 
    *   For `instanceof` errors $\rightarrow$ Implement Classes (§3).
    *   For `toString` detection $\rightarrow$ Apply `makeNative` (§4).
    *   For Deep structural checks $\rightarrow$ Move properties to `.prototype` with getters (§5).
4.  **Verification**: Compare the output of `Object.getOwnPropertyDescriptor(navigator, 'userAgent')` in the browser vs. your environment. They must be identical.