// Explicit non-unique placeholders are not stable page identifiers.
// Do not reject all anonymous domains: a stable pseudonym can preserve identity.
export function hasRedactedUrlIdentity(value){
  if(typeof value!=="string")return false;
  let decoded=value.replace(/%3c/giu,"<").replace(/%3e/giu,">");
  try{decoded=decodeURIComponent(value);}catch{/* Keep recognizable markers despite malformed escapes. */}
  return /<redacted(?:[-_][^<>]*)?>/iu.test(decoded);
}
