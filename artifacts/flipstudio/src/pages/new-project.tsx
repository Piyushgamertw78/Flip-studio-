import { useState } from "react";
  import { useLocation } from "wouter";
  import { useForm } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import * as z from "zod";
  import { ArrowLeft, Loader2, Film } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
  import { Input } from "@/components/ui/input";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Textarea } from "@/components/ui/textarea";
  import { db } from "@/lib/local-db";

  const formSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
    preset: z.string(),
    customWidth: z.coerce.number().min(1).max(3840).optional(),
    customHeight: z.coerce.number().min(1).max(2160).optional(),
    fps: z.coerce.number().min(1).max(60),
    backgroundColor: z.string(),
  });

  const PRESETS = [
    { id: "1080p", label: "1080p Full HD (1920×1080)", width: 1920, height: 1080 },
    { id: "720p", label: "720p HD (1280×720)", width: 1280, height: 720 },
    { id: "square", label: "Square (720×720)", width: 720, height: 720 },
    { id: "vertical", label: "Vertical / Reel (1080×1920)", width: 1080, height: 1920 },
    { id: "480p", label: "480p Standard (854×480)", width: 854, height: 480 },
    { id: "custom", label: "Custom Size…", width: 0, height: 0 },
  ];

  const FPS_OPTIONS = [8, 12, 15, 24, 25, 30, 60];

  export default function NewProject() {
    const [, setLocation] = useLocation();
    const [creating, setCreating] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: "Untitled Project",
        description: "",
        preset: "1080p",
        fps: 24,
        backgroundColor: "#ffffff",
      },
    });

    const preset = form.watch("preset");
    const isCustom = preset === "custom";

    async function onSubmit(values: z.infer<typeof formSchema>) {
      setCreating(true);
      try {
        let width = 1920, height = 1080;
        const p = PRESETS.find(pr => pr.id === values.preset);
        if (p && p.id !== "custom") { width = p.width; height = p.height; }
        else if (values.customWidth && values.customHeight) { width = values.customWidth; height = values.customHeight; }

        const now = new Date().toISOString();
        const projectId = await db.projects.create({
          name: values.name,
          description: values.description ?? "",
          width, height,
          fps: values.fps,
          backgroundColor: values.backgroundColor,
          thumbnail: "",
          createdAt: now,
          updatedAt: now,
        });

        // Create initial frame
        const frameId = await db.frames.create({
          projectId,
          order: 0,
          duration: Math.round(1000 / values.fps),
          canvasData: "{}",
          thumbnail: "",
          createdAt: now,
        });

        // Create initial layer
        await db.layers.create({
          frameId,
          projectId,
          name: "Layer 1",
          order: 0,
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: "normal",
          canvasData: "{}",
          createdAt: now,
        });

        setLocation(`/projects/${projectId}`);
      } catch (err) {
        console.error(err);
        setCreating(false);
      }
    }

    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#050508]/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/5" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Film className="w-3.5 h-3.5" />
              </div>
              <h1 className="text-lg font-bold">New Project</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <Card className="bg-white/5 border-white/10 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Project Details</CardTitle>
                  <CardDescription className="text-white/40">Basic information about your animation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Project Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Animation" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Description <span className="text-white/30">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="What is this animation about?" rows={2} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500 resize-none" />
                      </FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Canvas Settings</CardTitle>
                  <CardDescription className="text-white/40">Size, frame rate, and background color</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="preset" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Size Preset</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-violet-500">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#111118] border-white/10 text-white">
                          {PRESETS.map(p => (
                            <SelectItem key={p.id} value={p.id} className="hover:bg-white/5 focus:bg-white/5">{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {isCustom && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="customWidth" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">Width (px)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="1920" className="bg-white/5 border-white/10 text-white focus:border-violet-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="customHeight" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">Height (px)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="1080" className="bg-white/5 border-white/10 text-white focus:border-violet-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="fps" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Frame Rate (FPS)</FormLabel>
                        <Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-violet-500">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#111118] border-white/10 text-white">
                            {FPS_OPTIONS.map(f => (
                              <SelectItem key={f} value={String(f)} className="hover:bg-white/5 focus:bg-white/5">{f} fps</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-white/30">24fps is standard for animation</FormDescription>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="backgroundColor" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Background</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <input type="color" {...field} className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                            <Input {...field} placeholder="#ffffff" className="bg-white/5 border-white/10 text-white focus:border-violet-500" />
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <Button
                type="submit"
                disabled={creating}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-semibold text-base"
              >
                {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Project"}
              </Button>
            </form>
          </Form>
        </main>
      </div>
    );
  }
  