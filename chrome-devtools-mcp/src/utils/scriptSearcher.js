/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{paginate as e}from"./pagination.js";import{searchInScriptsWithRg as t}from"./rgSearcher.js";export{searchInScriptsWithRg}from"./rgSearcher.js";export async function searchInScriptsWithRgPaginated(a,r,s=!1,i,n=!1,g){const o=await t(a,r,s,i,n),c=e(o.matches,g);return{pattern:o.pattern,isRegex:o.isRegex,totalMatches:o.totalMatches,matches:[...c.items],pagination:{currentPage:c.currentPage,totalPages:c.totalPages,hasNextPage:c.hasNextPage,hasPreviousPage:c.hasPreviousPage}}}export function isValidRegex(e){try{return new RegExp(e),!0}catch{return!1}}