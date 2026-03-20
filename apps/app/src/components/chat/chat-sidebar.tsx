import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vxllm/ui/components/alert-dialog";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import { Input } from "@vxllm/ui/components/input";
import { ScrollArea } from "@vxllm/ui/components/scroll-area";
import { useDebounce } from "@vxllm/ui/hooks/use-debounce";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { groupConversationsByDate, truncateTitle } from "@/lib/chat";
import { orpc } from "@/utils/orpc";

export function ChatSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const activeConversationId = (params as { conversationId?: string })
    .conversationId;
  const queryClient = useQueryClient();

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 300);

  const conversationsQuery = useQuery(
    orpc.chat.listConversations.queryOptions({
      input: {
        page: 1,
        limit: 50,
        search: debouncedSearch || undefined,
      },
    }),
  );

  const deleteConversation = useMutation(
    orpc.chat.deleteConversation.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.chat.listConversations.queryOptions({
            input: { page: 1, limit: 50 },
          }).queryKey,
        });
        if (activeConversationId) {
          navigate({ to: "/chat" });
        }
      },
    }),
  );

  const conversations = conversationsQuery.data?.items ?? [];
  const groups = groupConversationsByDate(conversations);

  return (
    <div className="flex h-full flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex flex-col gap-2 p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => {
            navigate({ to: "/chat" });
            onNavigate?.();
          }}
        >
          <MessageSquarePlus className="size-4" />
          <span>New Chat</span>
        </Button>

        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2 pb-2">
          {conversationsQuery.isLoading ? (
            <div className="flex flex-col gap-2 px-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1 px-2 py-1.5">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              {debouncedSearch
                ? "No conversations found"
                : "No conversations yet"}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mt-2 first:mt-0">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground/70">
                  {group.label}
                </div>
                {group.conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    id={conversation.id}
                    title={conversation.title}
                    isActive={activeConversationId === conversation.id}
                    onDelete={() =>
                      deleteConversation.mutate({ id: conversation.id })
                    }
                    isDeleting={deleteConversation.isPending}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer: active model badge */}
      <div className="border-t p-3">
        <Badge variant="secondary" className="w-full justify-center text-xs">
          No model loaded
        </Badge>
      </div>
    </div>
  );
}

function ConversationItem({
  id,
  title,
  isActive,
  onDelete,
  isDeleting,
  onNavigate,
}: {
  id: string;
  title: string | null;
  isActive: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div
      className={`group relative flex items-center rounded-md ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/80"
      }`}
    >
      <Link
        to="/chat/$conversationId"
        params={{ conversationId: id }}
        className="flex-1 truncate px-2 py-1.5 text-sm"
        onClick={() => onNavigate?.()}
      >
        {truncateTitle(title)}
      </Link>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <button
              className="mr-1 flex size-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              type="button"
            />
          }
        >
          <Trash2 className="size-3.5" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
