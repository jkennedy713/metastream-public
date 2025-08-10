import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { uploadToS3, validateFile, UploadProgress } from '@/utils/s3Uploader';
// import { extractMetadata } from '@/utils/metadataExtractor'; // handled by your Lambda
import { queryMetadata } from '@/utils/dynamodbClient';
import { Upload, File, Check, X } from 'lucide-react';

// Polling helper for DynamoDB appearance after Lambda processing
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      toast({
        title: 'Invalid File',
        description: error,
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
    setUploadProgress(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadToS3(file, setUploadProgress);

      if (result.success && result.key) {
        const key = result.key;
        const fname = file.name;

        toast({
          title: 'Upload Complete',
          description: 'Processing in Lambda… It will appear on the Dashboard shortly.',
        });

        // Reset UI immediately after upload
        setFile(null);
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Poll DynamoDB until Lambda writes the record
        try {
          const maxAttempts = 10;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const res = await queryMetadata({}, 200);
            const found = res.items.find((r) => {
              const m: any = r.metadata || {};
              const s3k: string = (m.s3Key || m.key || '').trim();
              return r.id === key || s3k === key || r.filename === fname;
            });
            if (found) {
              toast({
                title: 'Processing Complete',
                description: 'Your file has been indexed. Check the Dashboard.',
              });
              break;
            }
            await sleep(3000);
          }
        } catch (e) {
          console.warn('Polling for record failed', e);
        }
      } else {
        toast({
          title: 'Upload Failed',
          description: result.error || 'An error occurred during upload.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="w-5 h-5" />
          <span>Upload Dataset File</span>
        </CardTitle>
        <CardDescription>
          Upload your nutritional science dataset for metadata analysis. 
          Supported formats: CSV, TSV, XLSX, TXT, JSON (max 100MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Drop your file here</p>
            <p className="text-muted-foreground mb-4">or</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.txt,.json"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                onClick={clearFile}
                variant="ghost"
                size="sm"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {uploadProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress.percentage)}%</span>
                </div>
                <Progress value={uploadProgress.percentage} />
              </div>
            )}

            {uploadProgress?.percentage === 100 && (
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm">Upload complete!</span>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;