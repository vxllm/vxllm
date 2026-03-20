import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@vxllm/ui/components/command";
import { MessageSquarePlus, PanelLeft, SearchIcon } from "lucide-react";

export function CommandPalette({
  open,
  onOpenChange,
  onToggleSidebar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSidebar?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              navigate({ to: "/chat" });
              onOpenChange(false);
            }}
          >
            <MessageSquarePlus className="mr-2 size-4" />
            New Conversation
            <CommandShortcut>Cmd+N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              // Focus the search input in the sidebar using a data attribute
              const searchInput = document.querySelector(
                '[data-sidebar-search]',
              ) as HTMLInputElement | null;
              if (searchInput) {
                searchInput.focus();
              }
              onOpenChange(false);
            }}
          >
            <SearchIcon className="mr-2 size-4" />
            Search Conversations
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => {
              onToggleSidebar?.();
              onOpenChange(false);
            }}
          >
            <PanelLeft className="mr-2 size-4" />
            Toggle Sidebar
            <CommandShortcut>Cmd+Shift+S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
