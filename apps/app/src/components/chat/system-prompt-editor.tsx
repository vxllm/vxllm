import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@vxllm/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@vxllm/ui/components/sheet";
import { Textarea } from "@vxllm/ui/components/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const TEMPLATES = [
  {
    name: "General Assistant",
    prompt: "You are a helpful assistant.",
  },
  {
    name: "Code Assistant",
    prompt:
      "You are an expert programmer. Write clean, well-documented code. Explain your reasoning when relevant.",
  },
  {
    name: "Creative Writer",
    prompt:
      "You are a creative writing assistant. Be imaginative and engaging. Use vivid language and compelling narratives.",
  },
  {
    name: "Concise Responder",
    prompt:
      "You are a helpful assistant that responds concisely. Keep answers brief and to the point unless asked to elaborate.",
  },
] as const;

export function SystemPromptEditor({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");

  const conversationQuery = useQuery(
    orpc.chat.getConversation.queryOptions({
      input: { id: conversationId },
    }),
  );

  // Sync prompt state when conversation data loads
  useEffect(() => {
    if (conversationQuery.data?.systemPrompt != null) {
      setPrompt(conversationQuery.data.systemPrompt);
    }
  }, [conversationQuery.data?.systemPrompt]);

  const updateConversation = useMutation(
    orpc.chat.updateConversation.mutationOptions({
      onSuccess: () => {
        toast.success("System prompt saved");
        queryClient.invalidateQueries({
          queryKey: orpc.chat.getConversation.queryOptions({
            input: { id: conversationId },
          }).queryKey,
        });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(`Failed to save: ${error.message}`);
      },
    }),
  );

  const handleSave = () => {
    updateConversation.mutate({
      id: conversationId,
      systemPrompt: prompt || null,
    });
  };

  const handleReset = () => {
    setPrompt("");
  };

  const handleTemplateSelect = (templateName: string) => {
    const template = TEMPLATES.find((t) => t.name === templateName);
    if (template) {
      setPrompt(template.prompt);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>System Prompt</SheetTitle>
          <SheetDescription>
            Customize how the AI responds in this conversation
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Select onValueChange={(val: string | null) => { if (val) handleTemplateSelect(val); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a system prompt..."
            rows={8}
            className="min-h-[160px] resize-none"
          />

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateConversation.isPending}
            >
              {updateConversation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
