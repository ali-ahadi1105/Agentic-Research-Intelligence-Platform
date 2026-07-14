/**
 * Quick test of Chat and Report features using existing workspace with data
 */
const BASE = "http://localhost:3000";

async function main() {
  // Login first
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
  const loginData = await loginResp.json();
  console.log("  ✅ Logged in as:", loginData.data?.user?.name);

  // Get workspaces
  console.log("\n📂 Getting workspaces...");
  const wsResp = await fetch(`${BASE}/api/v1/workspaces`, {
    headers: { Cookie: cookie },
  });
  const wsData = await wsResp.json();
  const ws = wsData.data?.find((w) => w._count?.entities > 10) || wsData.data?.[0];
  if (!ws) {
    console.log("❌ No workspace found");
    return;
  }
  console.log(`  ✅ Using workspace: ${ws.name} (${ws._count?.entities || 0} entities)`);

  const wsId = ws.id;

  // Check knowledge base
  console.log("\n📊 Knowledge base stats:");
  const statsResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/stats`, {
    headers: { Cookie: cookie },
  });
  const stats = await statsResp.json();
  if (stats.data) {
    console.log(`  - Sources: ${stats.data.counts.sources}`);
    console.log(`  - Entities: ${stats.data.counts.entities}`);
    console.log(`  - Claims: ${stats.data.counts.claims}`);
    console.log(`  - Relationships: ${stats.data.counts.relationships}`);
    console.log(`  - Evidence: ${stats.data.counts.evidence}`);
    console.log(`  - Timeline events: ${stats.data.counts.timeline}`);
    console.log(`  - Reports: ${stats.data.counts.reports}`);
    console.log(`  - Conversations: ${stats.data.counts.conversations}`);
  }

  // Test Chat
  console.log("\n💬 Testing chat...");
  const chatCreateResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "create_conversation", title: "E2E Quick Test" }),
  });
  const chatCreate = await chatCreateResp.json();
  const convId = chatCreate.data?.id;
  if (!convId) {
    console.log("  ❌ Failed to create conversation:", JSON.stringify(chatCreate));
    return;
  }
  console.log("  ✅ Conversation created");

  console.log("  ⏳ Sending question to AI...");
  const question = "چه کسی بنیان‌گذار TechStart است و چه سرمایه‌گذاری کرده‌اند؟";
  const chatSendResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "send", conversationId: convId, question }),
  });
  const chatSend = await chatSendResp.json();

  if (chatSend.success) {
    console.log("  ✅ Chat answered!");
    console.log(`  📝 Answer length: ${chatSend.data.answer?.length} chars`);
    console.log(`  📎 Citations: ${chatSend.data.citations?.length}`);
    console.log(`  🏷️ Related entities: ${chatSend.data.relatedEntities?.length}`);
    console.log("\n  📝 Answer preview (first 300 chars):");
    console.log("  " + chatSend.data.answer?.slice(0, 300) + "...");

    if (chatSend.data.citations?.length > 0) {
      console.log("\n  📎 First citation:");
      const c = chatSend.data.citations[0];
      console.log(`     [E:${c.index}] ${c.statement}`);
      console.log(`     Source: ${c.sourceTitle}`);
      console.log(`     Confidence: ${Math.round(c.confidence * 100)}%`);
    }
  } else {
    console.log("  ❌ Chat failed:", JSON.stringify(chatSend).slice(0, 300));
  }

  // Test Report Generation
  console.log("\n📄 Testing report generation...");
  console.log("  ⏳ Generating executive summary (may take 30-60 seconds)...");
  const reportResp = await fetch(`${BASE}/api/v1/workspaces/${wsId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ type: "executive_summary", title: "E2E Quick Test Report" }),
  });
  const report = await reportResp.json();

  if (report.success) {
    console.log("  ✅ Report generated!");
    console.log(`  📝 Content length: ${report.data.contentMarkdown?.length} chars`);
    console.log("\n  📝 Report preview (first 500 chars):");
    console.log("  " + report.data.contentMarkdown?.slice(0, 500) + "...");
  } else {
    console.log("  ❌ Report failed:", JSON.stringify(report).slice(0, 300));
  }

  console.log("\n==========================================");
  console.log("🎉 Quick E2E Test Complete!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
