/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import o from"node:fs";import{debug as e}from"./third_party/index.js";const r="mcp:log",n=[r,...process.env.DEBUG?[process.env.DEBUG]:[]];export function saveLogsToFile(r){e.enable(n.join(","));const t=o.createWriteStream(r,{flags:"a+"});return e.log=function(...o){t.write(`${o.join(" ")}\n`)},t.on("error",function(o){console.error(`Error when opening/writing to log file: ${o.message}`),t.end(),process.exit(1)}),t}export const logger=e(r);