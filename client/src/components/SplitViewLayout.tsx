import { ReactNode } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface SplitViewLayoutProps {
  listPanel: ReactNode;
  detailPanel: ReactNode;
  defaultListSize?: number;
  minListSize?: number;
  maxListSize?: number;
  showDetail?: boolean;
  emptyDetailMessage?: string;
}

export default function SplitViewLayout({
  listPanel,
  detailPanel,
  defaultListSize = 35,
  minListSize = 25,
  maxListSize = 50,
  showDetail = true,
  emptyDetailMessage = "Select an item to view details",
}: SplitViewLayoutProps) {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-[calc(100vh-120px)] rounded-lg border"
      data-testid="split-view-layout"
    >
      <ResizablePanel
        defaultSize={showDetail ? defaultListSize : 100}
        minSize={showDetail ? minListSize : 100}
        maxSize={showDetail ? maxListSize : 100}
        className="overflow-hidden"
      >
        <div className="h-full overflow-y-auto" data-testid="split-view-list">
          {listPanel}
        </div>
      </ResizablePanel>

      {showDetail && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel minSize={50} className="overflow-hidden">
            <div className="h-full overflow-y-auto bg-muted/20" data-testid="split-view-detail">
              {detailPanel || (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {emptyDetailMessage}
                </div>
              )}
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
