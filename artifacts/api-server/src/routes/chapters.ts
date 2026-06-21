import { Router } from "express";
import { db } from "@workspace/db";
import { chaptersTable, subjectsTable, topicsTable, questionsTable } from "@workspace/db";
import { eq, ilike, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/chapters", requireAuth, async (req, res) => {
  try {
    const { subjectId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (subjectId) conditions.push(eq(chaptersTable.subjectId, parseInt(subjectId)));
    if (search) conditions.push(ilike(chaptersTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(chaptersTable).where(where);
    const rows = await db
      .select({ c: chaptersTable, subjectName: subjectsTable.name })
      .from(chaptersTable)
      .leftJoin(subjectsTable, eq(chaptersTable.subjectId, subjectsTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(chaptersTable.orderIndex);

    const withCounts = await Promise.all(
      rows.map(async ({ c, subjectName }) => {
        const [{ topics }] = await db.select({ topics: count() }).from(topicsTable).where(eq(topicsTable.chapterId, c.id));
        const [{ questions }] = await db.select({ questions: count() }).from(questionsTable).where(eq(questionsTable.chapterId, c.id));
        return { ...c, subjectName, topicsCount: Number(topics), questionsCount: Number(questions) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List chapters error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chapters", requireAuth, async (req, res) => {
  try {
    const { name, orderIndex = 0, subjectId, isActive = true } = req.body;
    const [c] = await db.insert(chaptersTable).values({ name, orderIndex, subjectId, isActive }).returning();
    res.status(201).json({ ...c, subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    const { name, orderIndex, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (orderIndex !== undefined) updates["orderIndex"] = orderIndex;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [c] = await db.update(chaptersTable).set(updates).where(eq(chaptersTable.id, id)).returning();
    if (!c) { res.status(404).json({ error: "Chapter not found" }); return; }
    res.json({ ...c, subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    await db.delete(chaptersTable).where(eq(chaptersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
