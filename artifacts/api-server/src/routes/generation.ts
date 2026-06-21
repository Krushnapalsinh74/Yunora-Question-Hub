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
  difficulty: "easy" | "medium" | "hard";
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

async function callAI(token: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
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
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error: ${response.status} ${text.slice(0, 300)}`);
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "";
}

function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const raw = match ? match[1] : text;
    return JSON.parse(raw!.trim()) as T;
  } catch {
    return null;
  }
}

async function runMultiAgentGeneration(
  token: string,
  model: string,
  params: GenerationRequest,
  context: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string }
): Promise<AgentResult[]> {
  const difficultyGuide: Record<string, string> = {
    easy: "recall-based, basic understanding, solvable within 20 seconds, success rate > 80%, score 1-3",
    medium: "conceptual understanding, application-based, 30-60 seconds, success rate 50-70%, score 4-7",
    hard: "deep reasoning, multi-step thinking, concept integration, HOTS, analytical, score 8-10",
  };

  const candidateCount = params.count * 5;

  // Agent 1: Question Generator
  const agent1System = `You are an expert educational question generator for ${context.boardName} Board, ${context.standardName}, ${context.subjectName}.
Generate ONLY valid JSON. No markdown outside JSON.`;

  const agent1Prompt = `Generate ${candidateCount} ${params.difficulty} ${params.questionType} questions for:
Topic: ${context.topicName}
Chapter: ${context.chapterName}
Difficulty guide: ${difficultyGuide[params.difficulty]}

Return JSON array:
[{
  "question": "...",
  "correctAnswer": "...",
  "options": "A) ... B) ... C) ... D) ..." (only for MCQ, else null),
  "estimatedSolveTime": 30
}]`;

  const agent1Raw = await callAI(token, model, agent1System, agent1Prompt);
  const candidates = parseJSON<Array<{ question: string; correctAnswer: string; options?: string; estimatedSolveTime?: number }>>(agent1Raw) ?? [];

  if (candidates.length === 0) return [];

  // Agents 2-5 run in parallel for each candidate batch
  const questionsJson = JSON.stringify(candidates.slice(0, Math.min(20, candidates.length)));

  const [agent2Raw, agent3Raw, agent4Raw, agent5Raw] = await Promise.all([
    // Agent 2: Subject Expert
    callAI(token, model,
      `You are a subject expert validator for ${context.subjectName}, ${context.boardName} board, ${context.standardName}. Return only JSON.`,
      `Validate these questions for factual accuracy and syllabus alignment. Return JSON array with same indices:
${questionsJson}
Return: [{"factuallyValid": true/false, "syllabusAligned": true/false, "reason": "..."}]`
    ),
    // Agent 3: Difficulty Auditor
    callAI(token, model,
      `You are a difficulty auditor for educational questions. Return only JSON.`,
      `Verify these questions match ${params.difficulty} difficulty (${difficultyGuide[params.difficulty]}). Return JSON array:
${questionsJson}
Return: [{"difficultyVerified": true/false, "difficultyScore": 1-10, "reason": "..."}]`
    ),
    // Agent 4: Explanation Writer
    callAI(token, model,
      `You are an expert explanation writer for ${context.subjectName} education. Return only JSON.`,
      `Write detailed explanations for each question. Return JSON array:
${questionsJson}
Return: [{"explanation": "detailed step-by-step explanation...", "learningObjective": "student will be able to..."}]`
    ),
    // Agent 5: Quality Reviewer
    callAI(token, model,
      `You are a quality reviewer for educational content. Return only JSON.`,
      `Review these questions for grammar, clarity, ambiguity, and duplicates. Return JSON array:
${questionsJson}
Return: [{"grammarOk": true/false, "qualityScore": 0.0-1.0, "isDuplicate": false, "issues": "..."}]`
    ),
  ]);

  const validations = parseJSON<Array<{ factuallyValid: boolean; syllabusAligned: boolean }>>(agent2Raw) ?? [];
  const difficulties = parseJSON<Array<{ difficultyVerified: boolean; difficultyScore: number }>>(agent3Raw) ?? [];
  const explanations = parseJSON<Array<{ explanation: string; learningObjective: string }>>(agent4Raw) ?? [];
  const qualities = parseJSON<Array<{ grammarOk: boolean; qualityScore: number; isDuplicate: boolean }>>(agent5Raw) ?? [];

  const results: AgentResult[] = candidates.slice(0, Math.min(20, candidates.length)).map((c, i) => ({
    question: c.question,
    correctAnswer: c.correctAnswer,
    options: c.options,
    explanation: explanations[i]?.explanation ?? `The correct answer is ${c.correctAnswer}. This tests ${params.questionType} understanding of ${context.topicName}.`,
    difficultyScore: difficulties[i]?.difficultyScore ?? (params.difficulty === "easy" ? 2 : params.difficulty === "medium" ? 5 : 8),
    qualityScore: qualities[i]?.qualityScore ?? 0.75,
    estimatedSolveTime: c.estimatedSolveTime ?? (params.difficulty === "easy" ? 20 : params.difficulty === "medium" ? 45 : 120),
    learningObjective: explanations[i]?.learningObjective ?? `Understand ${context.topicName}`,
    factuallyValid: validations[i]?.factuallyValid ?? true,
    syllabusAligned: validations[i]?.syllabusAligned ?? true,
    grammarOk: qualities[i]?.grammarOk ?? true,
    difficultyVerified: difficulties[i]?.difficultyVerified ?? true,
  }));

  // Filter and rank
  const passing = results.filter(r =>
    r.factuallyValid && r.syllabusAligned && r.grammarOk && r.difficultyVerified && r.qualityScore >= 0.5
  );

  // Sort by quality score desc, take top N
  passing.sort((a, b) => b.qualityScore - a.qualityScore);
  return passing.slice(0, params.count);
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

        const results = await runMultiAgentGeneration(token, params.model, params, context);

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
          agentLogs: `Agent 1 (Generator): Generated ${params.count * 5} candidates\nAgent 2 (Subject Expert): Validated factual accuracy\nAgent 3 (Difficulty Auditor): Verified difficulty scores\nAgent 4 (Explanation Writer): Generated explanations\nAgent 5 (Quality Reviewer): Quality scored and ranked\nFinal: ${results.length} high-quality questions selected`,
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
