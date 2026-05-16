export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const STORAGE_KEY_PREFIX = "flipstudio_db_";

// ---------------------------------------------------------------------------
// Local-First Mock Implementation
// ---------------------------------------------------------------------------

function getLocalData<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
}

async function handleLocalRequest(url: string, init: RequestInit): Promise<any> {
  const method = (init.method || "GET").toUpperCase();
  const urlObj = new URL(url, "http://localhost");
  const path = urlObj.pathname;

  const userStr = localStorage.getItem("flipstudio_user");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || "anonymous";

  console.log(`[Local-First] ${method} ${path}`);

  // Dashboard Stats
  if (path === "/api/stats/dashboard" && method === "GET") {
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const totalFrames = projects.reduce((acc, p) => acc + (p.frameCount || 0), 0);
    return {
      totalProjects: projects.length,
      totalFrames: totalFrames,
      totalExports: 0,
      recentActivity: []
    };
  }

  // Projects List / Create
  if (path === "/api/projects" || path === "/api/projects/") {
    const projects = getLocalData<any[]>("projects_" + userId, []);
    if (method === "GET") return projects;
    if (method === "POST") {
      const body = JSON.parse(init.body as string);
      const newProject = {
        ...body,
        id: Date.now(),
        userId,
        frameCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLocalData("projects_" + userId, [newProject, ...projects]);
      
      // Default Frame & Layer
      const initialFrame = { id: Date.now() + 1, projectId: newProject.id, frameIndex: 0, canvasData: JSON.stringify({ strokes: [] }), duration: 1, createdAt: new Date().toISOString() };
      setLocalData(`frames_${newProject.id}`, [initialFrame]);
      
      const initialLayer = { id: Date.now() + 2, projectId: newProject.id, name: "Layer 1", layerIndex: 0, isVisible: true, isLocked: false, opacity: 100, createdAt: new Date().toISOString() };
      setLocalData(`layers_${newProject.id}`, [initialLayer]);
      
      return newProject;
    }
  }

  // Project Details
  const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
  if (projectMatch) {
    const projectId = parseInt(projectMatch[1]);
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const project = projects.find(p => p.id === projectId);
    if (method === "GET") return project;
    if (method === "PATCH") {
      const body = JSON.parse(init.body as string);
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx > -1) {
        projects[idx] = { ...projects[idx], ...body, updatedAt: new Date().toISOString() };
        setLocalData("projects_" + userId, projects);
        return projects[idx];
      }
    }
    if (method === "DELETE") {
      setLocalData("projects_" + userId, projects.filter(p => p.id !== projectId));
      localStorage.removeItem(STORAGE_KEY_PREFIX + `frames_${projectId}`);
      localStorage.removeItem(STORAGE_KEY_PREFIX + `layers_${projectId}`);
      return { success: true };
    }
  }

  // Duplicate Project
  const duplicateProjMatch = path.match(/^\/api\/projects\/(\d+)\/duplicate$/);
  if (duplicateProjMatch && method === "POST") {
    const projectId = parseInt(duplicateProjMatch[1]);
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const source = projects.find(p => p.id === projectId);
    if (source) {
      const newId = Date.now();
      const newProject = { ...source, id: newId, name: `${source.name} (Copy)`, createdAt: new Date().toISOString() };
      setLocalData("projects_" + userId, [newProject, ...projects]);
      setLocalData(`frames_${newId}`, getLocalData(`frames_${projectId}`, []).map(f => ({ ...f, id: Math.random(), projectId: newId })));
      setLocalData(`layers_${newId}`, getLocalData(`layers_${projectId}`, []).map(l => ({ ...l, id: Math.random(), projectId: newId })));
      return newProject;
    }
  }

  // Frames List / Create
  const framesMatch = path.match(/^\/api\/projects\/(\d+)\/frames$/);
  if (framesMatch) {
    const projectId = parseInt(framesMatch[1]);
    const frames = getLocalData<any[]>(`frames_${projectId}`, []);
    if (method === "GET") return frames;
    if (method === "POST") {
      const body = JSON.parse(init.body as string);
      const newFrame = { ...body, id: Date.now(), projectId, createdAt: new Date().toISOString() };
      const updated = [...frames, newFrame];
      setLocalData(`frames_${projectId}`, updated);
      // Update project count
      const projects = getLocalData<any[]>("projects_" + userId, []);
      const pIdx = projects.findIndex(p => p.id === projectId);
      if (pIdx > -1) { projects[pIdx].frameCount = updated.length; setLocalData("projects_" + userId, projects); }
      return newFrame;
    }
  }

  // Specific Frame Update / Delete (Crucial for Studio drawing)
  const frameUpdateMatch = path.match(/^\/api\/projects\/(\d+)\/frames\/(\d+)$/);
  if (frameUpdateMatch) {
    const projectId = parseInt(frameUpdateMatch[1]);
    const frameId = parseInt(frameUpdateMatch[2]);
    const frames = getLocalData<any[]>(`frames_${projectId}`, []);
    const idx = frames.findIndex(f => f.id === frameId);
    if (idx > -1) {
      if (method === "PATCH") {
        const body = JSON.parse(init.body as string);
        frames[idx] = { ...frames[idx], ...body, updatedAt: new Date().toISOString() };
        setLocalData(`frames_${projectId}`, frames);
        return frames[idx];
      }
      if (method === "DELETE") {
        const updated = frames.filter(f => f.id !== frameId);
        setLocalData(`frames_${projectId}`, updated);
        return { success: true };
      }
    }
  }

  // Layers List / Create
  const layersMatch = path.match(/^\/api\/projects\/(\d+)\/layers$/);
  if (layersMatch) {
    const projectId = parseInt(layersMatch[1]);
    const layers = getLocalData<any[]>(`layers_${projectId}`, []);
    if (method === "GET") return layers;
    if (method === "POST") {
      const body = JSON.parse(init.body as string);
      const newLayer = { ...body, id: Date.now(), projectId, isVisible: true, isLocked: false, opacity: 100, createdAt: new Date().toISOString() };
      setLocalData(`layers_${projectId}`, [...layers, newLayer]);
      return newLayer;
    }
  }

  // Specific Layer Update
  const layerUpdateMatch = path.match(/^\/api\/projects\/(\d+)\/layers\/(\d+)$/);
  if (layerUpdateMatch && method === "PATCH") {
    const projectId = parseInt(layerUpdateMatch[1]);
    const layerId = parseInt(layerUpdateMatch[2]);
    const layers = getLocalData<any[]>(`layers_${projectId}`, []);
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx > -1) {
      const body = JSON.parse(init.body as string);
      layers[idx] = { ...layers[idx], ...body, updatedAt: new Date().toISOString() };
      setLocalData(`layers_${projectId}`, layers);
      return layers[idx];
    }
  }

  if (path === "/api/healthz") return { status: "ok" };
  return {};
}

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void { _baseUrl = url; }
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void { _authTokenGetter = getter; }

export class ApiError<T = unknown> extends Error {
  readonly status: number;
  constructor(response: Response, public data: T | null) {
    super("API Error");
    this.status = response.status;
  }
}

export async function customFetch<T = unknown>(input: RequestInfo | URL, options: CustomFetchOptions = {}): Promise<T> {
  const url = typeof input === "string" ? input : (input as any).url || input.toString();
  if (url.includes("/api/")) return handleLocalRequest(url, options) as Promise<T>;
  const response = await fetch(input, options);
  return (await response.json()) as T;
}
