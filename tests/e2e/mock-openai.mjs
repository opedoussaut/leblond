// Minimal stand-in for the OpenAI Responses API used ONLY by the end-to-end
// test. It proves that /api/coach sends Patrick the real, persisted climbing
// context: it echoes figures read from the LEBLOND_CONTEXT developer message.
// Run: node tests/e2e/mock-openai.mjs  (then OPENAI_BASE_URL=http://127.0.0.1:4010/v1)
import http from "node:http";

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);

function stream(res, text, inputTokens) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  let seq = 0;
  for (const piece of text.match(/.{1,24}/gs) ?? []) {
    res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: piece, item_id: "i", output_index: 0, content_index: 0, sequence_number: ++seq })}\n\n`);
  }
  res.write(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", sequence_number: ++seq, response: { id: "mock", usage: { input_tokens: inputTokens, output_tokens: text.length } } })}\n\n`);
  res.end();
}

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
      const user = body.input.filter((m) => m.role === "user").at(-1)?.content ?? "";
      if (user.startsWith("LEBLOND_PLAN_REQUEST ")) {
        // Plan proposal: a two-block plan with a deload, deliberately one week short
        // and with one off-Atlas exercise, so LEBLOND's checks have work to do.
        const req = JSON.parse(user.slice("LEBLOND_PLAN_REQUEST ".length));
        const plan = {
          name: `MOCK PLAN — ${req.goal}`,
          phases: [
            { name: "Fondations", kind: "BASE", weeks: 4, objective: "Réussir 50 % des blocs au pan",
              sessions: [{ day: 1, methodId: "limit-bouldering", minutes: req.minutesPerSession, place: "BOULDER_GYM", notes: "" },
                { day: 4, methodId: "super-secret-drill", title: "Gainage maison", minutes: 30, place: "HOME", notes: "" }] },
            { name: "Semaine allégée", kind: "DELOAD", weeks: 1, sessions: [{ day: 3, methodId: "easy-volume", minutes: 60, notes: "" }] },
            { name: "Spécifique", kind: "BUILD", weeks: Math.max(1, req.totalWeeks - 6), objective: "3 × 10 s sur 20 mm",
              sessions: [{ day: 2, methodId: "max-hangs", minutes: 45, place: "HOME", notes: "" }] },
          ],
        };
        return stream(res, "Voici ma proposition : " + JSON.stringify(plan), dev.length);
      }
      const ctx = JSON.parse(dev.replace(/^LEBLOND_CONTEXT = /, ""));
      const fs = ctx.focusSession;
      const rp = ctx.focusRouteProject;
      const rs = ctx.focusRouteSession;
      const text = rp
        ? `MOCK PATRICK — ${ctx.climber.name}: route project ${rp.name} (${rp.grade}, ${rp.status}) at ${rp.gymName} — goes=${rp.goes.length}, falls=${rp.goes.map((g) => g.falls ?? 0).join("/")}, sessions=${rp.sessionsCount}. Lead working grade: ${ctx.routeClimbing?.leadWorkingGrade.grade ?? "none"}.`
        : rs
        ? `MOCK PATRICK — ${ctx.climber.name}: route session at ${rs.gymName} — routes=${rs.summary.routes}, clean=${rs.summary.clean}, hardestLead=${rs.summary.hardestCleanLead ?? "none"}.`
        : fs
        ? `MOCK PATRICK — ${ctx.climber.name}: session at ${fs.gymName} — problems=${fs.summary.problems}, tops=${fs.summary.tops}, flashes=${fs.summary.flashes}, attempts=${fs.summary.attempts}, avgHR=${fs.summary.wearable?.avgHeartRate ?? "none"}. Networks: ${ctx.gyms.native.map((n) => n.network).join("+")}.`
        : `MOCK PATRICK — ${ctx.climber.name}: no focus session. Sessions(30d)=${ctx.last30Days.sessions}.`;
      stream(res, text, dev.length);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock OpenAI on :${port}`));
