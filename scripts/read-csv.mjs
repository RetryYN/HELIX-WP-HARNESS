export function parseCsv(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let index=0;index<text.length;index+=1){const char=text[index];if(quoted){if(char==='"'&&text[index+1]==='"'){field+='"';index+=1}else if(char==='"')quoted=false;else field+=char}else if(char==='"')quoted=true;else if(char===','){row.push(field);field=""}else if(char==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field=""}else field+=char}
  if(field||row.length){row.push(field.replace(/\r$/,""));rows.push(row)}
  const [header,...body]=rows;
  return body.filter((values)=>values.some(Boolean)).map((values)=>Object.fromEntries(header.map((key,index)=>[key,values[index]??""])));
}
