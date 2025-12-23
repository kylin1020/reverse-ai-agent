/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { isValidRegex } from '../../src/utils/scriptSearcher.js';
describe('scriptSearcher', () => {
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