import { Router, Request } from "express";
import { db } from "@workspace/db";
import { audioTracksTable } from "@workspace/db";
import { CreateAudioTrackBody, UpdateAudioTrackBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

type ProjectParams = { projectId: string };
type AudioParams = { projectId: string; audioId: string };

const router = Router({ mergeParams: true });

router.get("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);

  const tracks = await db
    .select()
    .from(audioTracksTable)
    .where(eq(audioTracksTable.projectId, projectId))
    .orderBy(audioTracksTable.createdAt);

  res.json(
    tracks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req: Request<ProjectParams>, res) => {
  const projectId = Number(req.params.projectId);
  const body = CreateAudioTrackBody.parse(req.body);

  const [track] = await db
    .insert(audioTracksTable)
    .values({
      projectId,
      name: body.name,
      audioData: body.audioData,
      startFrame: body.startFrame ?? 0,
      volume: body.volume ?? 1.0,
    })
    .returning();

  if (!track) {
    res.status(500).json({ error: "Failed to create audio track" });
    return;
  }

  res.status(201).json({
    ...track,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  });
});

router.patch("/:audioId", async (req: Request<AudioParams>, res) => {
  const projectId = Number(req.params.projectId);
  const audioId = Number(req.params.audioId);
  const body = UpdateAudioTrackBody.parse(req.body);

  const [track] = await db
    .update(audioTracksTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(audioTracksTable.id, audioId))
    .returning();

  if (!track || track.projectId !== projectId) {
    res.status(404).json({ error: "Audio track not found" });
    return;
  }

  res.json({
    ...track,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  });
});

router.delete("/:audioId", async (req: Request<AudioParams>, res) => {
  const projectId = Number(req.params.projectId);
  const audioId = Number(req.params.audioId);

  const [track] = await db
    .select()
    .from(audioTracksTable)
    .where(eq(audioTracksTable.id, audioId));

  if (!track || track.projectId !== projectId) {
    res.status(404).json({ error: "Audio track not found" });
    return;
  }

  await db.delete(audioTracksTable).where(eq(audioTracksTable.id, audioId));
  res.status(204).send();
});

export default router;
