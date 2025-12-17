/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { searchInScripts, searchInScriptsWithPagination, isValidRegex, } from '../../src/tools/scriptSearcher.js';
describe('scriptSearcher', () => {
    describe('searchInScripts - text search', () => {
        it('should find substring matches in scripts', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'function foo() { return bar(); }' }],
            ]);
            const result = searchInScripts(scripts, 'foo');
            assert.strictEqual(result.totalMatches, 1);
            assert.strictEqual(result.matches[0].scriptUrl, 'test.js');
            assert.strictEqual(result.matches[0].lineNumber, 1);
            assert.strictEqual(result.matches[0].matchText, 'foo');
        });
        it('should find multiple matches in same line', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'foo foo foo' }],
            ]);
            const result = searchInScripts(scripts, 'foo');
            assert.strictEqual(result.totalMatches, 3);
            assert.strictEqual(result.matches[0].columnNumber, 0);
            assert.strictEqual(result.matches[1].columnNumber, 4);
            assert.strictEqual(result.matches[2].columnNumber, 8);
        });
        it('should find matches across multiple lines', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'line1 foo\nline2 foo\nline3' }],
            ]);
            const result = searchInScripts(scripts, 'foo');
            assert.strictEqual(result.totalMatches, 2);
            assert.strictEqual(result.matches[0].lineNumber, 1);
            assert.strictEqual(result.matches[1].lineNumber, 2);
        });
        it('should find matches across multiple scripts', () => {
            const scripts = new Map([
                ['script1', { url: 'a.js', source: 'foo' }],
                ['script2', { url: 'b.js', source: 'foo' }],
            ]);
            const result = searchInScripts(scripts, 'foo');
            assert.strictEqual(result.totalMatches, 2);
            assert.ok(result.matches.some(m => m.scriptUrl === 'a.js'));
            assert.ok(result.matches.some(m => m.scriptUrl === 'b.js'));
        });
        it('should return empty result for no matches', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'hello world' }],
            ]);
            const result = searchInScripts(scripts, 'notfound');
            assert.strictEqual(result.totalMatches, 0);
            assert.strictEqual(result.matches.length, 0);
        });
        it('should return empty result for empty pattern', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'hello world' }],
            ]);
            const result = searchInScripts(scripts, '');
            assert.strictEqual(result.totalMatches, 0);
        });
        it('should include context line in results', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'const x = foo();' }],
            ]);
            const result = searchInScripts(scripts, 'foo');
            assert.strictEqual(result.matches[0].context, 'const x = foo();');
        });
    });
    describe('searchInScripts - regex search', () => {
        it('should find regex matches', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'function foo123() {}' }],
            ]);
            const result = searchInScripts(scripts, 'foo\\d+', true);
            assert.strictEqual(result.totalMatches, 1);
            assert.strictEqual(result.matches[0].matchText, 'foo123');
            assert.strictEqual(result.isRegex, true);
        });
        it('should find multiple regex matches in same line', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'a1 b2 c3' }],
            ]);
            const result = searchInScripts(scripts, '[a-z]\\d', true);
            assert.strictEqual(result.totalMatches, 3);
        });
        it('should handle invalid regex gracefully', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'hello world' }],
            ]);
            const result = searchInScripts(scripts, '[invalid(', true);
            assert.strictEqual(result.totalMatches, 0);
            assert.strictEqual(result.isRegex, true);
        });
        it('should handle zero-length regex matches', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'abc' }],
            ]);
            // This regex matches empty string at word boundaries
            const result = searchInScripts(scripts, '^', true);
            // Should find at least one match without infinite loop
            assert.ok(result.totalMatches >= 1);
        });
    });
    describe('searchInScriptsWithPagination', () => {
        it('should paginate results', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'foo\nfoo\nfoo\nfoo\nfoo' }],
            ]);
            const result = searchInScriptsWithPagination(scripts, 'foo', false, {
                pageSize: 2,
                pageIdx: 0,
            });
            assert.strictEqual(result.totalMatches, 5);
            assert.strictEqual(result.matches.length, 2);
            assert.strictEqual(result.pagination.currentPage, 0);
            assert.strictEqual(result.pagination.totalPages, 3);
            assert.strictEqual(result.pagination.hasNextPage, true);
            assert.strictEqual(result.pagination.hasPreviousPage, false);
        });
        it('should return correct page', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'foo\nfoo\nfoo\nfoo\nfoo' }],
            ]);
            const result = searchInScriptsWithPagination(scripts, 'foo', false, {
                pageSize: 2,
                pageIdx: 1,
            });
            assert.strictEqual(result.matches.length, 2);
            assert.strictEqual(result.pagination.currentPage, 1);
            assert.strictEqual(result.pagination.hasNextPage, true);
            assert.strictEqual(result.pagination.hasPreviousPage, true);
        });
        it('should return all results without pagination options', () => {
            const scripts = new Map([
                ['script1', { url: 'test.js', source: 'foo\nfoo\nfoo' }],
            ]);
            const result = searchInScriptsWithPagination(scripts, 'foo', false);
            assert.strictEqual(result.totalMatches, 3);
            assert.strictEqual(result.matches.length, 3);
            assert.strictEqual(result.pagination.totalPages, 1);
        });
    });
    describe('isValidRegex', () => {
        it('should return true for valid regex', () => {
            assert.strictEqual(isValidRegex('foo'), true);
            assert.strictEqual(isValidRegex('foo\\d+'), true);
            assert.strictEqual(isValidRegex('^start'), true);
            assert.strictEqual(isValidRegex('end$'), true);
        });
        it('should return false for invalid regex', () => {
            assert.strictEqual(isValidRegex('[invalid('), false);
            assert.strictEqual(isValidRegex('(unclosed'), false);
            assert.strictEqual(isValidRegex('*invalid'), false);
        });
    });
});
//# sourceMappingURL=scriptSearcher.test.js.map