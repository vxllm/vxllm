import {
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@vxllm/ui/components/sheet";
import { useIsMobile } from "@vxllm/ui/hooks/use-mobile";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { CommandPalette } from "@/components/chat/command-palette";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

// Context for sharing mobile sidebar state with child routes
interface ChatLayoutContextValue {
  isMobile: boolean;
  openMobileSidebar: () => void;
}

const ChatLayoutContext = createContext<ChatLayoutContextValue>({
  isMobile: false,
  openMobileSidebar: () => {},
});

export function useChatLayout() {
  return useContext(ChatLayoutContext);
}

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const openMobileSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      // Cmd+N: New conversation
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        navigate({ to: "/chat" });
      }
      // Cmd+Shift+S: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, toggleSidebar]);

  const layoutContext: ChatLayoutContextValue = {
    isMobile,
    openMobileSidebar,
  };

  if (isMobile) {
    return (
      <ChatLayoutContext.Provider value={layoutContext}>
        <div className="flex h-full flex-col">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Chat conversation list and navigation
              </SheetDescription>
              <ChatSidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <Outlet />
        </div>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onToggleSidebar={toggleSidebar}
        />
      </ChatLayoutContext.Provider>
    );
  }

  return (
    <ChatLayoutContext.Provider value={layoutContext}>
      <div className="flex h-full">
        {!sidebarCollapsed && (
          <div className="w-[280px] shrink-0 border-r">
            <ChatSidebar />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onToggleSidebar={toggleSidebar}
      />
    </ChatLayoutContext.Provider>
  );
}
