import {isIP} from "node:net";

export function resolveDashboardBind(env=process.env){
  const host=env.WP_DASHBOARD_HOST?.trim()||"127.0.0.1",allowRemote=env.WP_DASHBOARD_ALLOW_REMOTE==="1";
  const loopback=host==="localhost"||host==="::1"||host.startsWith("127.");
  if(!loopback&&!allowRemote)throw new Error(`Refusing non-loopback dashboard bind (${host}); set WP_DASHBOARD_ALLOW_REMOTE=1 only behind explicit access controls`);
  if(host!=="localhost"&&!isIP(host))throw new Error(`Dashboard bind host must be localhost or an IP literal: ${host}`);
  return {host,allow_remote:allowRemote,exposure:loopback?"loopback_only":"explicit_remote_override"};
}
