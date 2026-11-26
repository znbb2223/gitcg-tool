import fs from "node:fs";
const app=await import("../dist/index.js");
const {AssetsManager, LOCAL_ASSETS}=await import("@gi-tcg/assets-manager");
const getData=(await import("@gi-tcg/data")).default; const {CURRENT_VERSION}=await import("@gi-tcg/core");
const mgr=new AssetsManager({officialDeckCompatible:true, localAssets:LOCAL_ASSETS});
await mgr.getDeckData();
const data=getData(CURRENT_VERSION);
const lib=JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8"));
const decks=lib.decks.filter(d=>d.chars?.length===3&&d.cards?.length===30).slice(0,40).map(d=>({characters:d.chars,cards:d.cards}));
let w0=0,w1=0,d=0;
for(let i=0;i<20;i++){
  const a=decks[i%decks.length], b=decks[(i*7+3)%decks.length];
  const r=await app.playFastGame(data,[a,b],(Math.random()*1e9)>>>0);
  if(r.winner===0)w0++; else if(r.winner===1)w1++; else d++;
}
console.log("fastGame winners: side0",w0,"side1",w1,"draw",d);
