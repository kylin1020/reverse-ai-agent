/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { getNetworkRequest, listNetworkRequests, saveNetworkRequest, searchNetworkRequests, } from '../../src/tools/network.js';
import { serverHooks } from '../server.js';
import { getTextContent, html, stabilizeResponseOutput, withMcpContext, } from '../utils.js';
describe('network', () => {
    const server = serverHooks();
    describe('network_list_requests', () => {
        it('list requests', async () => {
            await withMcpContext(async (response, context) => {
                await listNetworkRequests.handler({ params: {} }, response, context);
                assert.ok(response.includeNetworkRequests);
                assert.strictEqual(response.networkRequestsPageIdx, undefined);
            });
        });
        it('list requests form current navigations only', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await listNetworkRequests.handler({
                    params: {},
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
        it('list requests from previous navigations', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await listNetworkRequests.handler({
                    params: {
                        includePreservedRequests: true,
                    },
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
        it('list requests from previous navigations from redirects', async (t) => {
            server.addRoute('/redirect', async (_req, res) => {
                res.writeHead(302, {
                    Location: server.getRoute('/redirected'),
                });
                res.end();
            });
            server.addHtmlRoute('/redirected', html `<script>
          document.location.href = '/redirected-page';
        </script>`);
            server.addHtmlRoute('/redirected-page', html `<main>I was redirected 2 times</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/redirect'));
                await listNetworkRequests.handler({
                    params: {
                        includePreservedRequests: true,
                    },
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
    });
    describe('network_get_request', () => {
        it('attaches request', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto('data:text/html,<div>Hello MCP</div>');
                await getNetworkRequest.handler({ params: { reqid: 1 } }, response, context);
                assert.equal(response.attachedNetworkRequestId, 1);
            });
        });
        it('should not add the request list', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto('data:text/html,<div>Hello MCP</div>');
                await getNetworkRequest.handler({ params: { reqid: 1 } }, response, context);
                assert(!response.includeNetworkRequests);
            });
        });
        it('should get request from previous navigations', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await getNetworkRequest.handler({
                    params: {
                        reqid: 1,
                    },
                }, response, context);
                const responseData = await response.handle('get_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
    });
    describe('network_save_request', () => {
        it('saves a request+response as raw HTTP text', async () => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-devtools-mcp-test-'));
                const filePath = path.join(dir, 'request.http');
                await saveNetworkRequest.handler({ params: { reqid: 1, filePath } }, response, context);
                const saved = await fs.readFile(filePath, 'utf-8');
                assert.match(saved, /^GET \/one HTTP\/1\.1\r\n/m);
                assert.match(saved, /\r\nhost: localhost:\d+\r\n/m);
                assert.match(saved, /\r\nHTTP\/1\.1 200/m);
            });
        });
        it('saves binary response bodies to a separate file', async () => {
            server.addRoute('/bin', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'image/jpeg');
                // Minimal JPEG header bytes; not valid UTF-8.
                res.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/bin'));
                const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-devtools-mcp-test-'));
                const filePath = path.join(dir, 'request.http');
                const bodyPath = path.join(dir, 'response-body.jpg');
                await saveNetworkRequest.handler({ params: { reqid: 1, filePath, responseBodyFilePath: bodyPath } }, response, context);
                const saved = await fs.readFile(filePath, 'utf-8');
                assert.match(saved, /<binary response body saved to: .*response-body\.jpg>/);
                const body = await fs.readFile(bodyPath);
                assert.equal(body[0], 0xff);
                assert.equal(body[1], 0xd8);
            });
        });
    });
    describe('search_network_requests', () => {
        it('filters by URL pattern', async (t) => {
            server.addHtmlRoute('/page', html `<main>Page</main>`);
            server.addRoute('/api/users', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ users: [] }));
            });
            server.addRoute('/api/posts', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ posts: [] }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/page'));
                await page.evaluate(() => {
                    fetch('/api/users');
                    fetch('/api/posts');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { urlPattern: '/api/users' } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/api\/users/);
                assert.doesNotMatch(textContent, /\/api\/posts/);
            });
        });
        it('filters by HTTP method', async () => {
            server.addHtmlRoute('/method-test', html `<main>Method Test</main>`);
            server.addRoute('/api/data', async (req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ method: req.method }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/method-test'));
                await page.evaluate(() => {
                    fetch('/api/data', { method: 'GET' });
                    fetch('/api/data', { method: 'POST', body: '{}' });
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { method: 'POST' } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                // Should only show POST requests
                assert.match(textContent, /POST.*\/api\/data/);
            });
        });
        it('filters by exact status code', async () => {
            server.addHtmlRoute('/status-test', html `<main>Status Test</main>`);
            server.addRoute('/ok', async (_req, res) => {
                res.statusCode = 200;
                res.end('OK');
            });
            server.addRoute('/not-found', async (_req, res) => {
                res.statusCode = 404;
                res.end('Not Found');
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/status-test'));
                await page.evaluate(() => {
                    fetch('/ok');
                    fetch('/not-found');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { statusCode: 404 } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/not-found.*404/);
                assert.doesNotMatch(textContent, /\/ok.*200/);
            });
        });
        it('filters by status code range (statusCodeMin and statusCodeMax)', async () => {
            server.addHtmlRoute('/range-test', html `<main>Range Test</main>`);
            server.addRoute('/success', async (_req, res) => {
                res.statusCode = 200;
                res.end('OK');
            });
            server.addRoute('/redirect', async (_req, res) => {
                res.statusCode = 301;
                res.setHeader('Location', '/success');
                res.end();
            });
            server.addRoute('/error', async (_req, res) => {
                res.statusCode = 500;
                res.end('Error');
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/range-test'));
                await page.evaluate(() => {
                    fetch('/success');
                    fetch('/redirect', { redirect: 'manual' });
                    fetch('/error');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                // Filter for 4xx and 5xx errors (400-599)
                await searchNetworkRequests.handler({ params: { statusCodeMin: 400, statusCodeMax: 599 } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/error.*500/);
                assert.doesNotMatch(textContent, /\/success.*200/);
            });
        });
        it('filters by content type', async () => {
            server.addHtmlRoute('/content-type-test', html `<main>Content Type Test</main>`);
            server.addRoute('/json-data', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ data: 'test' }));
            });
            server.addRoute('/text-data', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('plain text');
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/content-type-test'));
                await page.evaluate(() => {
                    fetch('/json-data');
                    fetch('/text-data');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { contentType: 'json' } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/json-data/);
                assert.doesNotMatch(textContent, /\/text-data/);
            });
        });
        it('filters by resource types', async () => {
            server.addHtmlRoute('/resource-type-test', html `<script src="/script.js"></script>
          <link rel="stylesheet" href="/style.css" />`);
            server.addRoute('/script.js', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/javascript');
                res.end('console.log("test");');
            });
            server.addRoute('/style.css', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/css');
                res.end('body { color: red; }');
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/resource-type-test'));
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { resourceTypes: ['script'] } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/script\.js/);
                assert.doesNotMatch(textContent, /\/style\.css/);
            });
        });
        it('searches content in URL, headers, and body', async () => {
            server.addHtmlRoute('/search-test', html `<main>Search Test</main>`);
            server.addRoute('/api/search-keyword', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Custom-Header', 'search-keyword-value');
                res.end(JSON.stringify({ message: 'contains search-keyword here' }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/search-test'));
                await page.evaluate(() => {
                    fetch('/api/search-keyword');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                await searchNetworkRequests.handler({ params: { searchContent: 'search-keyword' } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /Search results for "search-keyword"/);
                assert.match(textContent, /\*\*search-keyword\*\*/); // highlighted match
            });
        });
        it('searches with combined filters', async () => {
            server.addHtmlRoute('/combined-test', html `<main>Combined Test</main>`);
            server.addRoute('/api/v1/data', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ version: 1 }));
            });
            server.addRoute('/api/v2/data', async (_req, res) => {
                res.statusCode = 201;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ version: 2 }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/combined-test'));
                await page.evaluate(() => {
                    fetch('/api/v1/data');
                    fetch('/api/v2/data');
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                // Combine URL pattern with status code filter
                await searchNetworkRequests.handler({ params: { urlPattern: '/api/', statusCode: 201 } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                assert.match(textContent, /\/api\/v2\/data.*201/);
                assert.doesNotMatch(textContent, /\/api\/v1\/data.*200/);
            });
        });
        it('includes preserved requests when specified', async () => {
            server.addHtmlRoute('/nav1', html `<main>Nav 1</main>`);
            server.addHtmlRoute('/nav2', html `<main>Nav 2</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/nav1'));
                await page.goto(server.getRoute('/nav2'));
                await searchNetworkRequests.handler({ params: { urlPattern: '/nav1', includePreservedRequests: true } }, response, context);
                const responseData = await response.handle('search_network_requests', context);
                const textContent = getTextContent(responseData[0]);
                // Should find nav1 from preserved requests
                assert.match(textContent, /\/nav1/);
            });
        });
    });
    describe('get_network_request includes initiator', () => {
        it('returns initiator info for script-initiated requests', async () => {
            server.addHtmlRoute('/fetch-page', html `<script>
          async function makeRequest() {
            await fetch('/api/data');
          }
          makeRequest();
        </script>`);
            server.addRoute('/api/data', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/fetch-page'));
                // Wait for the fetch request to complete
                await new Promise(resolve => setTimeout(resolve, 500));
                // Find the fetch request (should be reqid 2 after the page load)
                const requests = context.getNetworkRequests();
                const fetchRequest = requests.find(r => r.url().includes('/api/data'));
                assert.ok(fetchRequest, 'Fetch request should exist');
                const reqid = context.getNetworkRequestStableId(fetchRequest);
                await getNetworkRequest.handler({ params: { reqid } }, response, context);
                const responseData = await response.handle('get_network_request', context);
                const textContent = getTextContent(responseData[0]);
                // Should contain initiator information in the response
                assert.match(textContent, /### Initiator/);
                assert.match(textContent, /Type: script/);
            });
        });
        it('returns parser initiator for HTML-initiated requests', async () => {
            server.addHtmlRoute('/img-page', html `<img src="/test-image.png" />`);
            server.addRoute('/test-image.png', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'image/png');
                res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/img-page'));
                // Wait for the image request to complete
                await new Promise(resolve => setTimeout(resolve, 500));
                const requests = context.getNetworkRequests();
                const imgRequest = requests.find(r => r.url().includes('/test-image.png'));
                assert.ok(imgRequest, 'Image request should exist');
                const reqid = context.getNetworkRequestStableId(imgRequest);
                await getNetworkRequest.handler({ params: { reqid } }, response, context);
                const responseData = await response.handle('get_network_request', context);
                const textContent = getTextContent(responseData[0]);
                // Should contain initiator information with parser type
                assert.match(textContent, /### Initiator/);
                assert.match(textContent, /Type: parser/);
            });
        });
    });
});
//# sourceMappingURL=network.test.js.map