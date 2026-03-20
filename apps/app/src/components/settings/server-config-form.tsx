import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@vxllm/ui/components/button";
import { Input } from "@vxllm/ui/components/input";
import { Label } from "@vxllm/ui/components/label";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface FormState {
  port: string;
  host: string;
  corsOrigins: string;
  defaultModel: string;
  maxContextSize: string;
  gpuLayersOverride: string;
}

const SETTING_KEYS: Record<keyof FormState, string> = {
  port: "PORT",
  host: "HOST",
  corsOrigins: "CORS_ORIGINS",
  defaultModel: "DEFAULT_MODEL",
  maxContextSize: "MAX_CONTEXT_SIZE",
  gpuLayersOverride: "GPU_LAYERS_OVERRIDE",
};

const DEFAULTS: FormState = {
  port: "11500",
  host: "127.0.0.1",
  corsOrigins: "*",
  defaultModel: "",
  maxContextSize: "8192",
  gpuLayersOverride: "",
};

export function ServerConfigForm() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    orpc.settings.getAll.queryOptions({
      input: {},
    }),
  );

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [initialForm, setInitialForm] = useState<FormState>(DEFAULTS);

  useEffect(() => {
    if (settings) {
      const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
      const loaded: FormState = {
        port: settingsMap.get("PORT") ?? DEFAULTS.port,
        host: settingsMap.get("HOST") ?? DEFAULTS.host,
        corsOrigins: settingsMap.get("CORS_ORIGINS") ?? DEFAULTS.corsOrigins,
        defaultModel: settingsMap.get("DEFAULT_MODEL") ?? DEFAULTS.defaultModel,
        maxContextSize: settingsMap.get("MAX_CONTEXT_SIZE") ?? DEFAULTS.maxContextSize,
        gpuLayersOverride: settingsMap.get("GPU_LAYERS_OVERRIDE") ?? DEFAULTS.gpuLayersOverride,
      };
      setForm(loaded);
      setInitialForm(loaded);
    }
  }, [settings]);

  const setMutation = useMutation(
    orpc.settings.set.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.settings.getAll.queryOptions({ input: {} }).queryKey,
        });
      },
    }),
  );

  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const changedKeys = (Object.keys(SETTING_KEYS) as (keyof FormState)[]).filter(
        (key) => form[key] !== initialForm[key],
      );

      if (changedKeys.length === 0) {
        toast.info("No changes to save");
        setIsSaving(false);
        return;
      }

      for (const key of changedKeys) {
        await setMutation.mutateAsync({
          key: SETTING_KEYS[key],
          value: form[key],
        });
      }

      setInitialForm(form);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  function updateField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor="port">Port</Label>
        <Input
          id="port"
          type="number"
          value={form.port}
          onChange={(e) => updateField("port", e.target.value)}
          placeholder="11500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="host">Host</Label>
        <Input
          id="host"
          type="text"
          value={form.host}
          onChange={(e) => updateField("host", e.target.value)}
          placeholder="127.0.0.1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="corsOrigins">CORS Origins</Label>
        <Input
          id="corsOrigins"
          type="text"
          value={form.corsOrigins}
          onChange={(e) => updateField("corsOrigins", e.target.value)}
          placeholder="*"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultModel">Default Model</Label>
        <Input
          id="defaultModel"
          type="text"
          value={form.defaultModel}
          onChange={(e) => updateField("defaultModel", e.target.value)}
          placeholder="e.g. llama-3.2-1b"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxContextSize">Max Context Size</Label>
        <Input
          id="maxContextSize"
          type="number"
          value={form.maxContextSize}
          onChange={(e) => updateField("maxContextSize", e.target.value)}
          placeholder="8192"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gpuLayersOverride">GPU Layers Override</Label>
        <Input
          id="gpuLayersOverride"
          type="number"
          value={form.gpuLayersOverride}
          onChange={(e) => updateField("gpuLayersOverride", e.target.value)}
          placeholder="Auto (leave empty)"
        />
        <p className="text-xs text-muted-foreground">
          Override the automatic GPU layer count. Leave empty for auto-detection.
        </p>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="mr-1 size-4 animate-spin" />
        ) : (
          <Save className="mr-1 size-4" />
        )}
        Save Settings
      </Button>
    </div>
  );
}
