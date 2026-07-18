import { readFileSync } from "fs";
const BASE = "http://localhost:3001";
const PDF_PATH = "/home/ali-ahadi/.hermes/webui/attachments/cce37d3a25b6/\u0645\u0639\u0645\u0627\u0631\u06cc_\u0645\u062d\u0635\u0648\u0644.pdf";

async function main() {
  console.log("=== E2E: Upload PDF & Process Pipeline ===\n");

  // 1. Login
  console.log("1. Logging in...");
  const loginResp = await fetch(`${BASE}/api/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email: "test@test.com", password: "test123456" }),
  });
  const cookie = (loginResp.headers.get("set-cookie") || "").split(";")[0];
  const loginData = await loginResp.json();
  if (!cookie) { console.log("   FAIL Login"); process.exit(1); }
  console.log("   OK Logged in");

  // 2. Workspace
  console.log("\n2. Creating workspace...");
  const wsResp = await fetch(`${BASE}/api/v1/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Test Architecture Doc", description: "E2E test" }),
  });
  const ws = (await wsResp.json()).data;
  console.log("   OK Workspace:", ws.id);

  // 3. Upload PDF
  console.log("\n3. Uploading PDF...");
  const pdfBuf = readFileSync(PDF_PATH);
  const formData = new FormData();
  formData.append("files", new Blob([pdfBuf], { type: "application/pdf" }), "\u0645\u0639\u0645\u0627\u0631\u06cc_\u0645\u062d\u0635\u0648\u0644.pdf");
  const uploadResp = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/documents`, {
    method: "POST", body: formData, headers: { Cookie: cookie },
  });
  const uploadData = await uploadResp.json();
  const sourceId = uploadData.data?.sources?.[0]?.id;
  console.log("   OK Source:", sourceId);

  // 4. Poll pipeline
  console.log("\n4. Waiting for pipeline...");
  let status = "pending", attempts = 0;
  while (status !== "processed" && status !== "failed" && attempts < 180) {
    await new Promise(r => setTimeout(r, 5000));
    const srcResp = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/documents/${sourceId}`, {
      headers: { Cookie: cookie },
    });
    const src = (await srcResp.json()).data;
    status = src?.status || "unknown";
    attempts++;
    if (attempts % 3 === 0) console.log(`   [${attempts}] ${status} (${src?.processingProgress || 0}%)`);
  }
  console.log("   Done:", status);

  // 5. Stats
  console.log("\n5. Results:");
  const statsResp = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/stats`, {
    headers: { Cookie: cookie },
  });
  const counts = (await statsResp.json()).data?.counts || {};
  for (const [k, v] of Object.entries(counts)) console.log(`   ${k}: ${v}`);

  // 6. Test chat
  console.log("\n6. Testing RAG chat...");
  const convResp = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "create_conversation", title: "E2E Test" }),
  });
  const convId = (await convResp.json()).data?.id;
  if (convId) {
    const chatResp = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ action: "send", conversationId: convId, question: "اين سند درباره چيست؟" }),
    });
    const chatData = await chatResp.json();
    if (chatData.success) {
      console.log("   Answer length:", chatData.data.answer?.length);
      console.log("   Citations:", chatData.data.citations?.length);
      console.log("   Preview:", (chatData.data.answer || "").slice(0, 250));
    } else {
      console.log("   Chat failed:", JSON.stringify(chatData).slice(0, 200));
    }
  }
  console.log("\n=== E2E Complete ===");
}
main().catch(e => { console.error("Error:", e.message); process.exit(1); });
