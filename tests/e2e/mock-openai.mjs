// Minimal stand-in for the OpenAI Responses API used ONLY by the end-to-end
// test. It proves that /api/coach sends Patrick the real, persisted climbing
// context: it echoes figures read from the LEBLOND_CONTEXT developer message.
// Run: node tests/e2e/mock-openai.mjs  (then OPENAI_BASE_URL=http://127.0.0.1:4010/v1)
import http from "node:http";

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);

http
  .createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/responses")) {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      const dev = body.input.find((m) => m.role === "developer")?.content ?? "";
      const ctx = JSON.parse(dev.replace(/^LEBLOND_CONTEXT = /, ""));
      const fs = ctx.focusSession;
      const text = fs
        ? `MOCK PATRICK — ${ctx.climber.name}: session at ${fs.gymName} — problems=${fs.summary.problems}, tops=${fs.summary.tops}, flashes=${fs.summary.flashes}, attempts=${fs.summary.attempts}, avgHR=${fs.summary.wearable?.avgHeartRate ?? "none"}. Networks: ${ctx.gyms.native.map((n) => n.network).join("+")}.`
        : `MOCK PATRICK — ${ctx.climber.name}: no focus session. Sessions(30d)=${ctx.last30Days.sessions}.`;
      res.writeHead(200, { "content-type": "text/event-stream" });
      let seq = 0;
      for (const piece of text.match(/.{1,24}/g) ?? []) {
        res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: piece, item_id: "i", output_index: 0, content_index: 0, sequence_number: ++seq })}\n\n`);
      }
      res.write(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", sequence_number: ++seq, response: { id: "mock", usage: { input_tokens: dev.length, output_tokens: text.length } } })}\n\n`);
      res.end();
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock OpenAI on :${port}`));
