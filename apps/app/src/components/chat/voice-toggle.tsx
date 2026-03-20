import { Button } from "@vxllm/ui/components/button";
import { Volume2, VolumeX } from "lucide-react";

interface VoiceToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function VoiceToggle({ enabled, onToggle }: VoiceToggleProps) {
  return (
    <Button
      variant={enabled ? "default" : "ghost"}
      size="sm"
      onClick={() => onToggle(!enabled)}
      type="button"
      title={enabled ? "Disable voice output" : "Enable voice output"}
    >
      {enabled ? (
        <Volume2 className="size-4" />
      ) : (
        <VolumeX className="size-4" />
      )}
      <span className="ml-1 text-xs">Voice</span>
    </Button>
  );
}
