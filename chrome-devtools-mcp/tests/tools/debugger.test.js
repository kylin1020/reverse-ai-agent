/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it, afterEach } from 'node:test';
import { setBreakpoint, removeBreakpoint, listBreakpoints, clearAllBreakpoints, getDebuggerStatus, pauseOnExceptions, disableDebugger, } from '../../src/tools/debugger.js';
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
        it('should set a breakpoint', async () => {
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
                        breakpointId: 'test-bp-1',
                        urlRegex: '.*test\\.js.*',
                        lineNumber: 2,
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Breakpoint') && line.includes('set successfully')), 'Should confirm breakpoint was set');
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
                        breakpointId: 'conditional-bp',
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
        it('should list active breakpoints', async () => {
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
                        breakpointId: 'list-test-bp',
                        urlRegex: '.*list-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // List breakpoints
                await listBreakpoints.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('list-test-bp')), 'Should list the added breakpoint');
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
        it('should remove a breakpoint', async () => {
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
                        breakpointId: 'remove-test-bp',
                        urlRegex: '.*remove-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Remove the breakpoint
                await removeBreakpoint.handler({ params: { breakpointId: 'remove-test-bp' } }, response, context);
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
                assert.ok(response.responseLines.some(line => line.includes('not found')), 'Should warn about non-existent breakpoint');
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
                // Set multiple breakpoints
                await setBreakpoint.handler({
                    params: {
                        breakpointId: 'clear-bp-1',
                        urlRegex: '.*clear-test\\.js.*',
                        lineNumber: 1,
                    },
                }, response, context);
                await setBreakpoint.handler({
                    params: {
                        breakpointId: 'clear-bp-2',
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
    describe('pause_on_exceptions', () => {
        it('should set pause on exceptions to all', async () => {
            await withMcpContext(async (response, context) => {
                await pauseOnExceptions.handler({ params: { state: 'all' } }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Exception pausing set to: all')), 'Should confirm exception pausing was set');
            });
        });
        it('should set pause on exceptions to uncaught', async () => {
            await withMcpContext(async (response, context) => {
                await pauseOnExceptions.handler({ params: { state: 'uncaught' } }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Exception pausing set to: uncaught')), 'Should confirm exception pausing was set');
            });
        });
        it('should set pause on exceptions to none', async () => {
            await withMcpContext(async (response, context) => {
                await pauseOnExceptions.handler({ params: { state: 'none' } }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Exception pausing set to: none')), 'Should confirm exception pausing was set');
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
                // First enable by setting a breakpoint
                await setBreakpoint.handler({
                    params: {
                        breakpointId: 'disable-test-bp',
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
    });
});
//# sourceMappingURL=debugger.test.js.map