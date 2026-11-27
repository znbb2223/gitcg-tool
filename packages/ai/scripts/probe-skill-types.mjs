import fs from "node:fs";
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
const data = getData(CURRENT_VERSION);
const byType = { normal: [], elemental: [], burst: [], other: [] };
for (const [, ch] of data.characters) {
  for (const skill of ch?.skills ?? []) {
    const t = skill?.skillType;
    (byType[t] ? byType[t] : byType.other).push(skill.id);
  }
}
console.log(`角色技能：normal ${byType.normal.length} / elemental ${byType.elemental.length} / burst ${byType.burst.length}`);
fs.writeFileSync("/tmp/burst-ids.json", JSON.stringify(byType));
