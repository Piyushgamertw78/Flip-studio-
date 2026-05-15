// IndexedDB local database for FlipStudio — works fully offline on Android

  export interface Project {
    id: number;
    name: string;
    description: string;
    width: number;
    height: number;
    fps: number;
    backgroundColor: string;
    thumbnail: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface Frame {
    id: number;
    projectId: number;
    order: number;
    duration: number;
    canvasData: string;
    thumbnail: string;
    createdAt: string;
  }

  export interface Layer {
    id: number;
    frameId: number;
    projectId: number;
    name: string;
    order: number;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: string;
    canvasData: string;
    createdAt: string;
  }

  export interface ExportRecord {
    id: number;
    projectId: number;
    format: string;
    quality: string;
    status: "pending" | "processing" | "done" | "error";
    url: string;
    createdAt: string;
  }

  const DB_NAME = "flipstudio-db";
  const DB_VERSION = 2;

  let _db: IDBDatabase | null = null;

  function openDB(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("projects")) {
          const ps = db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
          ps.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("frames")) {
          const fs = db.createObjectStore("frames", { keyPath: "id", autoIncrement: true });
          fs.createIndex("projectId", "projectId");
          fs.createIndex("order", "order");
        }
        if (!db.objectStoreNames.contains("layers")) {
          const ls = db.createObjectStore("layers", { keyPath: "id", autoIncrement: true });
          ls.createIndex("frameId", "frameId");
          ls.createIndex("projectId", "projectId");
        }
        if (!db.objectStoreNames.contains("exports")) {
          const es = db.createObjectStore("exports", { keyPath: "id", autoIncrement: true });
          es.createIndex("projectId", "projectId");
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function getAll<T>(store: string): Promise<T[]> {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const req = t.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    }));
  }

  function getAllByIndex<T>(store: string, index: string, key: IDBValidKey): Promise<T[]> {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const req = t.objectStore(store).index(index).getAll(key);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    }));
  }

  export const db = {
    projects: {
      list: (): Promise<Project[]> => getAll<Project>("projects"),
      get: (id: number): Promise<Project | undefined> => tx("projects", "readonly", s => s.get(id)),
      create: (p: Omit<Project, "id">): Promise<number> => tx("projects", "readwrite", s => s.add(p)),
      update: (id: number, patch: Partial<Project>): Promise<void> =>
        tx<Project>("projects", "readwrite", s => s.get(id)).then(existing => {
          if (!existing) throw new Error("Project not found");
          return tx("projects", "readwrite", s => s.put({ ...existing, ...patch, id, updatedAt: new Date().toISOString() }));
        }),
      delete: (id: number): Promise<void> => tx("projects", "readwrite", s => s.delete(id)),
      duplicate: async (id: number): Promise<number> => {
        const proj = await tx<Project>("projects", "readonly", s => s.get(id));
        if (!proj) throw new Error("Project not found");
        const now = new Date().toISOString();
        const newId = await tx<number>("projects", "readwrite", s =>
          s.add({ ...proj, id: undefined as unknown as number, name: proj.name + " (Copy)", createdAt: now, updatedAt: now })
        );
        const frames = await db.frames.listByProject(id);
        for (const frame of frames) {
          const newFrameId = await db.frames.create({ ...frame, id: undefined as unknown as number, projectId: newId });
          const layers = await db.layers.listByFrame(frame.id);
          for (const layer of layers) {
            await db.layers.create({ ...layer, id: undefined as unknown as number, frameId: newFrameId, projectId: newId });
          }
        }
        return newId;
      },
    },
    frames: {
      listByProject: (projectId: number): Promise<Frame[]> =>
        getAllByIndex<Frame>("frames", "projectId", projectId).then(fs => fs.sort((a, b) => a.order - b.order)),
      get: (id: number): Promise<Frame | undefined> => tx("frames", "readonly", s => s.get(id)),
      create: (f: Omit<Frame, "id"> & { id?: number }): Promise<number> => tx("frames", "readwrite", s => s.add(f)),
      update: (id: number, patch: Partial<Frame>): Promise<void> =>
        tx<Frame>("frames", "readwrite", s => s.get(id)).then(existing => {
          if (!existing) throw new Error("Frame not found");
          return tx("frames", "readwrite", s => s.put({ ...existing, ...patch, id }));
        }),
      delete: (id: number): Promise<void> => tx("frames", "readwrite", s => s.delete(id)),
      duplicate: async (id: number): Promise<number> => {
        const frame = await tx<Frame>("frames", "readonly", s => s.get(id));
        if (!frame) throw new Error("Frame not found");
        const newId = await tx<number>("frames", "readwrite", s =>
          s.add({ ...frame, id: undefined as unknown as number, order: frame.order + 0.5, createdAt: new Date().toISOString() })
        );
        const all = await db.frames.listByProject(frame.projectId);
        for (let i = 0; i < all.length; i++) {
          await tx("frames", "readwrite", s => s.put({ ...all[i]!, order: i }));
        }
        const layers = await db.layers.listByFrame(id);
        for (const layer of layers) {
          await db.layers.create({ ...layer, id: undefined as unknown as number, frameId: newId, projectId: frame.projectId });
        }
        return newId;
      },
    },
    layers: {
      listByFrame: (frameId: number): Promise<Layer[]> =>
        getAllByIndex<Layer>("layers", "frameId", frameId).then(ls => ls.sort((a, b) => a.order - b.order)),
      listByProject: (projectId: number): Promise<Layer[]> =>
        getAllByIndex<Layer>("layers", "projectId", projectId),
      get: (id: number): Promise<Layer | undefined> => tx("layers", "readonly", s => s.get(id)),
      create: (l: Omit<Layer, "id"> & { id?: number }): Promise<number> => tx("layers", "readwrite", s => s.add(l)),
      update: (id: number, patch: Partial<Layer>): Promise<void> =>
        tx<Layer>("layers", "readwrite", s => s.get(id)).then(existing => {
          if (!existing) throw new Error("Layer not found");
          return tx("layers", "readwrite", s => s.put({ ...existing, ...patch, id }));
        }),
      delete: (id: number): Promise<void> => tx("layers", "readwrite", s => s.delete(id)),
    },
    exports: {
      listByProject: (projectId: number): Promise<ExportRecord[]> =>
        getAllByIndex<ExportRecord>("exports", "projectId", projectId),
      get: (id: number): Promise<ExportRecord | undefined> => tx("exports", "readonly", s => s.get(id)),
      create: (e: Omit<ExportRecord, "id">): Promise<number> => tx("exports", "readwrite", s => s.add(e)),
      update: (id: number, patch: Partial<ExportRecord>): Promise<void> =>
        tx<ExportRecord>("exports", "readwrite", s => s.get(id)).then(existing => {
          if (!existing) throw new Error("Export not found");
          return tx("exports", "readwrite", s => s.put({ ...existing, ...patch, id }));
        }),
    },
  };
  