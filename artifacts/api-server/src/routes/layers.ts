import { Router, Request } from "express";
import { db } from "@workspace/db";
import { layersTable } from "@workspace/db";
import { CreateLayerBody, UpdateLayerBody, ReorderLayersBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

type ProjectParams = { projectId: string };
type LayerParams = { projectId: string; layerId: string };

const router = Router({ mergeParams: true });

router.get("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);

  const layers = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.projectId, projectId))
    .orderBy(layersTable.layerIndex);

  res.json(
    layers.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = CreateLayerBody.parse(req.body);

  const existing = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.projectId, projectId));

  const layerIndex = body.layerIndex ?? existing.length;

  const [layer] = await db
    .insert(layersTable)
    .values({
      projectId,
      frameId: body.frameId,
      name: body.name,
      layerIndex,
      opacity: body.opacity ?? 1.0,
      blendMode: body.blendMode ?? "normal",
    })
    .returning();

  if (!layer) {
    res.status(500).json({ error: "Failed to create layer" });
    return;
  }

  res.status(201).json({
    ...layer,
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  });
});

router.patch("/reorder", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = ReorderLayersBody.parse(req.body);

  for (let i = 0; i < body.layerIds.length; i++) {
    const layerId = body.layerIds[i];
    if (layerId !== undefined) {
      await db
        .update(layersTable)
        .set({ layerIndex: i, updatedAt: new Date() })
        .where(eq(layersTable.id, layerId));
    }
  }

  const layers = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.projectId, projectId))
    .orderBy(layersTable.layerIndex);

  res.json(
    layers.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }))
  );
});

router.patch("/:layerId", async (req: Request<LayerParams>, res) => {
  const projectId = Number(req.params.projectId);
  const layerId = Number(req.params.layerId);
  const body = UpdateLayerBody.parse(req.body);

  const [layer] = await db
    .update(layersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(layersTable.id, layerId))
    .returning();

  if (!layer || layer.projectId !== projectId) {
    res.status(404).json({ error: "Layer not found" });
    return;
  }

  res.json({
    ...layer,
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  });
});

router.delete("/:layerId", async (req: Request<LayerParams>, res) => {
  const projectId = Number(req.params.projectId);
  const layerId = Number(req.params.layerId);

  const [layer] = await db
    .select()
    .from(layersTable)
    .where(eq(layersTable.id, layerId));

  if (!layer || layer.projectId !== projectId) {
    res.status(404).json({ error: "Layer not found" });
    return;
  }

  await db.delete(layersTable).where(eq(layersTable.id, layerId));
  res.status(204).send();
});

export default router;
