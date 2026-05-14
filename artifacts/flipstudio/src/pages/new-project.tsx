import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCreateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  { id: "1080p", label: "1080p Full HD (1920x1080)", width: 1920, height: 1080 },
  { id: "720p", label: "720p HD (1280x720)", width: 1280, height: 720 },
  { id: "square", label: "Square (720x720)", width: 720, height: 720 },
  { id: "custom", label: "Custom Size...", width: 0, height: 0 },
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const createProject = useCreateProject();

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

  function onSubmit(values: z.infer<typeof formSchema>) {
    let width = 1920;
    let height = 1080;

    if (values.preset !== "custom") {
      const selected = PRESETS.find(p => p.id === values.preset);
      if (selected) {
        width = selected.width;
        height = selected.height;
      }
    } else {
      width = values.customWidth || 1920;
      height = values.customHeight || 1080;
    }

    createProject.mutate({
      data: {
        name: values.name,
        description: values.description,
        fps: values.fps,
        canvasWidth: width,
        canvasHeight: height,
        backgroundColor: values.backgroundColor,
      }
    }, {
      onSuccess: (project) => {
        setLocation(`/projects/${project.id}`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => setLocation("/")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-3xl">Create New Project</CardTitle>
            <CardDescription>Setup your canvas and workspace settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Awesome Animation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="A brief description..." className="resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="preset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Canvas Size</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a preset" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PRESETS.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isCustom && (
                      <div className="flex items-center gap-4">
                        <FormField
                          control={form.control}
                          name="customWidth"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Width</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customHeight"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Height</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="fps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frames Per Second (FPS)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select FPS" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="8">8 FPS (Stylized/Anime)</SelectItem>
                              <SelectItem value="12">12 FPS (Standard 2D)</SelectItem>
                              <SelectItem value="24">24 FPS (Cinematic)</SelectItem>
                              <SelectItem value="30">30 FPS (Smooth)</SelectItem>
                              <SelectItem value="60">60 FPS (Ultra Smooth)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="backgroundColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Background Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded border border-border" 
                                style={{ backgroundColor: field.value }}
                              />
                              <Input type="text" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Project
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
