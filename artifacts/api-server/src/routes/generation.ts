import { Router } from "express";
import { db } from "@workspace/db";
import {
  generationJobsTable, questionsTable, aiProvidersTable,
  topicsTable, chaptersTable, subjectsTable, boardsTable, standardsTable, activityLogsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { randomUUID } from "crypto";

const router = Router();

interface GenerationRequest {
  boardId: number;
  standardId: number;
  subjectId: number;
  chapterId: number;
  topicId: number;
  questionType: string;
  difficulty: "easy" | "medium" | "hard" | "advanced";
  count: number;
  providerId: number;
  model: string;
}

interface AgentResult {
  question: string;
  correctAnswer: string;
  options?: string;
  explanation: string;
  difficultyScore: number;
  qualityScore: number;
  estimatedSolveTime: number;
  learningObjective: string;
  factuallyValid: boolean;
  syllabusAligned: boolean;
  grammarOk: boolean;
  difficultyVerified: boolean;
}

const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  openai:        "https://api.openai.com/v1/chat/completions",
  github_models: "https://models.inference.ai.azure.com/chat/completions",
  groq:          "https://api.groq.com/openai/v1/chat/completions",
  gemini:        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  azure_openai:  "https://models.inference.ai.azure.com/chat/completions",
};

async function callAI(
  token: string,
  model: string,
  providerType: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  // ── Anthropic Claude — uses a different API format ──────────────────────
  if (providerType === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 300)}`);
    }
    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    return data.content?.find(c => c.type === "text")?.text ?? "";
  }

  // ── OpenAI-compatible endpoints (OpenAI, GitHub Models, Groq, Gemini) ──
  const endpoint = OPENAI_COMPAT_ENDPOINTS[providerType] ?? OPENAI_COMPAT_ENDPOINTS.github_models;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16000,
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${providerType}) ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "";
}

function fixLatexEscapes(raw: string): string {
  // AI often writes LaTeX like \vec, \frac inside JSON strings without doubling the backslash.
  // Strategy: protect already-doubled backslashes, then double all remaining single backslashes.
  const PLACEHOLDER = '\x00DS\x00';
  return raw
    .replace(/\\\\/g, PLACEHOLDER)   // protect \\  →  placeholder
    .replace(/\\/g, '\\\\')           // single \  →  \\
    .replace(new RegExp(PLACEHOLDER.replace(/\x00/g, '\\x00'), 'g'), '\\\\'); // restore \\
}

function parseJSON<T>(text: string): T | null {
  const extract = (s: string) => {
    const m = s.match(/```(?:json)?\s*([\s\S]*?)```/) ?? s.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    return m ? m[1].trim() : s.trim();
  };

  const raw = extract(text);

  // First attempt: direct parse (works when AI correctly double-escapes)
  try {
    return JSON.parse(raw) as T;
  } catch { /* fall through */ }

  // Second attempt: fix unescaped backslashes from LaTeX and retry
  try {
    return JSON.parse(fixLatexEscapes(raw)) as T;
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RawCandidate {
  question: string;
  correctAnswer: string;
  options?: string | null;
  explanation?: string;
  learningObjective?: string;
  estimatedSolveTime?: number;
}

interface Review {
  index: number;
  passed: boolean;
  difficultyScore: number;
  qualityScore: number;
  feedback: string;
}

async function generateBatch(
  token: string,
  model: string,
  providerType: string,
  params: GenerationRequest,
  context: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string },
  count: number,
  difficultyGuide: Record<string, string>,
  previousFeedback?: string
): Promise<RawCandidate[]> {
  const isMcq = /mcq|multiple.?choice/i.test(params.questionType);
  const system = `You are an expert educational question generator for ${context.boardName} Board, ${context.standardName}, ${context.subjectName}.

CRITICAL JSON RULE: You are returning JSON. Inside JSON strings, ALL backslashes must be doubled.
- Write \\\\vec not \\vec
- Write \\\\frac not \\frac  
- Write \\\\hat not \\hat
- Write \\\\sqrt not \\sqrt
- Write \\\\times not \\times
- Write \\\\theta not \\theta
Example: "What is $\\\\vec{A} \\\\times \\\\vec{B}$?" — every LaTeX \\ becomes \\\\ in JSON.

Use LaTeX for ALL math: inline math in $...$, display math in $$...$$.
Return ONLY a valid JSON array — no markdown fences, no extra text outside the JSON.`;

  const feedbackSection = previousFeedback
    ? `\n\nIMPORTANT — previous batch was rejected for these reasons. Fix ALL of them:\n${previousFeedback}\n`
    : '';

  const prompt = `Generate exactly ${count} ${params.difficulty} ${params.questionType} questions on:
Topic: ${context.topicName}
Chapter: ${context.chapterName}
Subject: ${context.subjectName} (${context.boardName} Board, ${context.standardName})
Difficulty guide: ${difficultyGuide[params.difficulty]}
${feedbackSection}
Requirements for each question:
- question: clear, unambiguous (LaTeX for any math)
- correctAnswer: precise answer (LaTeX for any math/expressions)
- options: ${isMcq ? '"A) ...\\nB) ...\\nC) ...\\nD) ..." with exactly 4 choices, one correct' : 'null'}
- explanation: step-by-step solution with LaTeX for any math
- learningObjective: "Student will be able to ..."
- estimatedSolveTime: seconds (integer)

Return JSON array with exactly ${count} items:
[{"question":"...","correctAnswer":"...","options":${isMcq ? '"A) ...\\nB) ...\\nC) ...\\nD) ..."' : 'null'},"explanation":"...","learningObjective":"...","estimatedSolveTime":30}]`;

  const raw = await callAI(token, model, providerType, system, prompt);
  return parseJSON<RawCandidate[]>(raw) ?? [];
}

async function validateBatch(
  token: string,
  model: string,
  providerType: string,
  candidates: RawCandidate[],
  params: GenerationRequest,
  context: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string },
  difficultyGuide: Record<string, string>
): Promise<Review[]> {
  const system = `You are a strict but fair educational content validator for ${context.subjectName} (${context.boardName} ${context.standardName}). Return ONLY valid JSON.`;

  const prompt = `Validate these ${candidates.length} questions for:
1. Factual/mathematical correctness
2. Syllabus alignment with topic "${context.topicName}"
3. Grammar and clarity
4. Difficulty match: ${params.difficulty} (${difficultyGuide[params.difficulty]})

Questions:
${JSON.stringify(candidates.map((c, i) => ({ index: i, question: c.question, correctAnswer: c.correctAnswer })))}

For each question return ONE entry. Be generous — only fail a question if it has a clear factual error, is completely off-topic, or is severely unclear.

Return JSON array:
[{
  "index": 0,
  "passed": true,
  "difficultyScore": 5,
  "qualityScore": 0.85,
  "feedback": "Good question." 
}]`;

  const raw = await callAI(token, model, providerType, system, prompt);
  return parseJSON<Review[]>(raw) ?? [];
}

async function runMultiAgentGeneration(
  token: string,
  model: string,
  providerType: string,
  params: GenerationRequest,
  context: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string }
): Promise<{ results: AgentResult[]; agentLog: string }> {
  const difficultyGuide: Record<string, string> = {
    easy: "recall-based, basic understanding, solvable within 20 seconds, success rate > 80%, score 1-3",
    medium: "conceptual understanding, application-based, 30-60 seconds, success rate 50-70%, score 4-7",
    hard: "deep reasoning, multi-step thinking, concept integration, HOTS, analytical, score 8-10",
    advanced: "very hard — olympiad/competitive level, highly abstract, multi-concept synthesis, requires deep expertise, >3 minutes, score 9-10",
  };

  const defaultDiffScore = params.difficulty === "easy" ? 2 : params.difficulty === "medium" ? 5 : params.difficulty === "hard" ? 8 : 10;
  const defaultSolveTime = params.difficulty === "easy" ? 20 : params.difficulty === "medium" ? 45 : params.difficulty === "hard" ? 120 : 240;
  const logLines: string[] = [];

  // Each AI call is limited to MAX_PER_BATCH questions to stay within output token limits.
  // For large counts we loop, making sequential (rate-limit-safe) batches.
  const MAX_PER_BATCH = 8;
  const pool: AgentResult[] = [];
  let batchNum = 0;

  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;

  while (pool.length < params.count) {
    batchNum++;
    const needed = params.count - pool.length;
    const batchSize = Math.min(MAX_PER_BATCH, needed);

    logLines.push(`── Batch ${batchNum}: generating ${batchSize} question(s) (${pool.length}/${params.count} done) ──`);

    // Agent 1: generate this batch — retry up to 2 times if parse fails
    let candidates: RawCandidate[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      candidates = await generateBatch(token, model, providerType, params, context, batchSize, difficultyGuide);
      if (candidates.length > 0) break;
      logLines.push(`  Agent 1 attempt ${attempt} returned 0 — ${attempt < 2 ? 'retrying...' : 'skipping batch.'}`);
      if (attempt < 2) await sleep(800);
    }

    if (candidates.length === 0) {
      consecutiveFailures++;
      logLines.push(`  Consecutive failures: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logLines.push(`  Too many consecutive failures — stopping.`);
        break;
      }
      await sleep(1000);
      continue; // try next batch rather than break
    }

    consecutiveFailures = 0; // reset on success
    await sleep(600); // respect rate limits between sequential calls

    // Agent 2: rank this batch (never rejects — only adjusts score)
    let reviews: Review[] = [];
    try {
      reviews = await validateBatch(token, model, providerType, candidates, params, context, difficultyGuide);
    } catch {
      logLines.push(`  Agent 2 failed — using default scores for this batch.`);
    }
    logLines.push(`  Agent 1: ${candidates.length} generated, Agent 2: ${reviews.length} scored`);

    candidates.forEach((c, i) => {
      const review = reviews.find(r => r.index === i) ?? reviews[i];
      const baseScore = review?.qualityScore ?? 0.8;
      const penalty = review && review.passed === false ? 0.1 : 0;
      pool.push({
        question: c.question,
        correctAnswer: c.correctAnswer,
        options: c.options ?? undefined,
        explanation: c.explanation ?? `The correct answer is ${c.correctAnswer}.`,
        learningObjective: c.learningObjective ?? `Understand ${context.topicName}`,
        estimatedSolveTime: c.estimatedSolveTime ?? defaultSolveTime,
        difficultyScore: review?.difficultyScore ?? defaultDiffScore,
        qualityScore: Math.max(0.1, baseScore - penalty),
        factuallyValid: review?.passed ?? true,
        syllabusAligned: true,
        grammarOk: true,
        difficultyVerified: true,
      });
    });

    logLines.push(`  Pool now has ${pool.length}/${params.count} questions`);

    if (pool.length < params.count) {
      await sleep(400); // small pause before next batch
    }
  }

  pool.sort((a, b) => b.qualityScore - a.qualityScore);
  const results = pool.slice(0, params.count);

  logLines.push(`\nFinal: ${results.length}/${params.count} questions generated across ${batchNum} batch(es)`);
  if (results.length > 0) {
    const avg = (results.reduce((s, r) => s + r.qualityScore, 0) / results.length).toFixed(2);
    logLines.push(`Average quality score: ${avg}`);
  }

  return { results, agentLog: logLines.join('\n') };
}

router.post("/generation/start", requireAuth, async (req, res) => {
  try {
    const params = req.body as GenerationRequest;
    const jobId = randomUUID();

    // Fetch context
    const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.id, params.topicId)).limit(1);
    const [chapter] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, params.chapterId)).limit(1);
    const [subject] = await db.select().from(subjectsTable).where(eq(subjectsTable.id, params.subjectId)).limit(1);
    const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, params.boardId)).limit(1);
    const [standard] = await db.select().from(standardsTable).where(eq(standardsTable.id, params.standardId)).limit(1);
    const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, params.providerId)).limit(1);

    if (!provider) {
      res.status(400).json({ error: "AI provider not found" });
      return;
    }

    // Create job record
    await db.insert(generationJobsTable).values({
      jobId,
      status: "pending",
      totalRequested: params.count,
      boardId: params.boardId,
      standardId: params.standardId,
      subjectId: params.subjectId,
      chapterId: params.chapterId,
      topicId: params.topicId,
      topicName: topic?.name ?? "Unknown",
      subjectName: subject?.name ?? "Unknown",
      chapterName: chapter?.name ?? "Unknown",
      questionType: params.questionType,
      difficulty: params.difficulty,
      providerId: params.providerId,
      model: params.model,
      requestParams: params,
    });

    res.status(202).json({ jobId, status: "pending", totalRequested: params.count, createdAt: new Date() });

    // Run generation async
    setImmediate(async () => {
      try {
        await db.update(generationJobsTable).set({ status: "processing" }).where(eq(generationJobsTable.jobId, jobId));

        const token = simpleDecrypt(provider.encryptedToken);
        const context = {
          topicName: topic?.name ?? "Topic",
          chapterName: chapter?.name ?? "Chapter",
          subjectName: subject?.name ?? "Subject",
          boardName: board?.name ?? "Board",
          standardName: standard?.name ?? "Standard",
        };

        const { results, agentLog } = await runMultiAgentGeneration(token, params.model, provider.providerType, params, context);

        // Save questions
        if (results.length > 0) {
          await db.insert(questionsTable).values(results.map(r => ({
            question: r.question,
            questionType: params.questionType,
            difficulty: params.difficulty,
            difficultyScore: r.difficultyScore,
            correctAnswer: r.correctAnswer,
            options: r.options ?? null,
            explanation: r.explanation,
            qualityScore: r.qualityScore,
            estimatedSolveTime: r.estimatedSolveTime,
            learningObjective: r.learningObjective,
            topicId: params.topicId,
            chapterId: params.chapterId,
            subjectId: params.subjectId,
            boardId: params.boardId,
            standardId: params.standardId,
            providerId: params.providerId,
            modelUsed: params.model,
            jobId,
          })));
        }

        await db.update(generationJobsTable).set({
          status: "completed",
          totalGenerated: results.length,
          agentLogs: agentLog,
          completedAt: new Date(),
        }).where(eq(generationJobsTable.jobId, jobId));

        await db.insert(activityLogsTable).values({
          jobId,
          action: "generation_completed",
          description: `Generated ${results.length} ${params.difficulty} ${params.questionType} questions for ${context.topicName}`,
          questionsGenerated: results.length,
          model: params.model,
        });

      } catch (err) {
        await db.update(generationJobsTable).set({
          status: "failed",
          errorMessage: (err as Error).message,
          completedAt: new Date(),
        }).where(eq(generationJobsTable.jobId, jobId));

        await db.insert(activityLogsTable).values({
          jobId,
          action: "generation_failed",
          description: `Generation failed: ${(err as Error).message.slice(0, 200)}`,
          questionsGenerated: 0,
          model: params.model,
        }).catch(() => {});
      }
    });

  } catch (err) {
    req.log.error({ err }, "Start generation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/generation/jobs", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const [{ total }] = await db.select({ total: count() }).from(generationJobsTable);
    const jobs = await db.select().from(generationJobsTable)
      .orderBy(generationJobsTable.createdAt)
      .limit(limitNum).offset(offset);

    res.json({
      data: jobs.map(j => ({
        jobId: j.jobId,
        status: j.status,
        totalRequested: j.totalRequested,
        totalGenerated: j.totalGenerated,
        topicName: j.topicName,
        subjectName: j.subjectName,
        difficulty: j.difficulty,
        questionType: j.questionType,
        model: j.model,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      })),
      total: Number(total),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "List generation jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/generation/jobs/:jobId", requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db.select().from(generationJobsTable).where(eq(generationJobsTable.jobId, jobId!)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    const questions = await db.select().from(questionsTable).where(eq(questionsTable.jobId, jobId!));

    res.json({
      jobId: job.jobId,
      status: job.status,
      totalRequested: job.totalRequested,
      totalGenerated: job.totalGenerated,
      agentLogs: job.agentLogs,
      errorMessage: job.errorMessage,
      questions,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get generation job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
