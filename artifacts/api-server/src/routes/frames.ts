import { Router, Request } from "express";
import { db } from "@workspace/db";
import { framesTable, projectsTable } from "@workspace/db";
import { CreateFrameBody, UpdateFrameBody, ReorderFramesBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

type ProjectParams = { projectId: string };
type FrameParams = { projectId: string; frameId: string };

const router = Router({ mergeParams: true });

router.get("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);

  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  res.json(
    frames.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = CreateFrameBody.parse(req.body);

  const existingFrames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  const insertIndex = body.frameIndex ?? existingFrames.length;

  if (insertIndex < existingFrames.length) {
    for (const f of existingFrames) {
      if (f.frameIndex >= insertIndex) {
        await db
          .update(framesTable)
          .set({ frameIndex: f.frameIndex + 1, updatedAt: new Date() })
          .where(eq(framesTable.id, f.id));
      }
    }
  }

  const [frame] = await db
    .insert(framesTable)
    .values({
      projectId,
      frameIndex: insertIndex,
      duration: body.duration ?? 1,
      isHold: body.isHold ?? false,
      canvasData: body.canvasData,
    })
    .returning();

  if (!frame) {
    res.status(500).json({ error: "Failed to create frame" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ frameCount: existingFrames.length + 1, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  res.status(201).json({
    ...frame,
    createdAt: frame.createdAt.toISOString(),
    updatedAt: frame.updatedAt.toISOString(),
  });
});

router.patch("/reorder", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = ReorderFramesBody.parse(req.body);

  for (let i = 0; i < body.frameIds.length; i++) {
    const frameId = body.frameIds[i];
    if (frameId !== undefined) {
      await db
        .update(framesTable)
        .set({ frameIndex: i, updatedAt: new Date() })
        .where(eq(framesTable.id, frameId));
    }
  }

  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  res.json(
    frames.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }))
  );
});

router.get("/:frameId", async (req: Request<FrameParams>, res) => {
  const projectId = Number(req.params.projectId);
  const frameId = Number(req.params.frameId);

  const [frame] = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.id, frameId));

  if (!frame || frame.projectId !== projectId) {
    res.status(404).json({ error: "Frame not found" });
    return;
  }

  res.json({
    ...frame,
    createdAt: frame.createdAt.toISOString(),
    updatedAt: frame.updatedAt.toISOString(),
  });
});

router.patch("/:frameId", async (req: Request<FrameParams>, res) => {
  const projectId = Number(req.params.projectId);
  const frameId = Number(req.params.frameId);
  const body = UpdateFrameBody.parse(req.body);

  const [frame] = await db
    .update(framesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(framesTable.id, frameId))
    .returning();

  if (!frame || frame.projectId !== projectId) {
    res.status(404).json({ error: "Frame not found" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  res.json({
    ...frame,
    createdAt: frame.createdAt.toISOString(),
    updatedAt: frame.updatedAt.toISOString(),
  });
});

router.delete("/:frameId", async (req: Request<FrameParams>, res) => {
  const projectId = Number(req.params.projectId);
  const frameId = Number(req.params.frameId);

  const [frame] = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.id, frameId));

  if (!frame || frame.projectId !== projectId) {
    res.status(404).json({ error: "Frame not found" });
    return;
  }

  await db.delete(framesTable).where(eq(framesTable.id, frameId));

  const remaining = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  for (let i = 0; i < remaining.length; i++) {
    const f = remaining[i];
    if (f && f.frameIndex !== i) {
      await db
        .update(framesTable)
        .set({ frameIndex: i, updatedAt: new Date() })
        .where(eq(framesTable.id, f.id));
    }
  }

  await db
    .update(projectsTable)
    .set({ frameCount: remaining.length, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  res.status(204).send();
});

router.post("/:frameId/duplicate", async (req: Request<FrameParams>, res) => {
  const projectId = Number(req.params.projectId);
  const frameId = Number(req.params.frameId);

  const [original] = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.id, frameId));

  if (!original || original.projectId !== projectId) {
    res.status(404).json({ error: "Frame not found" });
    return;
  }

  const insertIndex = original.frameIndex + 1;

  const allFrames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  for (const f of allFrames) {
    if (f.frameIndex >= insertIndex) {
      await db
        .update(framesTable)
        .set({ frameIndex: f.frameIndex + 1, updatedAt: new Date() })
        .where(eq(framesTable.id, f.id));
    }
  }

  const [duplicate] = await db
    .insert(framesTable)
    .values({
      projectId,
      frameIndex: insertIndex,
      duration: original.duration,
      isHold: original.isHold,
      canvasData: original.canvasData,
      thumbnailData: original.thumbnailData,
    })
    .returning();

  if (!duplicate) {
    res.status(500).json({ error: "Failed to duplicate frame" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ frameCount: allFrames.length + 1, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  res.status(201).json({
    ...duplicate,
    createdAt: duplicate.createdAt.toISOString(),
    updatedAt: duplicate.updatedAt.toISOString(),
  });
});

export default router;
