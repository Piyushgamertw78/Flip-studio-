// IndexedDB local database for FlipStudio — 100% offline on Android

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
  audioTrack?: string; // base64 audio
  tags?: string[];
}

export interface Frame {
  id: number;
  projectId: number;
  order: number;
  duration: number; // in ms, 0 = use project fps
  canvasData: string;
  thumbnail: string;
  createdAt: string;
  label?: string;
  hold?: number; // frame hold count
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
  clipped?: boolean; // clipping mask
}

const DB_NAME = "flipstudio-db";
const DB_VERSION = 5;
let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const oldVersion = e.oldVersion;
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
      // Palette store for custom color palettes
      if (!db.objectStoreNames.contains("palettes")) {
        const pal = db.createObjectStore("palettes", { keyPath: "id", autoIncrement: true });
        pal.createIndex("name", "name");
      }
      void oldVersion; // suppress lint
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

function getAll<T>(store: string): Promise<T[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, "readonly");
    const r = t.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error);
  }));
}

export interface Palette {
  id: number;
  name: string;
  colors: string[];
  createdAt: string;
}

export const db = {
  projects: {
    list: () => getAll<Project>("projects").then(ps => ps.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())),
    get: (id: number) => tx<Project>("projects", "readonly", s => s.get(id)),
    create: (data: Omit<Project, "id">) => tx<number>("projects", "readwrite", s => s.add(data) as IDBRequest<number>),
    update: (id: number, data: Partial<Project>) => openDB().then(db => new Promise<void>((resolve, reject) => {
      const t = db.transaction("projects", "readwrite");
      const s = t.objectStore("projects");
      const r = s.get(id);
      r.onsuccess = () => {
        const updated = { ...r.result as Project, ...data, updatedAt: new Date().toISOString() };
        s.put(updated).onsuccess = () => resolve();
      };
      r.onerror = () => reject(r.error);
    })),
    delete: async (id: number) => {
      const frames = await db.frames.listByProject(id);
      for (const f of frames) {
        const layers = await db.layers.listByFrame(f.id);
        for (const l of layers) await db.layers.delete(l.id);
        await db.frames.delete(f.id);
      }
      return tx<undefined>("projects", "readwrite", s => s.delete(id) as IDBRequest<undefined>);
    },
    duplicate: async (id: number) => {
      const proj = await db.projects.get(id);
      if (!proj) return;
      const frames = await db.frames.listByProject(id);
      const now = new Date().toISOString();
      const { id: _pid, ...projData } = proj;
      const newProjId = await db.projects.create({ ...projData, name: proj.name + " (Copy)", createdAt: now, updatedAt: now });
      for (const frame of frames) {
        const layers = await db.layers.listByFrame(frame.id);
        const { id: _fid, ...frameData } = frame;
        const newFrameId = await db.frames.create({ ...frameData, projectId: newProjId, createdAt: now });
        for (const layer of layers) {
          const { id: _lid, ...layerData } = layer;
          await db.layers.create({ ...layerData, frameId: newFrameId, projectId: newProjId, createdAt: now });
        }
      }
      return newProjId;
    },
  },

  frames: {
    listByProject: (projectId: number) => getAll<Frame>("frames").then(fs =>
      fs.filter(f => f.projectId === projectId).sort((a, b) => a.order - b.order)
    ),
    get: (id: number) => tx<Frame>("frames", "readonly", s => s.get(id)),
    create: (data: Omit<Frame, "id">) => tx<number>("frames", "readwrite", s => s.add(data) as IDBRequest<number>),
    update: (id: number, data: Partial<Frame>) => openDB().then(db => new Promise<void>((res, rej) => {
      const t = db.transaction("frames", "readwrite");
      const s = t.objectStore("frames");
      const r = s.get(id);
      r.onsuccess = () => { s.put({ ...r.result as Frame, ...data }).onsuccess = () => res(); };
      r.onerror = () => rej(r.error);
    })),
    delete: (id: number) => tx<undefined>("frames", "readwrite", s => s.delete(id) as IDBRequest<undefined>),
    duplicate: async (frameId: number) => {
      const frame = await db.frames.get(frameId);
      if (!frame) return;
      const layers = await db.layers.listByFrame(frameId);
      const now = new Date().toISOString();
      const { id: _fid, ...frameData } = frame;
      const newFrameId = await db.frames.create({ ...frameData, order: frame.order + 1, createdAt: now });
      for (const l of layers) {
        const { id: _lid, ...layerData } = l;
        await db.layers.create({ ...layerData, frameId: newFrameId, createdAt: now });
      }
      return newFrameId;
    },
  },

  layers: {
    listByFrame: (frameId: number) => getAll<Layer>("layers").then(ls =>
      ls.filter(l => l.frameId === frameId).sort((a, b) => a.order - b.order)
    ),
    listByProject: (projectId: number) => getAll<Layer>("layers").then(ls =>
      ls.filter(l => l.projectId === projectId)
    ),
    get: (id: number) => tx<Layer>("layers", "readonly", s => s.get(id)),
    create: (data: Omit<Layer, "id">) => tx<number>("layers", "readwrite", s => s.add(data) as IDBRequest<number>),
    update: (id: number, data: Partial<Layer>) => openDB().then(db => new Promise<void>((res, rej) => {
      const t = db.transaction("layers", "readwrite");
      const s = t.objectStore("layers");
      const r = s.get(id);
      r.onsuccess = () => { s.put({ ...r.result as Layer, ...data }).onsuccess = () => res(); };
      r.onerror = () => rej(r.error);
    })),
    delete: (id: number) => tx<undefined>("layers", "readwrite", s => s.delete(id) as IDBRequest<undefined>),
    duplicate: async (layerId: number) => {
      const layer = await db.layers.get(layerId);
      if (!layer) return;
      const now = new Date().toISOString();
      const { id: _lid, ...layerData } = layer;
      return db.layers.create({ ...layerData, name: layer.name + " Copy", order: layer.order + 1, createdAt: now });
    },
  },

  palettes: {
    list: () => getAll<Palette>("palettes"),
    get: (id: number) => tx<Palette>("palettes", "readonly", s => s.get(id)),
    create: (data: Omit<Palette, "id">) => tx<number>("palettes", "readwrite", s => s.add(data) as IDBRequest<number>),
    update: (id: number, data: Partial<Palette>) => openDB().then(db => new Promise<void>((res, rej) => {
      const t = db.transaction("palettes", "readwrite");
      const s = t.objectStore("palettes");
      const r = s.get(id);
      r.onsuccess = () => { s.put({ ...r.result as Palette, ...data }).onsuccess = () => res(); };
      r.onerror = () => rej(r.error);
    })),
    delete: (id: number) => tx<undefined>("palettes", "readwrite", s => s.delete(id) as IDBRequest<undefined>),
  },
};
