// src/components/FilePreviewFallback.tsx
import { 
  FileText, 
  FileCode, 
  FileSpreadsheet, 
  FileIcon, 
  Download, 
  Eye, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FilePreviewFallbackProps {
  fileName: string;
  fileType?: string; // e.g., 'docx', 'csv', 'md'
  fileSize?: string; // Optional if not available yet
  onDownload?: () => void;
  onViewText?: () => void;
  downloadUrl?: string;
}

export function FilePreviewFallback({
  fileName,
  fileType,
  fileSize,
  onDownload,
  onViewText,
  downloadUrl
}: FilePreviewFallbackProps) {
  
  // Determine Icon based on extension
  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'doc':
      case 'docx':
      case 'txt':
      case 'md':
        return <FileText className="w-16 h-16 text-blue-500" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-16 h-16 text-emerald-500" />;
      case 'js':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'json':
        return <FileCode className="w-16 h-16 text-amber-500" />;
      default:
        return <FileIcon className="w-16 h-16 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-muted/5 p-6">
      <Card className="max-w-md w-full shadow-lg border-muted">
        <CardContent className="flex flex-col items-center text-center p-8 space-y-6">
          
          {/* 1. Iconography */}
          <div className="p-6 bg-background rounded-full shadow-sm border">
            {getFileIcon(fileName)}
          </div>

          {/* 2. Metadata & Messaging */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold break-all text-foreground">
              {fileName}
            </h3>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
               <span className="uppercase badge badge-secondary text-xs font-mono px-2 py-0.5 rounded-md bg-muted">
                 {fileName.split('.').pop() || 'FILE'}
               </span>
               {fileSize && <span>• {fileSize}</span>}
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-start gap-3 text-left text-sm w-full">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Processed Successfully</p>
              <p className="opacity-90 text-xs mt-0.5">
                Preview is not available for this file type, but the content has been extracted for AI analysis.
              </p>
            </div>
          </div>

          {/* 3. Functional Actions */}
          <div className="grid grid-cols-2 gap-3 w-full pt-2">
            {downloadUrl ? (
                <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" /> Download
                    </a>
                </Button>
            ) : (
                <Button variant="outline" className="w-full gap-2" disabled>
                    <Download className="w-4 h-4" /> Download
                </Button>
            )}
            
            <Button onClick={onViewText} className="w-full gap-2">
              <Eye className="w-4 h-4" /> View Text
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}