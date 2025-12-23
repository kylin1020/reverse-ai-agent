/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import*as s from"node:fs";import*as e from"node:path";const t=e.join(import.meta.dirname,"third_party/issue-descriptions");let i={};export async function loadIssueDescriptions(){if(Object.keys(i).length>0)return;const o=await s.promises.readdir(t),n={};for(const i of o){if(!i.endsWith(".md"))continue;const o=await s.promises.readFile(e.join(t,i),"utf-8");n[i]=o}i=n}export function getIssueDescription(s){return i[s]??null}export const ISSUE_UTILS={loadIssueDescriptions:loadIssueDescriptions,getIssueDescription:getIssueDescription};