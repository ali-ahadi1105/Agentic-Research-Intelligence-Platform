/**
 * Test real RAG with sqlite-vec + local embeddings
 */
const BASE = "http://localhost:3000";

async function main() {
  console.log("🔐 Logging in...");
  const loginResp = await fetch(`${BASE}/api/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: "demo@research.ai",
      password: "demo1234",
    }),
  });
  const setCookie = loginResp.headers.get("set-cookie");
  const cookie = setCookie?.match(/research_session=([^;]+)/)?.[0] || "";
  console.log("  ✅ Logged in");

  const wsId = "cmrj3q1mr0009s0ypo5j21jnd";

  // Step 1: Trigger reprocess to generate real embeddings
  console.log("\n📋 Step 1: Triggering reprocess to generate real embeddings...");
  const docsResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/documents`, {
    headers: { Cookie: cookie },
  });
  const docsData = await docsResp.json();
  const source = docsData.data?.[0];
  if (!source) {
    console.log("  ❌ No sources found");
    return;
  }
  console.log(`  📄 Source: ${source.title} (status: ${source.status})`);

  // Trigger reprocess
  const reprocessResp = await fetch(
    `${BASE}/api/v1/workspaces/${wsId}/documents/${source.id}?action=reprocess`,
    { method: "POST", headers: { Cookie: cookie } }
  );
  const reprocessData = await reprocessResp.json();
  console.log("  ✅ Reprocess triggered:", reprocessData.data?.reprocessing ? "yes" : "no");

  // Wait for processing to complete (this will load transformers.js model + generate embeddings)
  console.log("\n  ⏳ Waiting for processing (up to 3 minutes)...");
  for (let i = 1; i <= 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statsResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/stats`, {
      headers: { Cookie: cookie },
    });
    const stats = await statsResp.json();
    if (stats.data) {
      const sourceStats = stats.data.sourceStats || [];
      const processed = sourceStats.find((s) => s.status === "processed")?._count || 0;
      const processing = sourceStats.find((s) => s.status === "processing")?._count || 0;
      const failed = sourceStats.find((s) => s.status === "failed")?._count || 0;
      console.log(
        `  [${i}/36] processed=${processed} processing=${processing} failed=${failed} entities=${stats.data.counts.entities} claims=${stats.data.counts.claims}`
      );
      if (processing === 0 && (processed > 0 || failed > 0)) {
        console.log("  ✅ Processing complete!");
        break;
      }
    }
  }

  // Step 2: Test semantic search
  console.log("\n📋 Step 2: Testing semantic search...");
  const searchResp = await fetch(
    `${BASE}/api/v1/workspaces/${wsId}/search?q=${encodeURIComponent("سرمایه‌گذاری استارتاپ")}`,
    { headers: { Cookie: cookie } }
  );
  const searchData = await searchResp.json();
  if (searchData.success) {
    const chunks = searchData.data?.chunks || [];
    console.log(`  ✅ Semantic search returned ${chunks.length} chunks`);
    chunks.slice(0, 3).forEach((c, i) => {
      console.log(`    [${i + 1}] score: ${c.score.toFixed(3)} | source: ${c.sourceTitle}`);
      console.log(`        content: ${c.content.slice(0, 100)}...`);
    });
  }

  // Step 3: Test chat with RAG
  console.log("\n📋 Step 3: Testing chat with RAG...");
  const chatCreateResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "create_conversation", title: "RAG Test" }),
  });
  const chatCreate = await chatCreateResp.json();
  const convId = chatCreate.data?.id;
  if (convId) {
    console.log("  ✅ Conversation created");
    console.log("  ⏳ Sending question...");
    const chatSendResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        action: "send",
        conversationId: convId,
        question: "کدام شرکت‌ها توسط ParsVenture سرمایه‌گذاری شده‌اند؟",
      }),
    });
    const chatSend = await chatSendResp.json();
    if (chatSend.success) {
      console.log("  ✅ Chat answered!");
      console.log(`  📝 Answer length: ${chatSend.data.answer?.length} chars`);
      console.log(`  📎 Citations: ${chatSend.data.citations?.length}`);
      console.log("\n  📝 Answer:");
      console.log("  " + chatSend.data.answer?.slice(0, 500));
    }
  }

  console.log("\n==========================================");
  console.log("🎉 RAG Test Complete!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
