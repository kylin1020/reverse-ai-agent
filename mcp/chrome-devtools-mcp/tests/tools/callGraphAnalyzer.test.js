/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { analyzeFunction, buildCallGraph, findSimilarFunctions, getDownstreamTrace, getUpstreamTrace, } from '../../src/utils/callGraphAnalyzer.js';
// Helper to create a FunctionInfo
function createFunctionInfo(name) {
    return {
        name,
        scriptId: 'script1',
        scriptUrl: 'test.js',
        lineNumber: 1,
        columnNumber: 0,
        params: [],
        type: 'declaration',
    };
}
// Helper to create a ParseResult
function createParseResult(functions, calls) {
    return {
        ast: null,
        functions: functions.map(createFunctionInfo),
        calls: calls.map(c => ({
            caller: c.caller,
            callee: c.callee,
            scriptId: 'script1',
            lineNumber: 1,
            columnNumber: 0,
        })),
        errors: [],
    };
}
describe('callGraphAnalyzer', () => {
    describe('buildCallGraph', () => {
        it('should build empty graph from empty results', () => {
            const graph = buildCallGraph([]);
            assert.strictEqual(graph.calls.size, 0);
            assert.strictEqual(graph.calledBy.size, 0);
            assert.strictEqual(graph.functions.size, 0);
        });
        it('should index functions from parse results', () => {
            const result = createParseResult(['foo', 'bar', 'baz'], []);
            const graph = buildCallGraph([result]);
            assert.strictEqual(graph.functions.size, 3);
            assert.ok(graph.functions.has('foo'));
            assert.ok(graph.functions.has('bar'));
            assert.ok(graph.functions.has('baz'));
        });
        it('should build calls adjacency list', () => {
            const result = createParseResult(['foo', 'bar'], [{ caller: 'foo', callee: 'bar' }]);
            const graph = buildCallGraph([result]);
            assert.ok(graph.calls.has('foo'));
            assert.ok(graph.calls.get('foo').has('bar'));
        });
        it('should build calledBy adjacency list', () => {
            const result = createParseResult(['foo', 'bar'], [{ caller: 'foo', callee: 'bar' }]);
            const graph = buildCallGraph([result]);
            assert.ok(graph.calledBy.has('bar'));
            assert.ok(graph.calledBy.get('bar').has('foo'));
        });
        it('should merge multiple parse results', () => {
            const result1 = createParseResult(['foo'], [{ caller: 'foo', callee: 'bar' }]);
            const result2 = createParseResult(['bar'], [{ caller: 'bar', callee: 'baz' }]);
            const graph = buildCallGraph([result1, result2]);
            assert.strictEqual(graph.functions.size, 2);
            assert.ok(graph.calls.get('foo').has('bar'));
            assert.ok(graph.calls.get('bar').has('baz'));
        });
        it('should handle multiple callees from same caller', () => {
            const result = createParseResult(['foo', 'bar', 'baz'], [
                { caller: 'foo', callee: 'bar' },
                { caller: 'foo', callee: 'baz' },
            ]);
            const graph = buildCallGraph([result]);
            assert.strictEqual(graph.calls.get('foo').size, 2);
            assert.ok(graph.calls.get('foo').has('bar'));
            assert.ok(graph.calls.get('foo').has('baz'));
        });
        it('should handle multiple callers to same callee', () => {
            const result = createParseResult(['foo', 'bar', 'baz'], [
                { caller: 'foo', callee: 'baz' },
                { caller: 'bar', callee: 'baz' },
            ]);
            const graph = buildCallGraph([result]);
            assert.strictEqual(graph.calledBy.get('baz').size, 2);
            assert.ok(graph.calledBy.get('baz').has('foo'));
            assert.ok(graph.calledBy.get('baz').has('bar'));
        });
    });
    describe('getUpstreamTrace', () => {
        it('should return empty trace for function with no callers', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            const trace = getUpstreamTrace(graph, 'foo', 3);
            assert.deepStrictEqual(trace, {});
        });
        it('should return direct callers at depth 1', () => {
            const result = createParseResult(['foo', 'bar'], [{ caller: 'bar', callee: 'foo' }]);
            const graph = buildCallGraph([result]);
            const trace = getUpstreamTrace(graph, 'foo', 1);
            assert.ok('bar' in trace);
            assert.strictEqual(trace['bar'], 'Leaf');
        });
        it('should trace multiple levels', () => {
            const result = createParseResult(['a', 'b', 'c'], [
                { caller: 'b', callee: 'a' },
                { caller: 'c', callee: 'b' },
            ]);
            const graph = buildCallGraph([result]);
            const trace = getUpstreamTrace(graph, 'a', 3);
            assert.ok('b' in trace);
            assert.ok(typeof trace['b'] === 'object');
            assert.ok('c' in trace['b']);
        });
        it('should respect depth limit', () => {
            const result = createParseResult(['a', 'b', 'c', 'd'], [
                { caller: 'b', callee: 'a' },
                { caller: 'c', callee: 'b' },
                { caller: 'd', callee: 'c' },
            ]);
            const graph = buildCallGraph([result]);
            const trace = getUpstreamTrace(graph, 'a', 2);
            assert.ok('b' in trace);
            const bTrace = trace['b'];
            assert.ok('c' in bTrace);
            // d should not be included due to depth limit
            assert.strictEqual(bTrace['c'], 'Leaf');
        });
        it('should handle cycles gracefully', () => {
            const result = createParseResult(['a', 'b'], [
                { caller: 'b', callee: 'a' },
                { caller: 'a', callee: 'b' },
            ]);
            const graph = buildCallGraph([result]);
            // Should not infinite loop
            const trace = getUpstreamTrace(graph, 'a', 5);
            assert.ok('b' in trace);
        });
    });
    describe('getDownstreamTrace', () => {
        it('should return empty trace for function with no callees', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            const trace = getDownstreamTrace(graph, 'foo', 3);
            assert.deepStrictEqual(trace, {});
        });
        it('should return direct callees at depth 1', () => {
            const result = createParseResult(['foo', 'bar'], [{ caller: 'foo', callee: 'bar' }]);
            const graph = buildCallGraph([result]);
            const trace = getDownstreamTrace(graph, 'foo', 1);
            assert.ok('bar' in trace);
            assert.strictEqual(trace['bar'], 'Leaf');
        });
        it('should trace multiple levels', () => {
            const result = createParseResult(['a', 'b', 'c'], [
                { caller: 'a', callee: 'b' },
                { caller: 'b', callee: 'c' },
            ]);
            const graph = buildCallGraph([result]);
            const trace = getDownstreamTrace(graph, 'a', 3);
            assert.ok('b' in trace);
            assert.ok(typeof trace['b'] === 'object');
            assert.ok('c' in trace['b']);
        });
        it('should respect depth limit', () => {
            const result = createParseResult(['a', 'b', 'c', 'd'], [
                { caller: 'a', callee: 'b' },
                { caller: 'b', callee: 'c' },
                { caller: 'c', callee: 'd' },
            ]);
            const graph = buildCallGraph([result]);
            const trace = getDownstreamTrace(graph, 'a', 2);
            assert.ok('b' in trace);
            const bTrace = trace['b'];
            assert.ok('c' in bTrace);
            // d should not be included due to depth limit
            assert.strictEqual(bTrace['c'], 'Leaf');
        });
        it('should handle cycles gracefully', () => {
            const result = createParseResult(['a', 'b'], [
                { caller: 'a', callee: 'b' },
                { caller: 'b', callee: 'a' },
            ]);
            const graph = buildCallGraph([result]);
            // Should not infinite loop
            const trace = getDownstreamTrace(graph, 'a', 5);
            assert.ok('b' in trace);
        });
    });
    describe('findSimilarFunctions', () => {
        it('should return empty array when no functions exist', () => {
            const graph = buildCallGraph([]);
            const similar = findSimilarFunctions(graph, 'foo');
            assert.deepStrictEqual(similar, []);
        });
        it('should find similar function names', () => {
            const result = createParseResult(['foo', 'fooBar', 'bar', 'baz'], []);
            const graph = buildCallGraph([result]);
            const similar = findSimilarFunctions(graph, 'foo', 3);
            // fooBar should be ranked high due to substring match
            assert.ok(similar.includes('fooBar'));
        });
        it('should not include exact match', () => {
            const result = createParseResult(['foo', 'fooBar'], []);
            const graph = buildCallGraph([result]);
            const similar = findSimilarFunctions(graph, 'foo');
            assert.ok(!similar.includes('foo'));
        });
        it('should respect limit parameter', () => {
            const result = createParseResult(['a', 'b', 'c', 'd', 'e', 'f'], []);
            const graph = buildCallGraph([result]);
            const similar = findSimilarFunctions(graph, 'x', 3);
            assert.ok(similar.length <= 3);
        });
        it('should prioritize substring matches', () => {
            const result = createParseResult(['handleClick', 'onClick', 'processData'], []);
            const graph = buildCallGraph([result]);
            const similar = findSimilarFunctions(graph, 'Click', 2);
            // Both handleClick and onClick contain 'Click'
            assert.ok(similar.some(s => s.includes('Click')));
        });
    });
    describe('analyzeFunction', () => {
        it('should return found=false for non-existent function', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            const analysis = analyzeFunction(graph, 'nonexistent', 3, 3);
            assert.strictEqual(analysis.found, false);
            assert.strictEqual(analysis.targetFunction, 'nonexistent');
        });
        it('should return similar functions when not found', () => {
            const result = createParseResult(['foo', 'fooBar', 'bar'], []);
            const graph = buildCallGraph([result]);
            const analysis = analyzeFunction(graph, 'fooBaz', 3, 3);
            assert.strictEqual(analysis.found, false);
            assert.ok(analysis.similarFunctions);
            assert.ok(analysis.similarFunctions.length > 0);
        });
        it('should return found=true for existing function', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            const analysis = analyzeFunction(graph, 'foo', 3, 3);
            assert.strictEqual(analysis.found, true);
            assert.strictEqual(analysis.targetFunction, 'foo');
        });
        it('should include function info when found', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            const analysis = analyzeFunction(graph, 'foo', 3, 3);
            assert.ok(analysis.functionInfo);
            assert.strictEqual(analysis.functionInfo.name, 'foo');
        });
        it('should include upstream and downstream traces', () => {
            const result = createParseResult(['caller', 'target', 'callee'], [
                { caller: 'caller', callee: 'target' },
                { caller: 'target', callee: 'callee' },
            ]);
            const graph = buildCallGraph([result]);
            const analysis = analyzeFunction(graph, 'target', 3, 3);
            assert.ok('caller' in analysis.upstream);
            assert.ok('callee' in analysis.downstream);
        });
        it('should use default depths when not specified', () => {
            const result = createParseResult(['foo'], []);
            const graph = buildCallGraph([result]);
            // Should not throw
            const analysis = analyzeFunction(graph, 'foo');
            assert.strictEqual(analysis.found, true);
        });
    });
});
//# sourceMappingURL=callGraphAnalyzer.test.js.map