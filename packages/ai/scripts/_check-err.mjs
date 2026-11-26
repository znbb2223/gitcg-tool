import fs from "node:fs";
const app=await import("../dist/index.js");
const {AssetsManager, LOCAL_ASSETS}=await import("@gi-tcg/assets-manager");
const getData=(await import("@gi-tcg/data")).default; const {CURRENT_VERSION}=await import("@gi-tcg/core");
const {Game}=await import("@gi-tcg/core");
const mgr=new AssetsManager({officialDeckCompatible:true, localAssets:LOCAL_ASSETS}); await mgr.getDeckData();
const data=getData(CURRENT_VERSION);
const lib=JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8"));
const decks=lib.decks.filter(d=>d.chars?.length===3&&d.cards?.length===30);
for (const [i,decksIdx] of [[0,0],[1,5]]) {}
const target=decks.find(d=>(d.title||"").includes("甘雨送终"))||decks[0];
async function once(withHints){
  const deck={characters:target.chars,cards:target.cards};
  const opp=decks[5];
  const seed=777777;
  const game=new Game(Game.createInitialState({decks:[deck,{characters:opp.chars,cards:opp.cards}],data,versionBehavior:CURRENT_VERSION,randomSeed:seed}),{silent:true});
  game.onIoError=(e)=>console.log("IOERROR who:",e.who,String(e.message||e).slice(0,120));
  game.players[0].io=app.createAi({who:0,seed,delayMs:0,style:"midrange",data,deckKey: withHints? app.deckKeyOf(deck): undefined});
  game.players[1].io=app.createAi({who:1,seed:seed+7,delayMs:0,style:"midrange",data});
  const w=await game.start();
  console.log("hints:",withHints,"winner:",w,"hp1:",game.state.players[1].characters.map(c=>c.variables.health));
}
await once(true);
await once(false);
