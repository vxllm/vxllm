import { Link, useLocation } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vxllm/ui/components/tooltip";
import {
  BarChart3,
  Box,
  MessageSquare,
  Settings,
} from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

const navItems = [
  { icon: MessageSquare, label: "Chat", to: "/chat" },
  { icon: BarChart3, label: "Dashboard", to: "/dashboard" },
  { icon: Box, label: "Models", to: "/models" },
  { icon: Settings, label: "Settings", to: "/settings" },
] as const;

export function AppNav() {
  const location = useLocation();

  return (
    <TooltipProvider>
      <nav className="flex h-full w-12 flex-col items-center border-r bg-card py-3">
        {/* Logo */}
        <div className="mb-4 flex items-center justify-center">
          <img src="/logo-no-bg.png" alt="VxLLM" className="size-6" />
        </div>

        {/* Separator */}
        <div className="mx-auto mb-3 h-px w-6 bg-border" />

        {/* Nav items */}
        <div className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger
                  render={
                    <Link
                      to={item.to}
                      className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    />
                  }
                >
                  <item.icon className="size-5" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-1">
          <ModeToggle />
        </div>
      </nav>
    </TooltipProvider>
  );
}
