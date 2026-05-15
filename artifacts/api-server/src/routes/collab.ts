import { Router } from "express";
  import { logger } from "../lib/logger";

  const router = Router();

  // In-memory room store: roomId -> Set of SSE clients
  const rooms = new Map<string, Set<{ send: (data: string) => void; close: () => void }>>();

  function getOrCreateRoom(roomId: string) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    return rooms.get(roomId)!;
  }

  // GET /api/collab/rooms/:roomId/join — SSE stream
  router.get("/rooms/:roomId/join", (req, res) => {
    const { roomId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const client = {
      send: (data: string) => res.write("data: " + data + "\n\n"),
      close: () => res.end(),
    };

    const room = getOrCreateRoom(roomId);
    room.add(client);
    logger.info({ roomId, size: room.size }, "collab: client joined");

    // Send welcome
    client.send(JSON.stringify({ type: "welcome", roomId, peers: room.size - 1 }));

    // Notify others
    room.forEach(c => {
      if (c !== client) c.send(JSON.stringify({ type: "peer_joined", peers: room.size }));
    });

    req.on("close", () => {
      room.delete(client);
      logger.info({ roomId, size: room.size }, "collab: client left");
      room.forEach(c => c.send(JSON.stringify({ type: "peer_left", peers: room.size })));
      if (room.size === 0) rooms.delete(roomId);
    });
  });

  // POST /api/collab/rooms/:roomId/broadcast — send stroke to all peers
  router.post("/rooms/:roomId/broadcast", (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }

    const payload = JSON.stringify({ type: "stroke", ...req.body });
    room.forEach(c => c.send(payload));
    res.json({ ok: true, peers: room.size });
  });

  // GET /api/collab/rooms/:roomId/info
  router.get("/rooms/:roomId/info", (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    res.json({ roomId, peers: room?.size ?? 0, exists: !!room });
  });

  export default router;
  