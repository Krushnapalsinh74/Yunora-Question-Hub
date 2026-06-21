import { Router } from "express";
import { db } from "@workspace/db";
import { topicsTable, chaptersTable, questionsTable } from "@workspace/db";
import { eq, ilike, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/topics", requireAuth, async (req, res) => {
  try {
    const { chapterId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (chapterId) conditions.push(eq(topicsTable.chapterId, parseInt(chapterId)));
    if (search) conditions.push(ilike(topicsTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(topicsTable).where(where);
    const rows = await db
      .select({ t: topicsTable, chapterName: chaptersTable.name })
      .from(topicsTable)
      .leftJoin(chaptersTable, eq(topicsTable.chapterId, chaptersTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(topicsTable.name);

    const withCounts = await Promise.all(
      rows.map(async ({ t, chapterName }) => {
        const [{ questions }] = await db.select({ questions: count() }).from(questionsTable).where(eq(questionsTable.topicId, t.id));
        return { ...t, chapterName, questionsCount: Number(questions) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List topics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/topics", requireAuth, async (req, res) => {
  try {
    const { name, description, chapterId, isActive = true } = req.body;
    const [t] = await db.insert(topicsTable).values({ name, description, chapterId, isActive }).returning();
    res.status(201).json({ ...t, chapterName: null, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    const { name, description, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (description !== undefined) updates["description"] = description;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [t] = await db.update(topicsTable).set(updates).where(eq(topicsTable.id, id)).returning();
    if (!t) { res.status(404).json({ error: "Topic not found" }); return; }
    res.json({ ...t, chapterName: null, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    await db.delete(topicsTable).where(eq(topicsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
