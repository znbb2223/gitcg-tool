import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
const data = getData(CURRENT_VERSION);
const ch = data.characters.get(1404); // 有 burst 的角色
for (const s of ch.skills) {
  if (s.skillType !== "burst") continue;
  console.log("burst 技能 id", s.id, "字段:", Object.keys(s).join(","));
  const cfg = s.initiativeSkillConfig;
  console.log("  requiredCost 类型:", cfg?.requiredCost?.constructor?.name, "内容:", JSON.stringify([...(cfg?.requiredCost ?? [])]));
  console.log("  costSize:", cfg?.computed$costSize, "diceCostSize:", cfg?.computed$diceCostSize, "gainEnergy:", cfg?.gainEnergy);
  break;
}
