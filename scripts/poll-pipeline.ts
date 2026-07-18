import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const wsId = "cmrqk519y0005i3x0v6i7v66l"
  const srcId = "cmrqk52ij0009i3x0rmvdx5xw"
  const startTime = Date.now()

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 60000))
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    const src = await db.source.findUnique({ where: { id: srcId } })
    const ec = await db.entity.count({ where: { workspaceId: wsId } })
    const cc = await db.claim.count({ where: { workspaceId: wsId } })
    const rc = await db.relationship.count({ where: { workspaceId: wsId } })
    const errMsg = src?.processingError?.slice(0, 40) || "-"
    const progress = src?.processingProgress || 0
    console.log(`[${elapsed}min] ${src?.status} | ${progress}% | E:${ec} | C:${cc} | R:${rc} | ${errMsg}`)
    if (src?.status === "processed" || src?.status === "failed") break
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  const [ec, cc, rc, tc] = await Promise.all([
    db.entity.count({ where: { workspaceId: wsId } }),
    db.claim.count({ where: { workspaceId: wsId } }),
    db.relationship.count({ where: { workspaceId: wsId } }),
    db.timelineEvent.count({ where: { workspaceId: wsId } })
  ])
  console.log(`\n[${elapsed}min] FINAL: E:${ec} | C:${cc} | R:${rc} | T:${tc}`)

  if (ec > 0) {
    const ents = await db.entity.findMany({ where: { workspaceId: wsId }, orderBy: { confidence: "desc" } })
    console.log(`\nAll ${ents.length} entities:`)
    for (const e of ents) console.log(`  ${e.name} (${e.type})`)
  }
  if (cc > 0) {
    const claims = await db.claim.findMany({ where: { workspaceId: wsId }, take: 5, orderBy: { confidence: "desc" } })
    console.log(`\nSample claims (${claims.length} of ${cc}):`)
    for (const c of claims) console.log(`  [${(c.confidence*100).toFixed(0)}%] ${c.statement.slice(0, 100)}`)
  }
}

main().catch(e => console.error("FAIL:", e.message)).finally(() => db.$disconnect())
