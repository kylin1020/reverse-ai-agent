/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function e(e,_){if(!e)return _;const r=parseInt(e,10);return Number.isNaN(r)||r<=0?_:r}function _(e,_){return e?"true"===e.toLowerCase():_}export function getConfig(){return{maxBodySize:e(process.env.MCP_MAX_BODY_SIZE,1e4),defaultPageSize:e(process.env.MCP_DEFAULT_PAGE_SIZE,20),maxSnippetLength:e(process.env.MCP_MAX_SNIPPET_LENGTH,200),maxProperties:e(process.env.MCP_MAX_PROPERTIES,20),maxInlineStringLength:e(process.env.MCP_MAX_INLINE_STRING_LENGTH,200),maxUrlLength:e(process.env.MCP_MAX_URL_LENGTH,150),debugger:{maxPropertiesPerScope:e(process.env.MCP_DEBUGGER_MAX_PROPERTIES_PER_SCOPE,10),skipScopeVariables:_(process.env.MCP_DEBUGGER_SKIP_SCOPE_VARIABLES,!1),useObjectPreviews:_(process.env.MCP_DEBUGGER_USE_OBJECT_PREVIEWS,!0),maxObjectDepth:e(process.env.MCP_DEBUGGER_MAX_OBJECT_DEPTH,1)}}}