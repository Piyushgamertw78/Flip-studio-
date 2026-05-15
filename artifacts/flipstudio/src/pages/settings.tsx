import { useState } from "react";
  import { useLocation } from "wouter";
  import { ArrowLeft, User, Bell, Shield, Palette, LogOut, Save, Check, Trash2, Info } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Switch } from "@/components/ui/switch";
  import { Label } from "@/components/ui/label";
  import { Input } from "@/components/ui/input";
  import { useAuth } from "@/lib/auth";
  import { useToast } from "@/hooks/use-toast";
  import { db } from "@/lib/local-db";

  export default function SettingsPage() {
    const [, setLocation] = useLocation();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [clearingData, setClearingData] = useState(false);

    const [prefs, setPrefs] = useState({
      autosave: true,
      onionSkinning: true,
      showGrid: false,
      hapticFeedback: true,
      highQualityExport: false,
    });

    const handleSave = () => {
      setSaving(true);
      localStorage.setItem("flipstudio_prefs", JSON.stringify(prefs));
      setTimeout(() => {
        setSaving(false);
        setSaved(true);
        toast({ title: "Settings saved", description: "Your preferences have been updated." });
        setTimeout(() => setSaved(false), 2000);
      }, 600);
    };

    const handleClearData = async () => {
      if (!confirm("This will delete ALL your projects, frames, and layers. This cannot be undone. Are you sure?")) return;
      setClearingData(true);
      try {
        const projects = await db.projects.list();
        for (const p of projects) await db.projects.delete(p.id);
        localStorage.removeItem("flipstudio_prefs");
        toast({ title: "Data cleared", description: "All projects have been deleted." });
        setLocation("/");
      } finally {
        setClearingData(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#050508]/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/5" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-5">
          {/* Profile */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-violet-400" /> Profile</CardTitle>
              <CardDescription className="text-white/40">Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-violet-500/30 shrink-0">
                  {user?.avatar
                    ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-violet-600 flex items-center justify-center text-xl font-bold">{user?.username?.[0]?.toUpperCase() ?? "U"}</div>
                  }
                </div>
                <div>
                  <p className="font-semibold text-lg">{user?.username ?? "—"}</p>
                  <p className="text-sm text-white/50">{user?.email ?? "—"}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Active
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Studio preferences */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Palette className="w-4 h-4 text-fuchsia-400" /> Studio Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: "autosave",        label: "Auto-save",           desc: "Automatically save changes while drawing" },
                { key: "onionSkinning",   label: "Onion Skinning",       desc: "Show ghost of previous frames while drawing" },
                { key: "showGrid",        label: "Show Grid by default", desc: "Enable drawing grid when opening projects" },
                { key: "hapticFeedback",  label: "Haptic Feedback",      desc: "Vibration feedback on touch (mobile only)" },
                { key: "highQualityExport", label: "High-quality Export", desc: "Default exports at full resolution" },
              ] as const).map(pref => (
                <div key={pref.key} className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-white/80 text-sm font-medium">{pref.label}</Label>
                    <p className="text-xs text-white/40 mt-0.5">{pref.desc}</p>
                  </div>
                  <Switch
                    checked={prefs[pref.key]}
                    onCheckedChange={v => setPrefs(p => ({ ...p, [pref.key]: v }))}
                    className="data-[state=checked]:bg-violet-600"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* About */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4 text-cyan-400" /> About FlipStudio</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/50 space-y-1">
              <p>Version 2.0.0 — offline-first animation studio</p>
              <p>All data is stored locally on your device using IndexedDB.</p>
              <p>No account or internet connection required to animate.</p>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="bg-red-950/20 border-red-500/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-400"><Trash2 className="w-4 h-4" /> Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Clear all data</p>
                  <p className="text-xs text-white/40 mt-0.5">Delete all projects and animation data from this device</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleClearData} disabled={clearingData} className="bg-red-600 hover:bg-red-500 shrink-0">
                  {clearingData ? "Clearing…" : "Clear Data"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-semibold"
            >
              {saved ? <><Check className="w-4 h-4 mr-2" /> Saved!</> : saving ? "Saving…" : <><Save className="w-4 h-4 mr-2" /> Save Preferences</>}
            </Button>
            <Button variant="outline" className="h-11 border-white/10 text-white/60 hover:bg-white/5 hover:text-white" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </main>
      </div>
    );
  }
  