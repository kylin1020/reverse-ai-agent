/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{getConfig as e}from"./config.js";export function paginate(a,t){const n=a.length;if(!t||function(e){return void 0===e.pageSize&&void 0===e.pageIdx}(t))return{items:a,currentPage:0,totalPages:1,hasNextPage:!1,hasPreviousPage:!1,startIndex:0,endIndex:n,invalidPage:!1};const i=t.pageSize??e().defaultPageSize,r=Math.max(1,Math.ceil(n/i)),{currentPage:g,invalidPage:P}=function(e,a){if(void 0===e)return{currentPage:0,invalidPage:!1};if(e<0||e>=a)return{currentPage:0,invalidPage:!0};return{currentPage:e,invalidPage:!1}}(t.pageIdx,r),d=g*i,u=a.slice(d,d+i);return{items:u,currentPage:g,totalPages:r,hasNextPage:g<r-1,hasPreviousPage:g>0,startIndex:d,endIndex:d+u.length,invalidPage:P}}