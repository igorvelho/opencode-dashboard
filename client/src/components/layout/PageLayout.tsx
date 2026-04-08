import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageLayoutProps {
  title: string;
  titleTooltip?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageLayout({
  title,
  titleTooltip,
  description,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex flex-1 items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold">{title}</h1>
              {titleTooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger aria-label={`What is a ${title.toLowerCase()}?`}>
                      <CircleHelp className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {titleTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
