import { Router } from "express";
import { db } from "@workspace/db";
import {
  questionsTable, subjectsTable, chaptersTable, topicsTable,
  boardsTable, standardsTable, aiProvidersTable, papersTable,
  generationJobsTable, activityLogsTable,
} from "@workspace/db";
import { count, sql, avg, gte, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/analytics/dashboard", requireAuth, async (req, res) => {
  try {
    const [{ totalQuestions }] = await db.select({ totalQuestions: count() }).from(questionsTable);
    const [{ totalSubjects }] = await db.select({ totalSubjects: count() }).from(subjectsTable);
    const [{ totalChapters }] = await db.select({ totalChapters: count() }).from(chaptersTable);
    const [{ totalTopics }] = await db.select({ totalTopics: count() }).from(topicsTable);
    const [{ totalBoards }] = await db.select({ totalBoards: count() }).from(boardsTable);
    const [{ totalStandards }] = await db.select({ totalStandards: count() }).from(standardsTable);
    const [{ activeProviders }] = await db.select({ activeProviders: count() }).from(aiProvidersTable);
    const [{ totalPapers }] = await db.select({ totalPapers: count() }).from(papersTable);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [{ questionsToday }] = await db.select({ questionsToday: count() })
      .from(questionsTable).where(gte(questionsTable.generatedAt, today));
    const [{ questionsThisMonth }] = await db.select({ questionsThisMonth: count() })
      .from(questionsTable).where(gte(questionsTable.generatedAt, monthStart));

    const [{ avgQualityScore }] = await db.select({ avgQualityScore: avg(questionsTable.qualityScore) }).from(questionsTable);

    const [{ totalJobsRunning }] = await db.select({ totalJobsRunning: count() })
      .from(generationJobsTable).where(sql`${generationJobsTable.status} IN ('pending', 'processing')`);

    res.json({
      totalQuestions: Number(totalQuestions),
      totalSubjects: Number(totalSubjects),
      totalChapters: Number(totalChapters),
      totalTopics: Number(totalTopics),
      questionsToday: Number(questionsToday),
      questionsThisMonth: Number(questionsThisMonth),
      totalBoards: Number(totalBoards),
      totalStandards: Number(totalStandards),
      activeProviders: Number(activeProviders),
      totalPapers: Number(totalPapers),
      avgQualityScore: parseFloat(String(avgQualityScore ?? 0)),
      totalJobsRunning: Number(totalJobsRunning),
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-subject", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ subjectName: subjectsTable.name, count: count() })
      .from(questionsTable)
      .leftJoin(subjectsTable, sql`${questionsTable.subjectId} = ${subjectsTable.id}`)
      .groupBy(subjectsTable.name)
      .orderBy(sql`count(*) DESC`)
      .limit(10);
    res.json(rows.map(r => ({ subjectName: r.subjectName ?? "Unknown", count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Questions by subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-difficulty", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ difficulty: questionsTable.difficulty, count: count() })
      .from(questionsTable)
      .groupBy(questionsTable.difficulty)
      .orderBy(questionsTable.difficulty);
    res.json(rows.map(r => ({ difficulty: r.difficulty, count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Questions by difficulty error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/model-usage", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        model: questionsTable.modelUsed,
        count: count(),
        avgQualityScore: avg(questionsTable.qualityScore),
      })
      .from(questionsTable)
      .where(sql`${questionsTable.modelUsed} IS NOT NULL`)
      .groupBy(questionsTable.modelUsed)
      .orderBy(sql`count(*) DESC`)
      .limit(10);
    res.json(rows.map(r => ({
      model: r.model ?? "Unknown",
      provider: "github_models",
      count: Number(r.count),
      avgQualityScore: parseFloat(String(r.avgQualityScore ?? 0)),
    })));
  } catch (err) {
    req.log.error({ err }, "Model usage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/recent-activity", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(50, parseInt((req.query["limit"] as string) ?? "10"));
    const logs = await db.select().from(activityLogsTable).orderBy(sql`${activityLogsTable.createdAt} DESC`).limit(limit);
    res.json(logs.map(l => ({
      id: l.id,
      jobId: l.jobId,
      action: l.action,
      description: l.description,
      questionsGenerated: l.questionsGenerated,
      model: l.model,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/monthly-report", requireAuth, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        EXTRACT(MONTH FROM generated_at)::int AS month,
        EXTRACT(YEAR FROM generated_at)::int AS year,
        TO_CHAR(generated_at, 'Mon YYYY') AS label,
        COUNT(*)::int AS count,
        ROUND(AVG(quality_score)::numeric, 2) AS avg_quality_score
      FROM questions
      WHERE generated_at >= NOW() - INTERVAL '12 months'
      GROUP BY month, year, label
      ORDER BY year, month
    `);
    res.json((rows as unknown[]).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      return {
        month: Number(row["month"]),
        year: Number(row["year"]),
        label: String(row["label"]),
        count: Number(row["count"]),
        avgQualityScore: parseFloat(String(row["avg_quality_score"] ?? 0)),
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Monthly report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
