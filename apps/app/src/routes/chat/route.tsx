import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@vxllm/ui/components/resizable";

import { ChatSidebar } from "@/components/chat/chat-sidebar";

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
        <ChatSidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78}>
        <Outlet />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
