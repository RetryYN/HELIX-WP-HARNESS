import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),request=(path,query="")=>routeResearchApi(path,new URL(`http://localhost${path}${query}`),data,db);
  const locations=request("/api/v1/market/locations","?countryCode=JP&locationName=Tokyo&limit=100");
  assert.equal(locations.status,200);
  assert.equal(locations.body.meta.total,locations.body.data.length);
  assert.equal(locations.body.summary.location_count,1360);
  assert.equal(locations.body.summary.country_count,216);
  assert.equal(locations.body.consumed_credit,0);
  assert(locations.body.data.every((row)=>row.countryIsoCode==="JP"&&row.catalog_digest.length===64));
  const usa=request("/api/v1/market/locations","?countryCode=US&limit=100");
  assert.equal(usa.body.meta.total,1);
  assert.equal(usa.body.data[0].granularity,"country");
  assert.equal(request("/api/v1/market/locations","?countryCode=JPN").status,400);
  const languages=request("/api/v1/market/languages","?limit=100");
  assert.equal(languages.body.meta.total,46);
  assert(languages.body.data.some((row)=>row.name==="Japanese"));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"list_search_locations",arguments:{countryCode:"JP",locationName:"Tokyo",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,locations.body.meta.total);
  const listed=handleMcpMessage({jsonrpc:"2.0",id:2,method:"tools/list",params:{}},data),toolNames=new Set(listed.result.tools.map((tool)=>tool.name));
  assert(toolNames.has("list_search_locations"));
  assert(toolNames.has("list_search_languages"));
  console.log(`public search metadata API/MCP: OK (${locations.body.summary.location_count}-location catalog, validation, ${listed.result.tools.length} read-only tools, zero credit)`);
} finally { db.close(); }
