/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it, afterEach } from 'node:test';
import { setBreakpoint, removeBreakpoint, listBreakpoints, clearAllBreakpoints, getDebuggerStatus, disableDebugger, setXhrBreakpoint, removeXhrBreakpoint, listXhrBreakpoints, } from '../../src/tools/debugger.js';
import { clearTrackedXhrBreakpoints } from '../../src/utils/debuggerUtils.js';
import { serverHooks } from '../server.js';
import { html, withMcpContext } from '../utils.js';
describe('debugger', () => {
    const server = serverHooks();
    // Clean up debugger after each test
    afterEach(async () => {
        await withMcpContext(async (response, context) => {
            await disableDebugger.handler({ params: {} }, response, context);
        });
    });
    describe('set_breakpoint', () => {
        it('should set a breakpoint and return CDP breakpoint ID', async () => {
            server.addRoute('/test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('function foo() {\n  const x = 1;\n  return x;\n}');
            });
            server.addHtmlRoute('/test-page', html `<script src="/test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/test-page'), { waitUntil: 'networkidle0' });
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*test\\.js.*',
                        lineNumber: 2,
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Breakpoint set successfully')), 'Should confirm breakpoint was set');
                assert.ok(response.responseLines.some(line => line.includes('Breakpoint ID:')), 'Should return CDP breakpoint ID');
            });
        });
        it('should set a conditional breakpoint', async () => {
            server.addRoute('/conditional.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('function check(x) {\n  return x > 5;\n}');
            });
            server.addHtmlRoute('/conditional-page', html `<script src="/conditional.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/conditional-page'), { waitUntil: 'networkidle0' });
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*conditional\\.js.*',
                        lineNumber: 2,
                        condition: 'x > 10',
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('set successfully')), 'Should confirm breakpoint was set');
                assert.ok(response.responseLines.some(line => line.includes('Condition: x > 10')), 'Should show the condition');
            });
        });
    });
    describe('list_breakpoints', () => {
        it('should list active breakpoints with CDP IDs', async () => {
            server.addRoute('/list-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('const a = 1;');
            });
            server.addHtmlRoute('/list-page', html `<script src="/list-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/list-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint first
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*list-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // List breakpoints
                await listBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('list-test')), 'Should list the added breakpoint with URL pattern');
                assert.ok(response.responseLines.some(line => line.includes('Active breakpoints')), 'Should show active breakpoints header');
            });
        });
        it('should show empty message when no breakpoints', async () => {
            await withMcpContext(async (response, context) => {
                await listBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('No active breakpoints')), 'Should show no breakpoints message');
            });
        });
    });
    describe('remove_breakpoint', () => {
        it('should remove a breakpoint by CDP ID', async () => {
            server.addRoute('/remove-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('const b = 2;');
            });
            server.addHtmlRoute('/remove-page', html `<script src="/remove-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/remove-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*remove-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                // Extract the CDP breakpoint ID from the response
                const idLine = response.responseLines.find(line => line.includes('Breakpoint ID:'));
                assert.ok(idLine, 'Should have breakpoint ID in response');
                const cdpBreakpointId = idLine.split('Breakpoint ID:')[1].trim();
                response.resetResponseLineForTesting();
                // Remove the breakpoint using CDP ID
                await removeBreakpoint.handler({ params: { breakpointId: cdpBreakpointId } }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Removed breakpoint')), 'Should confirm breakpoint was removed');
                response.resetResponseLineForTesting();
                // Verify it's gone
                await listBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('No active breakpoints')), 'Should show no breakpoints');
            });
        });
        it('should warn when removing non-existent breakpoint', async () => {
            await withMcpContext(async (response, context) => {
                await removeBreakpoint.handler({ params: { breakpointId: 'non-existent-bp' } }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('not found') || line.includes('removed')), 'Should warn about non-existent breakpoint');
            });
        });
    });
    describe('clear_all_breakpoints', () => {
        it('should clear all breakpoints', async () => {
            server.addRoute('/clear-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('const c = 3;\nconst d = 4;');
            });
            server.addHtmlRoute('/clear-page', html `<script src="/clear-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/clear-page'), { waitUntil: 'networkidle0' });
                // Set multiple breakpoints (no longer need custom IDs)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*clear-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*clear-test\\.js.*',
                        lineNumber: 2,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Clear all breakpoints
                await clearAllBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Cleared') && line.includes('breakpoint')), 'Should confirm breakpoints were cleared');
                response.resetResponseLineForTesting();
                // Verify they're gone
                await listBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('No active breakpoints')), 'Should show no breakpoints');
            });
        });
    });
    describe('get_debugger_status', () => {
        it('should show debugger status', async () => {
            await withMcpContext(async (response, context) => {
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Debugger Status')), 'Should show debugger status header');
                assert.ok(response.responseLines.some(line => line.includes('Enabled:')), 'Should show enabled status');
                assert.ok(response.responseLines.some(line => line.includes('Paused:')), 'Should show paused status');
            });
        });
    });
    describe('disable_debugger', () => {
        it('should disable the debugger', async () => {
            server.addRoute('/disable-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('const e = 5;');
            });
            server.addHtmlRoute('/disable-page', html `<script src="/disable-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/disable-page'), { waitUntil: 'networkidle0' });
                // First enable by setting a breakpoint (no longer need custom ID)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*disable-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Disable the debugger
                await disableDebugger.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Debugger disabled')), 'Should confirm debugger was disabled');
            });
        });
        it('should handle disabling already disabled debugger', async () => {
            await withMcpContext(async (response, context) => {
                await disableDebugger.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('already disabled')), 'Should indicate debugger is already disabled');
            });
        });
        it('should remain disabled after page refresh', async () => {
            server.addRoute('/disable-persist-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end('const x = 1;');
            });
            server.addHtmlRoute('/disable-persist-page', html `<script src="/disable-persist-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/disable-persist-page'), { waitUntil: 'networkidle0' });
                // First enable by setting a breakpoint
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*disable-persist-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Disable the debugger
                await disableDebugger.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Debugger disabled')), 'Should confirm debugger was disabled');
                // Refresh the page
                await page.reload({ waitUntil: 'networkidle0' });
                // Wait a bit for any async operations
                await new Promise(resolve => setTimeout(resolve, 100));
                response.resetResponseLineForTesting();
                // Try to disable again - should still be disabled
                await disableDebugger.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('already disabled')), 'Debugger should remain disabled after page refresh');
            });
        });
    });
    describe('set_xhr_breakpoint', () => {
        afterEach(async () => {
            // Clean up XHR breakpoints after each test
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                clearTrackedXhrBreakpoints(page);
            });
        });
        it('should set an XHR breakpoint with URL pattern', async () => {
            await withMcpContext(async (response, context) => {
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/users',
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('XHR breakpoint set successfully')), 'Should confirm XHR breakpoint was set');
                assert.ok(response.responseLines.some(line => line.includes('api/users')), 'Should show the URL pattern');
            });
        });
        it('should set an XHR breakpoint with empty string pattern (all requests)', async () => {
            await withMcpContext(async (response, context) => {
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: '',
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('XHR breakpoint set successfully')), 'Should confirm XHR breakpoint was set');
                assert.ok(response.responseLines.some(line => line.includes('all requests')), 'Should indicate breakpoint applies to all requests');
            });
        });
    });
    describe('remove_xhr_breakpoint', () => {
        afterEach(async () => {
            // Clean up XHR breakpoints after each test
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                clearTrackedXhrBreakpoints(page);
            });
        });
        it('should remove an XHR breakpoint by URL pattern', async () => {
            await withMcpContext(async (response, context) => {
                // First set a breakpoint
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/data',
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Remove the breakpoint
                await removeXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/data',
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Removed XHR breakpoint')), 'Should confirm XHR breakpoint was removed');
                assert.ok(response.responseLines.some(line => line.includes('api/data')), 'Should show the removed URL pattern');
            });
        });
        it('should handle removing non-existent XHR breakpoint gracefully', async () => {
            await withMcpContext(async (response, context) => {
                // Try to remove a breakpoint that was never set
                await removeXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'non-existent-pattern',
                    },
                }, response, context);
                // Should either succeed (CDP doesn't error) or show a warning
                const hasRemoved = response.responseLines.some(line => line.includes('Removed'));
                const hasWarning = response.responseLines.some(line => line.includes('not found') || line.includes('not in our tracking'));
                assert.ok(hasRemoved || hasWarning, 'Should either confirm removal or show warning for non-existent breakpoint');
            });
        });
        it('should remove all XHR breakpoints when no pattern specified', async () => {
            await withMcpContext(async (response, context) => {
                // Set multiple breakpoints
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/users',
                    },
                }, response, context);
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/posts',
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Remove all breakpoints
                await removeXhrBreakpoint.handler({
                    params: {},
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Cleared') && line.includes('XHR breakpoint')), 'Should confirm all XHR breakpoints were cleared');
            });
        });
        it('should show message when no XHR breakpoints to remove', async () => {
            await withMcpContext(async (response, context) => {
                // Try to remove all when none exist
                await removeXhrBreakpoint.handler({
                    params: {},
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('No XHR breakpoints to remove')), 'Should indicate no breakpoints to remove');
            });
        });
    });
    describe('list_xhr_breakpoints', () => {
        afterEach(async () => {
            // Clean up XHR breakpoints after each test
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                clearTrackedXhrBreakpoints(page);
            });
        });
        it('should list active XHR breakpoints', async () => {
            await withMcpContext(async (response, context) => {
                // Set some breakpoints
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/users',
                    },
                }, response, context);
                await setXhrBreakpoint.handler({
                    params: {
                        urlPattern: 'api/posts',
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // List breakpoints
                await listXhrBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Active XHR breakpoints')), 'Should show active breakpoints header');
                assert.ok(response.responseLines.some(line => line.includes('api/users')), 'Should list first breakpoint pattern');
                assert.ok(response.responseLines.some(line => line.includes('api/posts')), 'Should list second breakpoint pattern');
            });
        });
        it('should show empty message when no XHR breakpoints', async () => {
            await withMcpContext(async (response, context) => {
                await listXhrBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('No active XHR breakpoints')), 'Should show no breakpoints message');
            });
        });
    });
});
//# sourceMappingURL=debugger.test.js.map