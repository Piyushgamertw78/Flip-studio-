import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  framesTable,
  exportsTable,
} from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable);

  const [frameCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(framesTable);

  const [exportCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exportsTable);

  const recentProjects = await db
    .select({ name: projectsTable.name, updatedAt: projectsTable.updatedAt })
    .from(projectsTable)
    .orderBy(desc(projectsTable.updatedAt))
    .limit(5);

  res.json({
    totalProjects: projectCount?.count ?? 0,
    totalFrames: frameCount?.count ?? 0,
    totalExports: exportCount?.count ?? 0,
    recentActivity: recentProjects.map((p) => ({
      type: "project_updated",
      projectName: p.name,
      timestamp: p.updatedAt.toISOString(),
    })),
  });
});

router.get("/recent-projects", async (req, res) => {
  const limit = Number(req.query["limit"] ?? 5);

  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.updatedAt))
    .limit(limit);

  res.json(
    projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

export default router;
