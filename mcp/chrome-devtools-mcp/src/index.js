#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{version as o}from"node:process";const[e,r]=o.substring(1).split(".").map(Number);20===e&&r<19&&(console.error(`ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 20.19.0 LTS or a newer LTS.`),process.exit(1)),22===e&&r<12&&(console.error(`ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 22.12.0 LTS or a newer LTS.`),process.exit(1)),e<20&&(console.error(`ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 20.19.0 LTS or a newer LTS.`),process.exit(1)),await import("./main.js");