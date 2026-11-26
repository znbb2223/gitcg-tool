import fs from "node:fs";
const app=await import("../dist/index.js");
const {AssetsManager, LOCAL_ASSETS}=await import("@gi-tcg/assets-manager");
const getData=(await import("@gi-tcg/data")).default; const {CURRENT_VERSION}=await import("@gi-tcg/core");
const {Game}=await import("@gi-tcg/core");
const mgr=new AssetsManager({officialDeckCompatible:true, localAssets:LOCAL_ASSETS}); await mgr.getDeckData();
const data=getData(CURRENT_VERSION);
const lib=JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8"));
const decks=lib.decks.filter(d=>d.chars?.length===3&&d.cards?.length===30);
const target=decks.find(d=>(d.title||"").includes("甘雨送终")) || decks[0];
const deck={characters:target.chars,cards:target.cards};
const key=app.deckKeyOf(deck);
let wins=0,losses=0;
for(let i=0;i<20;i++){
  const opp=decks[(i*13+5)%decks.length];
  const seed=500000+Math.floor(Math.random()*900000);
  const game=new Game(Game.createInitialState({decks:[deck,{characters:opp.chars,cards:opp.cards}],data,versionBehavior:CURRENT_VERSION,randomSeed:seed}),{silent:true});
  game.players[0].io=app.createAi({who:0,seed,delayMs:0,style:app.styleOfDeck(deck),data,deckKey:key});
  game.players[1].io=app.createAi({who:1,seed:seed+7,delayMs:0,style:app.styleOfDeck({characters:opp.chars,cards:opp.cards}),data});
  const w=await game.start();
  if(w===0)wins++;else losses++;
}
console.log("甘雨送终 worker-style:",wins,"胜",losses,"负","deckKey:",Boolean(app.DECK_LIBRARY.find(d=>d.code===target.code)));
