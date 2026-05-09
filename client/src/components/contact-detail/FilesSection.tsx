import { FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FileRecord as FileData } from "@shared/schema";

interface FilesSectionProps {
  files: FileData[];
}

export default function FilesSection({ files }: FilesSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Files ({files.length})
        </CardTitle>
        <Button size="sm" variant="outline" data-testid="button-upload-file">
          <Upload className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No files uploaded</p>
        ) : (
          <div className="space-y-2">
            {files.slice(0, 5).map(file => (
              <div key={file.id} className="flex items-center justify-between text-sm p-2 border rounded-md" data-testid={`file-card-${file.id}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {(file.size / 1024).toFixed(1)}KB
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
