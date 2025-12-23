/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { formatSnapshotNode, formatSnapshotWithOptions, } from '../../src/formatters/snapshotFormatter.js';
describe('snapshotFormatter', () => {
    it('formats a snapshot with value properties', () => {
        const node = {
            id: '1_1',
            role: 'textbox',
            name: 'textbox',
            value: 'value',
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node);
        assert.strictEqual(formatted, `uid=1_1 textbox "textbox" value="value"
  uid=1_2 statictext "text"
`);
    });
    it('formats a snapshot with boolean properties', () => {
        const node = {
            id: '1_1',
            role: 'button',
            name: 'button',
            disabled: true,
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node);
        assert.strictEqual(formatted, `uid=1_1 button "button" disableable disabled
  uid=1_2 statictext "text"
`);
    });
    it('formats a snapshot with checked properties', () => {
        const node = {
            id: '1_1',
            role: 'checkbox',
            name: 'checkbox',
            checked: true,
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node);
        assert.strictEqual(formatted, `uid=1_1 checkbox "checkbox" checked
  uid=1_2 statictext "text"
`);
    });
    it('formats a snapshot with multiple different type attributes', () => {
        const node = {
            id: '1_1',
            role: 'root',
            name: 'root',
            children: [
                {
                    id: '1_2',
                    role: 'button',
                    name: 'button',
                    focused: true,
                    disabled: true,
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
                {
                    id: '1_3',
                    role: 'textbox',
                    name: 'textbox',
                    value: 'value',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node);
        assert.strictEqual(formatted, `uid=1_1 root "root"
  uid=1_2 button "button" disableable disabled focusable focused
  uid=1_3 textbox "textbox" value="value"
`);
    });
    it('formats with DevTools data not included into a snapshot', t => {
        const node = {
            id: '1_1',
            role: 'checkbox',
            name: 'checkbox',
            checked: true,
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node, {
            snapshotId: '1',
            root: node,
            idToNode: new Map(),
            hasSelectedElement: true,
            verbose: false,
        });
        t.assert.snapshot?.(formatted);
    });
    it('does not include a note if the snapshot is already verbose', t => {
        const node = {
            id: '1_1',
            role: 'checkbox',
            name: 'checkbox',
            checked: true,
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node, {
            snapshotId: '1',
            root: node,
            idToNode: new Map(),
            hasSelectedElement: true,
            verbose: true,
        });
        t.assert.snapshot?.(formatted);
    });
    it('formats with DevTools data included into a snapshot', t => {
        const node = {
            id: '1_1',
            role: 'checkbox',
            name: 'checkbox',
            checked: true,
            children: [
                {
                    id: '1_2',
                    role: 'statictext',
                    name: 'text',
                    children: [],
                    elementHandle: async () => {
                        return null;
                    },
                },
            ],
            elementHandle: async () => {
                return null;
            },
        };
        const formatted = formatSnapshotNode(node, {
            snapshotId: '1',
            root: node,
            idToNode: new Map(),
            hasSelectedElement: true,
            selectedElementUid: '1_1',
            verbose: false,
        });
        t.assert.snapshot?.(formatted);
    });
});
describe('formatSnapshotWithOptions', () => {
    const createTestNode = () => ({
        id: '1_0',
        role: 'root',
        name: 'Page',
        children: [
            {
                id: '1_1',
                role: 'heading',
                name: 'Welcome Title',
                children: [],
                elementHandle: async () => null,
            },
            {
                id: '1_2',
                role: 'button',
                name: 'Submit Form',
                children: [],
                elementHandle: async () => null,
            },
            {
                id: '1_3',
                role: 'textbox',
                name: 'Email Input',
                value: 'test@example.com',
                children: [],
                elementHandle: async () => null,
            },
            {
                id: '1_4',
                role: 'link',
                name: 'Learn More',
                children: [],
                elementHandle: async () => null,
            },
            {
                id: '1_5',
                role: 'statictext',
                name: 'Footer Text',
                children: [],
                elementHandle: async () => null,
            },
        ],
        elementHandle: async () => null,
    });
    it('returns all elements without options', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node);
        assert.strictEqual(result.totalElements, 6);
        assert.strictEqual(result.matchedElements, 6);
        assert.strictEqual(result.totalPages, 1);
        assert.strictEqual(result.currentPage, 0);
        assert.strictEqual(result.hasNextPage, false);
        assert.strictEqual(result.hasPreviousPage, false);
    });
    it('filters elements by search term (case-insensitive)', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            search: 'button',
        });
        assert.strictEqual(result.totalElements, 6);
        assert.strictEqual(result.matchedElements, 1);
        assert.ok(result.content.includes('Submit Form'));
        assert.ok(!result.content.includes('Welcome Title'));
    });
    it('filters by partial match in element name', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            search: 'Form',
        });
        assert.strictEqual(result.matchedElements, 1);
        assert.ok(result.content.includes('Submit Form'));
    });
    it('filters by element value', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            search: 'test@example.com',
        });
        assert.strictEqual(result.matchedElements, 1);
        assert.ok(result.content.includes('Email Input'));
    });
    it('paginates results correctly', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            pagination: { pageSize: 2, pageIdx: 0 },
        });
        assert.strictEqual(result.totalElements, 6);
        assert.strictEqual(result.matchedElements, 6);
        assert.strictEqual(result.totalPages, 3);
        assert.strictEqual(result.currentPage, 0);
        assert.strictEqual(result.hasNextPage, true);
        assert.strictEqual(result.hasPreviousPage, false);
    });
    it('returns correct page with pageIdx', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            pagination: { pageSize: 2, pageIdx: 1 },
        });
        assert.strictEqual(result.currentPage, 1);
        assert.strictEqual(result.hasNextPage, true);
        assert.strictEqual(result.hasPreviousPage, true);
    });
    it('combines search and pagination', () => {
        const node = createTestNode();
        // Search for elements containing 't' (root, Title, button, textbox, Footer Text)
        const result = formatSnapshotWithOptions(node, undefined, {
            search: 'text',
            pagination: { pageSize: 2, pageIdx: 0 },
        });
        // Should find statictext and textbox
        assert.ok(result.matchedElements >= 1);
        assert.ok(result.totalPages >= 1);
    });
    it('returns empty content when search has no matches', () => {
        const node = createTestNode();
        const result = formatSnapshotWithOptions(node, undefined, {
            search: 'nonexistent',
        });
        assert.strictEqual(result.matchedElements, 0);
        assert.strictEqual(result.content, '');
    });
});
//# sourceMappingURL=snapshotFormatter.test.js.map