import fs from "node:fs";
const app=await import("../dist/index.js");
const {AssetsManager, LOCAL_ASSETS}=await import("@gi-tcg/assets-manager");
const getData=(await import("@gi-tcg/data")).default; const {CURRENT_VERSION}=await import("@gi-tcg/core");
const {Game}=await import("@gi-tcg/core");
const mgr=new AssetsManager({officialDeckCompatible:true, localAssets:LOCAL_ASSETS});
await mgr.getDeckData();
const data=getData(CURRENT_VERSION);
const lib=JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8"));
const decks=lib.decks.filter(d=>d.chars?.length===3&&d.cards?.length===30);
const target=decks[0];
const deck={characters:target.chars,cards:target.cards};
const key=app.deckKeyOf(deck);
let wins=0,losses=0;
for(let i=0;i<10;i++){
  const opp=decks[(i*13+5)%decks.length];
  const oppDeck={characters:opp.chars,cards:opp.cards};
  const seed=500000+Math.floor(Math.random()*900000);
  const game=new Game(Game.createInitialState({decks:[deck,oppDeck],data,versionBehavior:CURRENT_VERSION,randomSeed:seed}),{silent:true});
  game.players[0].io=app.createAi({who:0,seed,delayMs:0,style:app.styleOfDeck(deck),data,deckKey:key});
  game.players[1].io=app.createAi({who:1,seed:seed+7,delayMs:0,style:app.styleOfDeck(oppDeck),data});
  const winner=await game.start();
  if(winner===0)wins++;else if(winner===1)losses++;
}
console.log("worker-style games: wins",wins,"losses",losses,"deck",target.title?.slice(0,12));
