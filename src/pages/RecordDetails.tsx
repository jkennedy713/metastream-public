import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryMetadataById } from '@/utils/dynamodbQueryById';
import { ArrowLeft, Trash } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteFromS3 } from '@/utils/s3Uploader';
import { deleteMetadataCompat } from '@/utils/dynamodbDelete';

interface MetadataRecord {
  id: string;
  filename: string;
  uploadTime: string;
  metadata: Record<string, any>;
  userId: string;
}

const extractKeyPhrases = (record: MetadataRecord): string[] => {
  const meta = record.metadata || {};
  let phrases: string[] = [];
  if (Array.isArray(meta.columns) && meta.columns.length) {
    phrases = meta.columns.slice(0, 10);
  } else if (Array.isArray(meta.topLevelKeys) && meta.topLevelKeys.length) {
    phrases = meta.topLevelKeys.slice(0, 10);
  } else {
    const base = record.filename || meta.originalName || '';
    phrases = base
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .filter((w) => w.length > 2)
      .slice(0, 10);
  }
  // Ensure uniqueness
  return Array.from(new Set(phrases));
};

const flattenValue = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
};

const RecordDetails: React.FC = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { record?: MetadataRecord } };
  const { toast } = useToast();

  const [record, setRecord] = useState<MetadataRecord | null>(state?.record || null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = record?.filename ? `${record.filename} | Record Details` : 'Record Details';
  }, [record?.filename]);

  useEffect(() => {
    const load = async () => {
      if (!record && params.id) {
        setLoading(true);
        try {
          const r = await queryMetadataById(params.id);
          if (!r) {
            toast({ title: 'Not found', description: 'Record could not be found', variant: 'destructive' });
          }
          setRecord(r);
        } catch (e: any) {
          const message = e?.message || 'Failed to load record';
          toast({ title: 'Error', description: message, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const phrases = useMemo(() => (record ? extractKeyPhrases(record) : []), [record]);

  const metaEntries = useMemo(() => {
    if (!record) return [] as Array<[string, string]>;
    const base: Array<[string, string]> = [
      ['ID', record.id],
      ['Filename', record.filename],
      ['Upload Time', record.uploadTime],
      ['User ID', record.userId],
    ];
    const meta = Object.entries(record.metadata || {}).map(([k, v]) => [k, flattenValue(v)] as [string, string]);
    return [...base, ...meta];
  }, [record]);

  const onDelete = async () => {
    if (!record) return;
    setDeleting(true);
    try {
      const s3Key = (record.metadata && ((record.metadata as any).s3Key || (record.metadata as any).key)) || record.id;
      await deleteFromS3(s3Key);
      await deleteMetadataCompat({ id: record.id, filename: record.filename });
      toast({ title: 'Deleted', description: 'File and metadata removed.' });
      navigate('/dashboard');
    } catch (e: any) {
      const message = e?.message || (typeof e === 'string' ? e : 'Unknown error');
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    } catch {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          {record && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  <Trash className="w-4 h-4 mr-2" /> {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the S3 object and its metadata. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{record?.filename || 'Record Details'}</CardTitle>
            <CardDescription>
              Detailed metadata for your uploaded dataset
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Key Phrases</h3>
              <div className="flex flex-wrap gap-2">
                {phrases.length ? (
                  phrases.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No key phrases available</span>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : record ? (
                    metaEntries.map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{k}</TableCell>
                        <TableCell>
                          <pre className="whitespace-pre-wrap break-words text-sm">{v}</pre>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                        Record not found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RecordDetails;
