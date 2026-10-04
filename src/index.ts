import { Hono } from "hono";
import {
  LayaNotRunning,
  LAYA_NOT_RUNNING,
  choiceOf,
  confidenceOf,
  isAbstained,
  layaHealth,
  predict,
  type Question,
} from "./laya.ts";
import { pickQuote, quoteInDiff } from "./quote.ts";

const PORT = 3005;
const MIN_CONFIDENCE = 0.6;
const VERDICTS = ["merge", "hold", "revert"] as const;

const questions: Record<string, Question> = {
  verdict: {
    type: "choice",
    instructions: "Choose merge, hold, or revert for this unified diff. Do not claim the change has been merged.",
    criteria: {
      merge: "The change is consistent with the surrounding lines",
      hold: "A person should read this before it lands",
      revert: "The change should not land",
    },
  },
};

const app = new Hono();
const page = await Bun.file(new URL("../public/index.html", import.meta.url)).text();

app.get("/", (c) => c.html(page));

app.get("/api/health", async (c) => {
  const health = await layaHealth();
  if (!health.ok) return c.json({ ok: false, error: LAYA_NOT_RUNNING }, 503);
  return c.json({ ok: true, model_loaded: health.modelLoaded, laya_version: health.version });
});

app.post("/api/verdict", async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null || typeof (raw as { diff?: unknown }).diff !== "string") {
    return c.json({ error: "diff is required" }, 400);
  }
  const diff = (raw as { diff: string }).diff;
  if (!diff.trim() || diff.length > 50000) return c.json({ error: "diff is required" }, 400);
  const quoteLine = pickQuote(diff);
  if (!quoteLine || !quoteInDiff(diff, quoteLine)) {
    return c.json({ error: "diff has no added or context line to quote" }, 400);
  }
  try {
    const result = await predict({ diff }, questions, MIN_CONFIDENCE);
    const answer = result.answers.verdict;
    const picked = choiceOf(answer, VERDICTS);
    const abstained = isAbstained(answer, MIN_CONFIDENCE) || !picked;
    // Unsure lane is hold. Never call GitHub and never merge.
    const verdict = abstained ? "hold" : picked;
    if (!quoteInDiff(diff, quoteLine) || (verdict !== "merge" && verdict !== "hold" && verdict !== "revert")) {
      return c.json({ error: "verdict withheld" }, 422);
    }
    return c.json({
      verdict: {
        diff,
        verdict,
        abstained,
        confidence: confidenceOf(answer),
        quoteLine,
        model: result.model,
        merges: false,
        github: false,
      },
    });
  } catch (err) {
    if (err instanceof LayaNotRunning) return c.json({ error: LAYA_NOT_RUNNING }, 503);
    throw err;
  }
});

app.onError((err, c) => {
  console.error(err);
  if (err instanceof LayaNotRunning || (err instanceof Error && err.message === LAYA_NOT_RUNNING)) {
    return c.json({ error: LAYA_NOT_RUNNING }, 503);
  }
  return c.json({ error: "internal error" }, 500);
});

if (import.meta.main) {
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`mergeverdict listening on http://localhost:${PORT}`);
}
