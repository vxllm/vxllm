import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@vxllm/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vxllm/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { env } from "@vxllm/env/web";

const SERVER_URL = env.VITE_SERVER_URL;

interface HfDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
}

interface HfFile {
  filename: string;
  size: number | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function HfDownloadDialog({
  open,
  onOpenChange,
  repoId,
}: HfDownloadDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<HfFile[]>([]);
  const [detectedType, setDetectedType] = useState("llm");
  const [selectedType, setSelectedType] = useState("llm");
  const [selectedFile, setSelectedFile] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !repoId) return;

    setLoading(true);
    setFiles([]);
    setSelectedFile("");

    fetch(
      `${SERVER_URL}/api/models/hf/files?repo=${encodeURIComponent(repoId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const fileList: HfFile[] = data.files || [];
        setFiles(fileList);
        setDetectedType(data.detectedType || "llm");
        setSelectedType(data.detectedType || "llm");
        const firstFile = fileList[0];
        if (firstFile) setSelectedFile(firstFile.filename);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load model files");
        setLoading(false);
      });
  }, [open, repoId]);

  const handleDownload = async () => {
    if (!selectedFile) return;
    setDownloading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/models/hf/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repoId,
          filename: selectedFile,
          type: selectedType,
        }),
      });
      if (res.ok) {
        toast.success("Download started!");
        // Invalidate queries so DownloadProgress card appears immediately
        queryClient.invalidateQueries();
        onOpenChange(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Download failed");
      }
    } catch {
      toast.error("Failed to start download");
    }
    setDownloading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download from HuggingFace</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{repoId}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model Type</label>
              <p className="text-xs text-muted-foreground">
                Auto-detected: {detectedType.toUpperCase()}. Override if
                incorrect.
              </p>
              <Select
                value={selectedType}
                onValueChange={(val) => {
                  if (val) setSelectedType(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm">LLM</SelectItem>
                  <SelectItem value="stt">STT</SelectItem>
                  <SelectItem value="tts">TTS</SelectItem>
                  <SelectItem value="embedding">Embedding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File picker */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select File</label>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No downloadable model files found.
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {files.map((f) => (
                    <label
                      key={f.filename}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                        selectedFile === f.filename ? "bg-accent" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="hf-file"
                        value={f.filename}
                        checked={selectedFile === f.filename}
                        onChange={() => setSelectedFile(f.filename)}
                        className="accent-primary"
                      />
                      <span className="flex-1 truncate font-mono text-xs">
                        {f.filename}
                      </span>
                      {f.size != null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(f.size)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && (
          <DialogFooter>
            <Button
              onClick={handleDownload}
              disabled={!selectedFile || downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Download
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
