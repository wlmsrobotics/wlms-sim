import { getStore } from "@netlify/blobs";
const H={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
const out=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:H});
export default async (req)=>{
  if(req.method==="OPTIONS")return new Response("",{headers:H});
  const team=(new URL(req.url).searchParams.get("team")||"").trim().toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,40);
  if(!team)return out({error:"team required"},400);
  const store=getStore({name:"wlms-autons",consistency:"strong"});
  const cur=(await store.get(team,{type:"json"}))||{autons:{},deleted:{}};
  if(req.method==="GET")return out({autons:Object.values(cur.autons),deleted:cur.deleted});
  if(req.method!=="POST")return out({error:"method not allowed"},405);
  let b;try{b=await req.json();}catch{return out({error:"bad json"},400);}
  if(b.op==="upsert"&&b.auton&&typeof b.auton.id==="string"&&Array.isArray(b.auton.steps)){
    const a=b.auton;if(JSON.stringify(a).length>200000)return out({error:"too large"},413);
    const del=cur.deleted[a.id];if(del&&del>=(a.updated||0))return out({ok:true,ignored:"deleted"});
    const ex=cur.autons[a.id];if(!ex||(a.updated||0)>=(ex.updated||0)){cur.autons[a.id]=a;delete cur.deleted[a.id];}
  }else if(b.op==="delete"&&typeof b.id==="string"){delete cur.autons[b.id];cur.deleted[b.id]=b.at||Date.now();}
  else return out({error:"bad op"},400);
  await store.setJSON(team,cur);
  return out({ok:true});
};
