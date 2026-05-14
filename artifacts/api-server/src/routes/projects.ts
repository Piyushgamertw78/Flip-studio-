import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  framesTable,
  layersTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  UpdateProjectThumbnailBody,
} from "@workspace/api-zod";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Number(req.query["limit"] ?? 50);
  const offset = Number(req.query["offset"] ?? 0);

  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  res.json(
    projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);

  const [project] = await db
    .insert(projectsTable)
    .values({
      name: body.name,
      description: body.description,
      fps: body.fps ?? 12,
      canvasWidth: body.canvasWidth ?? 1920,
      canvasHeight: body.canvasHeight ?? 1080,
      backgroundColor: body.backgroundColor ?? "#ffffff",
    })
    .returning();

  if (!project) {
    res.status(500).json({ error: "Failed to create project" });
    return;
  }

  // Create default first frame and layer
  const [frame] = await db
    .insert(framesTable)
    .values({ projectId: project.id, frameIndex: 0, duration: 1 })
    .returning();

  await db
    .insert(layersTable)
    .values({ projectId: project.id, name: "Layer 1", layerIndex: 0 });

  if (frame) {
    await db
      .update(projectsTable)
      .set({ frameCount: 1, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id));
    project.frameCount = 1;
  }

  res.status(201).json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params["projectId"]);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  const layers = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.projectId, projectId))
    .orderBy(layersTable.layerIndex);

  res.json({
    ...project,
    frames: frames.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    layers: layers.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.patch("/:projectId", async (req, res) => {
  const projectId = Number(req.params["projectId"]);
  const body = UpdateProjectBody.parse(req.body);

  const [project] = await db
    .update(projectsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.delete("/:projectId", async (req, res) => {
  const projectId = Number(req.params["projectId"]);

  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  res.status(204).send();
});

router.post("/:projectId/duplicate", async (req, res) => {
  const projectId = Number(req.params["projectId"]);

  const [original] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!original) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [duplicate] = await db
    .insert(projectsTable)
    .values({
      name: `${original.name} (Copy)`,
      description: original.description,
      fps: original.fps,
      canvasWidth: original.canvasWidth,
      canvasHeight: original.canvasHeight,
      backgroundColor: original.backgroundColor,
      thumbnailData: original.thumbnailData,
    })
    .returning();

  if (!duplicate) {
    res.status(500).json({ error: "Failed to duplicate project" });
    return;
  }

  // Duplicate frames
  const originalFrames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.projectId, projectId))
    .orderBy(framesTable.frameIndex);

  if (originalFrames.length > 0) {
    await db.insert(framesTable).values(
      originalFrames.map((f) => ({
        projectId: duplicate.id,
        frameIndex: f.frameIndex,
        duration: f.duration,
        isHold: f.isHold,
        canvasData: f.canvasData,
        thumbnailData: f.thumbnailData,
      }))
    );
  }

  // Duplicate layers
  const originalLayers = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.projectId, projectId))
    .orderBy(layersTable.layerIndex);

  if (originalLayers.length > 0) {
    await db.insert(layersTable).values(
      originalLayers.map((l) => ({
        projectId: duplicate.id,
        name: l.name,
        layerIndex: l.layerIndex,
        isVisible: l.isVisible,
        isLocked: l.isLocked,
        opacity: l.opacity,
        blendMode: l.blendMode,
      }))
    );
  }

  await db
    .update(projectsTable)
    .set({ frameCount: originalFrames.length, updatedAt: new Date() })
    .where(eq(projectsTable.id, duplicate.id));

  duplicate.frameCount = originalFrames.length;

  res.status(201).json({
    ...duplicate,
    createdAt: duplicate.createdAt.toISOString(),
    updatedAt: duplicate.updatedAt.toISOString(),
  });
});

router.put("/:projectId/thumbnail", async (req, res) => {
  const projectId = Number(req.params["projectId"]);
  const body = UpdateProjectThumbnailBody.parse(req.body);

  const [project] = await db
    .update(projectsTable)
    .set({ thumbnailData: body.thumbnailData, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

export default router;
