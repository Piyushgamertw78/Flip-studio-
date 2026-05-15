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
  const path = url.split("?")[0];
  const params = new URLSearchParams(url.split("?")[1] || "");

  // Helper to get current user
  const userStr = localStorage.getItem("flipstudio_user");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || "anonymous";

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

  // Projects
  if (path === "/api/projects") {
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

  if (path.startsWith("/api/projects/")) {
    const projectId = parseInt(path.split("/")[3]);
    const projects = getLocalData<any[]>("projects_" + userId, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (method === "GET") {
      return projects[projectIndex];
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body as string);
      if (projectIndex > -1) {
        projects[projectIndex] = { ...projects[projectIndex], ...body, updatedAt: new Date().toISOString() };
        setLocalData("projects_" + userId, projects);
        return projects[projectIndex];
      }
    }
    if (method === "DELETE") {
      const updated = projects.filter(p => p.id !== projectId);
      setLocalData("projects_" + userId, updated);
      localStorage.removeItem(STORAGE_KEY_PREFIX + `frames_${projectId}`);
      return { success: true };
    }
    
    // Duplicate Project
    if (path.endsWith("/duplicate") && method === "POST") {
      const source = projects[projectIndex];
      if (source) {
        const newProject = {
          ...source,
          id: Date.now(),
          name: `${source.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setLocalData("projects_" + userId, [newProject, ...projects]);
        
        // Copy frames
        const sourceFrames = getLocalData<any[]>(`frames_${projectId}`, []);
        const newFrames = sourceFrames.map(f => ({ ...f, id: Date.now() + Math.random(), projectId: newProject.id }));
        setLocalData(`frames_${newProject.id}`, newFrames);
        
        return newProject;
      }
    }
  }

  // Frames
  if (path.startsWith("/api/projects/") && path.includes("/frames")) {
    const projectId = parseInt(path.split("/")[3]);
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

  if (path.startsWith("/api/frames/")) {
    const frameId = parseInt(path.split("/")[3]);
    // We need to find which project this frame belongs to. 
    // For simplicity in this mock, we'll iterate through all frame keys or just use a global frame store.
    // Let's use a simpler approach: the UI usually knows the projectId.
    // But the API client doesn't pass it here. Let's look up in all flipstudio_db_frames_* keys.
    
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

  // Layers (Mocking as empty for now as it's less critical for basic functionality)
  if (path.includes("/layers")) {
    if (method === "GET") return [];
    if (method === "POST") return { id: Date.now(), name: "Layer 1" };
  }

  throw new Error(`Mock API: Path ${path} with method ${method} not implemented`);
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
  if (url.startsWith("/api")) {
    console.log("Intercepting API call for Local-First:", url);
    return handleLocalRequest(url, options) as Promise<T>;
  }

  // Fallback for non-api calls (shouldn't happen in this app's data flow)
  const response = await fetch(input, options);
  if (!response.ok) {
    throw new Error("Fetch failed");
  }
  return (await response.json()) as T;
}
