import { Router, Request } from "express";
import { db } from "@workspace/db";
import { exportsTable } from "@workspace/db";
import { CreateExportBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

type ProjectParams = { projectId: string };
type ExportParams = { projectId: string; exportId: string };

const router = Router({ mergeParams: true });

router.get("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);

  const exports = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.projectId, projectId))
    .orderBy(exportsTable.createdAt);

  res.json(
    exports.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = CreateExportBody.parse(req.body);

  const [exportJob] = await db
    .insert(exportsTable)
    .values({
      projectId,
      format: body.format,
      quality: body.quality ?? "high",
      fps: body.fps,
      width: body.width,
      height: body.height,
      transparentBackground: body.transparentBackground ?? false,
      status: "pending",
      progress: 0,
    })
    .returning();

  if (!exportJob) {
    res.status(500).json({ error: "Failed to create export job" });
    return;
  }

  // Simulate async export processing with progress
  setTimeout(async () => {
    try {
      await db
        .update(exportsTable)
        .set({ status: "processing", progress: 0.1, updatedAt: new Date() })
        .where(eq(exportsTable.id, exportJob.id));

      const steps = [0.3, 0.5, 0.7, 0.9];
      for (const progress of steps) {
        await new Promise((r) => setTimeout(r, 500));
        await db
          .update(exportsTable)
          .set({ progress, updatedAt: new Date() })
          .where(eq(exportsTable.id, exportJob.id));
      }

      await db
        .update(exportsTable)
        .set({
          status: "completed",
          progress: 1.0,
          fileUrl: `/api/projects/${projectId}/exports/${exportJob.id}/download`,
          fileSize: Math.floor(Math.random() * 5000000) + 100000,
          updatedAt: new Date(),
        })
        .where(eq(exportsTable.id, exportJob.id));
    } catch {
      await db
        .update(exportsTable)
        .set({
          status: "failed",
          errorMessage: "Export processing failed",
          updatedAt: new Date(),
        })
        .where(eq(exportsTable.id, exportJob.id));
    }
  }, 100);

  res.status(201).json({
    ...exportJob,
    createdAt: exportJob.createdAt.toISOString(),
    updatedAt: exportJob.updatedAt.toISOString(),
  });
});

router.get("/:exportId", async (req: Request<ExportParams>, res) => {
  const projectId = Number(req.params.projectId);
  const exportId = Number(req.params.exportId);

  const [exportJob] = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.id, exportId));

  if (!exportJob || exportJob.projectId !== projectId) {
    res.status(404).json({ error: "Export not found" });
    return;
  }

  res.json({
    ...exportJob,
    createdAt: exportJob.createdAt.toISOString(),
    updatedAt: exportJob.updatedAt.toISOString(),
  });
});

export default router;
