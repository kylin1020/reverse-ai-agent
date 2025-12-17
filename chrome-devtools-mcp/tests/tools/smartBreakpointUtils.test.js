/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import * as fc from 'fast-check';
import { findNearestBreakpointLocation, } from '../../src/tools/smartBreakpointUtils.js';
describe('smartBreakpointUtils', () => {
    describe('findNearestBreakpointLocation', () => {
        it('should return null for empty list', () => {
            const result = findNearestBreakpointLocation([], 10);
            assert.strictEqual(result, null);
        });
        it('should return the only location for single-element list', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 5 },
            ];
            const result = findNearestBreakpointLocation(locations, 10);
            assert.deepStrictEqual(result, locations[0]);
        });
        it('should return exact match when target equals a location', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 5 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 10 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 15 },
            ];
            const result = findNearestBreakpointLocation(locations, 10);
            assert.strictEqual(result?.columnNumber, 10);
        });
        it('should return nearest location when target is between locations', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 5 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 15 },
            ];
            // Target 8 is closer to 5 (distance 3) than to 15 (distance 7)
            const result = findNearestBreakpointLocation(locations, 8);
            assert.strictEqual(result?.columnNumber, 5);
        });
        it('should prefer smaller column when equidistant', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 5 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 15 },
            ];
            // Target 10 is equidistant from 5 and 15 (both distance 5)
            // Should prefer smaller column (5)
            const result = findNearestBreakpointLocation(locations, 10);
            assert.strictEqual(result?.columnNumber, 5);
        });
        it('should handle target before all locations', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 10 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 20 },
            ];
            const result = findNearestBreakpointLocation(locations, 0);
            assert.strictEqual(result?.columnNumber, 10);
        });
        it('should handle target after all locations', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 10 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 20 },
            ];
            const result = findNearestBreakpointLocation(locations, 100);
            assert.strictEqual(result?.columnNumber, 20);
        });
        it('should handle unsorted locations', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 20 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 5 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 15 },
            ];
            // Target 12 is closer to 15 (distance 3) than to 5 (distance 7) or 20 (distance 8)
            const result = findNearestBreakpointLocation(locations, 12);
            assert.strictEqual(result?.columnNumber, 15);
        });
        it('should handle multiple equidistant locations and prefer smallest', () => {
            const locations = [
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 20 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 0 },
                { scriptId: '1', scriptUrl: 'test.js', lineNumber: 1, columnNumber: 10 },
            ];
            // Target 10 is equidistant from 0 and 20 (both distance 10), exact match with 10
            const result = findNearestBreakpointLocation(locations, 10);
            assert.strictEqual(result?.columnNumber, 10);
        });
        /**
         * **Feature: smart-breakpoint, Property 1: Nearest position snapping**
         * **Validates: Requirements 1.2, 3.1**
         *
         * For any target column and non-empty list of valid breakpoint locations,
         * the snapping algorithm SHALL return the location with the minimum absolute
         * distance to the target column. If two locations are equidistant, the
         * algorithm SHALL return the one with the smaller column number.
         */
        it('Property 1: should always return the nearest location to target column', () => {
            // Generator for a non-empty array of breakpoint locations with unique column numbers
            const breakpointLocationArb = fc.record({
                scriptId: fc.constant('1'),
                scriptUrl: fc.constant('test.js'),
                lineNumber: fc.constant(1),
                columnNumber: fc.nat({ max: 10000 }),
            });
            const nonEmptyLocationsArb = fc
                .array(breakpointLocationArb, { minLength: 1, maxLength: 50 })
                .map(locations => {
                // Ensure unique column numbers by using a Set
                const seen = new Set();
                return locations.filter(loc => {
                    if (seen.has(loc.columnNumber)) {
                        return false;
                    }
                    seen.add(loc.columnNumber);
                    return true;
                });
            })
                .filter(locations => locations.length > 0);
            const targetColumnArb = fc.nat({ max: 10000 });
            fc.assert(fc.property(nonEmptyLocationsArb, targetColumnArb, (locations, targetColumn) => {
                const result = findNearestBreakpointLocation(locations, targetColumn);
                // Result should never be null for non-empty list
                assert.notStrictEqual(result, null);
                // Calculate the distance of the result
                const resultDistance = Math.abs(result.columnNumber - targetColumn);
                // Verify no other location is closer
                for (const loc of locations) {
                    const locDistance = Math.abs(loc.columnNumber - targetColumn);
                    if (locDistance < resultDistance) {
                        // Found a closer location - this should never happen
                        assert.fail(`Found closer location: column ${loc.columnNumber} (distance ${locDistance}) ` +
                            `vs result column ${result.columnNumber} (distance ${resultDistance})`);
                    }
                    // If equidistant, result should have smaller or equal column number
                    if (locDistance === resultDistance &&
                        loc.columnNumber < result.columnNumber) {
                        assert.fail(`Found equidistant location with smaller column: ${loc.columnNumber} ` +
                            `vs result ${result.columnNumber}`);
                    }
                }
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=smartBreakpointUtils.test.js.map