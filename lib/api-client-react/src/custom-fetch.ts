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
  // Remove query params for path matching
  const urlObj = new URL(url, "http://localhost");
  const path = urlObj.pathname;
  const params = urlObj.searchParams;

  // Helper to get current user
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
    if (method === "GET") {
      return projects;
    }
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
      const updated = [newProject, ...projects];
      setLocalData("projects_" + userId, updated);
      
      // Create initial frame for new project
      const initialFrame = {
        id: Date.now() + 1,
        projectId: newProject.id,
        frameIndex: 0,
        canvasData: JSON.stringify({ strokes: [] }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLocalData(`frames_${newProject.id}`, [initialFrame]);
      
      return newProject;
    }
  }

  // Specific Project Details / Update / Delete
  const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
  if (projectMatch) {
    const projectId = parseInt(projectMatch[1]);
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const project = projects.find(p => p.id === projectId);

    if (method === "GET") {
      if (!project) throw new Error("Project not found");
      return project;
    }
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
      const updated = projects.filter(p => p.id !== projectId);
      setLocalData("projects_" + userId, updated);
      localStorage.removeItem(STORAGE_KEY_PREFIX + `frames_${projectId}`);
      return { success: true };
    }
  }

  // Duplicate Project
  const duplicateMatch = path.match(/^\/api\/projects\/(\d+)\/duplicate$/);
  if (duplicateMatch && method === "POST") {
    const projectId = parseInt(duplicateMatch[1]);
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const source = projects.find(p => p.id === projectId);
    if (source) {
      const newId = Date.now();
      const newProject = {
        ...source,
        id: newId,
        name: `${source.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLocalData("projects_" + userId, [newProject, ...projects]);
      
      // Copy frames
      const sourceFrames = getLocalData<any[]>(`frames_${projectId}`, []);
      const newFrames = sourceFrames.map(f => ({ 
        ...f, 
        id: Date.now() + Math.random(), 
        projectId: newId 
      }));
      setLocalData(`frames_${newId}`, newFrames);
      
      return newProject;
    }
  }

  // Project Frames
  const framesMatch = path.match(/^\/api\/projects\/(\d+)\/frames$/);
  if (framesMatch) {
    const projectId = parseInt(framesMatch[1]);
    const frames = getLocalData<any[]>(`frames_${projectId}`, []);

    if (method === "GET") {
      return frames;
    }
    if (method === "POST") {
      const body = JSON.parse(init.body as string);
      const newFrame = {
        ...body,
        id: Date.now(),
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [...frames, newFrame];
      setLocalData(`frames_${projectId}`, updated);
      
      // Update project frame count
      const projects = getLocalData<any[]>("projects_" + userId, []);
      const pIdx = projects.findIndex(p => p.id === projectId);
      if (pIdx > -1) {
        projects[pIdx].frameCount = updated.length;
        setLocalData("projects_" + userId, projects);
      }
      
      return newFrame;
    }
  }

  // Specific Frame Operations
  const frameOpMatch = path.match(/^\/api\/frames\/(\d+)$/);
  if (frameOpMatch) {
    const frameId = parseInt(frameOpMatch[1]);
    
    // Find project containing this frame
    let targetProjectId = null;
    let frames: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX + "frames_")) {
        const f = JSON.parse(localStorage.getItem(key) || "[]");
        if (f.find((frame: any) => frame.id === frameId)) {
          targetProjectId = key.replace(STORAGE_KEY_PREFIX + "frames_", "");
          frames = f;
          break;
        }
      }
    }

    if (method === "PATCH") {
      const body = JSON.parse(init.body as string);
      const fIdx = frames.findIndex(f => f.id === frameId);
      if (fIdx > -1) {
        frames[fIdx] = { ...frames[fIdx], ...body, updatedAt: new Date().toISOString() };
        setLocalData(`frames_${targetProjectId}`, frames);
        return frames[fIdx];
      }
    }
    if (method === "DELETE") {
      const updated = frames.filter(f => f.id !== frameId);
      setLocalData(`frames_${targetProjectId}`, updated);
      return { success: true };
    }
  }

  // Project Layers
  const layersMatch = path.match(/^\/api\/projects\/(\d+)\/layers$/);
  if (layersMatch) {
    const projectId = parseInt(layersMatch[1]);
    const layers = getLocalData<any[]>(`layers_${projectId}`, [
      { id: Date.now(), projectId, name: "Layer 1", layerIndex: 0, visible: true, locked: false }
    ]);
    if (method === "GET") return layers;
    if (method === "POST") {
      const body = JSON.parse(init.body as string);
      const newLayer = { ...body, id: Date.now(), projectId };
      const updated = [...layers, newLayer];
      setLocalData(`layers_${projectId}`, updated);
      return newLayer;
    }
  }

  // Health check
  if (path === "/api/healthz") return { status: "ok" };

  console.warn(`[Local-First] Unhandled path: ${method} ${path}`);
  return {};
}

// ---------------------------------------------------------------------------
// Original Exports and Logic (Modified for Local-First)
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super("API Error");
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const url = typeof input === "string" ? input : (input as any).url || input.toString();
  
  // ALWAYS use local-first if it's an /api call
  if (url.includes("/api/")) {
    return handleLocalRequest(url, options) as Promise<T>;
  }

  // Fallback
  const response = await fetch(input, options);
  if (!response.ok) {
    throw new Error("Fetch failed");
  }
  return (await response.json()) as T;
}
