/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { parseScript } from '../../src/utils/scriptParser.js';
describe('scriptParser', () => {
    describe('parseScript - function declarations', () => {
        it('should parse basic function declaration', () => {
            const source = `function foo() {}`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'foo');
            assert.strictEqual(result.functions[0].type, 'declaration');
            assert.strictEqual(result.functions[0].lineNumber, 1);
            assert.deepStrictEqual(result.functions[0].params, []);
        });
        it('should parse function declaration with parameters', () => {
            const source = `function add(a, b) { return a + b; }`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'add');
            assert.deepStrictEqual(result.functions[0].params, ['a', 'b']);
        });
        it('should parse multiple function declarations', () => {
            const source = `
function foo() {}
function bar() {}
function baz() {}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 3);
            assert.strictEqual(result.functions[0].name, 'foo');
            assert.strictEqual(result.functions[1].name, 'bar');
            assert.strictEqual(result.functions[2].name, 'baz');
        });
        it('should track correct line numbers', () => {
            const source = `
function first() {}

function second() {}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.functions.length, 2);
            assert.strictEqual(result.functions[0].lineNumber, 2);
            assert.strictEqual(result.functions[1].lineNumber, 4);
        });
    });
    describe('parseScript - function expressions', () => {
        it('should parse function expression assigned to variable', () => {
            const source = `const foo = function() {};`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'foo');
            assert.strictEqual(result.functions[0].type, 'expression');
        });
        it('should parse named function expression', () => {
            const source = `const foo = function bar() {};`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            // Named function expressions use their own name
            assert.strictEqual(result.functions[0].name, 'bar');
        });
        it('should parse let and var function expressions', () => {
            const source = `
let foo = function() {};
var bar = function() {};
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 2);
            assert.strictEqual(result.functions[0].name, 'foo');
            assert.strictEqual(result.functions[1].name, 'bar');
        });
    });
    describe('parseScript - arrow functions', () => {
        it('should parse arrow function assigned to variable', () => {
            const source = `const foo = () => {};`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'foo');
            assert.strictEqual(result.functions[0].type, 'arrow');
        });
        it('should parse arrow function with parameters', () => {
            const source = `const add = (a, b) => a + b;`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'add');
            assert.deepStrictEqual(result.functions[0].params, ['a', 'b']);
        });
        it('should parse arrow function with single parameter (no parens)', () => {
            const source = `const double = x => x * 2;`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 1);
            assert.strictEqual(result.functions[0].name, 'double');
            assert.deepStrictEqual(result.functions[0].params, ['x']);
        });
    });
    describe('parseScript - method definitions', () => {
        it('should parse object method shorthand', () => {
            const source = `const obj = { foo() {} };`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.ok(result.functions.some(f => f.name === 'foo'));
        });
        it('should parse object method with function value', () => {
            const source = `const obj = { foo: function() {} };`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.ok(result.functions.some(f => f.name === 'foo'));
        });
        it('should parse class methods', () => {
            const source = `
class MyClass {
  constructor() {}
  foo() {}
  bar() {}
}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.ok(result.functions.some(f => f.name === 'constructor'));
            assert.ok(result.functions.some(f => f.name === 'foo'));
            assert.ok(result.functions.some(f => f.name === 'bar'));
        });
    });
    describe('parseScript - call expressions', () => {
        it('should extract function calls', () => {
            const source = `
function foo() {
  bar();
}
function bar() {}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.calls.length, 1);
            assert.strictEqual(result.calls[0].caller, 'foo');
            assert.strictEqual(result.calls[0].callee, 'bar');
        });
        it('should track calls from global scope', () => {
            const source = `
foo();
function foo() {}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.calls.length, 1);
            assert.strictEqual(result.calls[0].caller, '<global>');
            assert.strictEqual(result.calls[0].callee, 'foo');
        });
        it('should extract method calls', () => {
            const source = `
function foo() {
  obj.bar();
}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.calls.length, 1);
            assert.strictEqual(result.calls[0].caller, 'foo');
            assert.strictEqual(result.calls[0].callee, 'bar');
        });
        it('should extract multiple calls from same function', () => {
            const source = `
function foo() {
  bar();
  baz();
  qux();
}
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.calls.length, 3);
            assert.ok(result.calls.every(c => c.caller === 'foo'));
            assert.ok(result.calls.some(c => c.callee === 'bar'));
            assert.ok(result.calls.some(c => c.callee === 'baz'));
            assert.ok(result.calls.some(c => c.callee === 'qux'));
        });
    });
    describe('parseScript - error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const source = `function foo( { broken`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].message.length > 0);
            assert.strictEqual(result.errors[0].scriptId, 'script1');
            assert.strictEqual(result.errors[0].scriptUrl, 'test.js');
        });
        it('should return empty functions and calls on parse error', () => {
            const source = `this is not valid javascript at all!!!`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 1);
            assert.strictEqual(result.functions.length, 0);
            assert.strictEqual(result.calls.length, 0);
        });
        it('should handle empty source', () => {
            const source = ``;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.functions.length, 0);
            assert.strictEqual(result.calls.length, 0);
        });
    });
    describe('parseScript - anonymous functions', () => {
        it('should assign contextual identifier to anonymous functions', () => {
            const source = `
setTimeout(function() {
  console.log('hello');
}, 1000);
`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            // Anonymous function should have a contextual identifier
            assert.ok(result.functions.some(f => f.name.includes('anonymous')));
        });
        it('should handle IIFE (Immediately Invoked Function Expression)', () => {
            const source = `(function() { console.log('iife'); })();`;
            const result = parseScript('script1', 'test.js', source);
            assert.strictEqual(result.errors.length, 0);
            assert.ok(result.functions.length >= 1);
        });
    });
});
//# sourceMappingURL=scriptParser.test.js.map