export function parseComplaintImages(value){
  if(Array.isArray(value)) return value.filter(item=>typeof item==='string'&&item.trim());
  if(typeof value!=='string'||!value.trim()) return [];
  const text=value.trim();
  if(text.startsWith('[')){
    try{
      const parsed=JSON.parse(text);
      return Array.isArray(parsed)?parsed.filter(item=>typeof item==='string'&&item.trim()):[];
    }catch{return [];}
  }
  return [text];
}

export function packComplaintImages(values){
  const list=(Array.isArray(values)?values:[values]).filter(item=>typeof item==='string'&&item.trim()).slice(0,8);
  if(!list.length) return '';
  if(list.length===1) return list[0];
  return JSON.stringify(list);
}
