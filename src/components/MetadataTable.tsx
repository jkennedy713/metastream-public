import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import { queryMetadata, MetadataRecord, QueryFilters } from '@/utils/dynamodbClient';
import { Search, Download, Calendar, RefreshCw, Trash, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteFromS3 } from '@/utils/s3Uploader';
import { deleteMetadataCompat } from '@/utils/dynamodbDelete';
import { filterMetadataForDisplay } from '@/utils/metadataDisplay';

const normalizeName = (input?: string | null): string => {
  if (!input) return '';
  let s = String(input).trim();
  try { s = decodeURIComponent(s); } catch {}
  const hashIdx = s.indexOf('#');
  if (hashIdx !== -1) s = s.slice(0, hashIdx);
  // drop leading path like uploads/
  s = s.replace(/^uploads\//i, '');
  return s;
};

const recordDedupeKey = (r: MetadataRecord): string => {
  const id = normalizeName(r.id);
  const filename = normalizeName(r.filename);
  const metaKey = normalizeName((r as any)?.metadata?.s3Key || (r as any)?.metadata?.key || '');
  const base = id || metaKey || filename;
  return `${base}::${(r.uploadTime || '').trim()}`;
};

const MetadataTable: React.FC = () => {
  const [records, setRecords] = useState<MetadataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<Record<string, any> | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadData = async (filters: QueryFilters = {}, reset: boolean = false) => {
    setLoading(true);
    try {
      const result = await queryMetadata(
        filters,
        100,
        reset ? undefined : lastEvaluatedKey
      );
      
      // Sort by newest uploadTime first
      const sortByLatest = (arr: MetadataRecord[]) =>
        [...arr].sort(
          (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
        );

      if (reset) {
        const deduped = Array.from(
          new Map(result.items.map(r => [recordDedupeKey(r), r])).values()
        );
        setRecords(sortByLatest(deduped));
      } else {
        setRecords(prev =>
          sortByLatest(
            Array.from(
              new Map(
                [...prev, ...result.items].map(r => [recordDedupeKey(r), r])
              ).values()
            )
          )
        );
      }

      setLastEvaluatedKey(result.lastEvaluatedKey);
      setHasMore(result.hasMore);

      
    } catch (error) {
      toast({
        title: 'Error Loading Data',
        description: error instanceof Error ? error.message : 'Failed to load metadata',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({}, true);
  }, []);

  const handleSearch = () => {
    const filters: QueryFilters = {};
    if (searchTerm.trim()) {
      filters.searchTerm = searchTerm.trim();
    }
    loadData(filters, true);
  };

  const handleRefresh = () => {
    setSearchTerm('');
    loadData({}, true);
  };

  const handleDelete = async (record: MetadataRecord) => {
    setDeletingId(record.id);
    try {
      const s3KeyRaw = (record.metadata && (record.metadata.s3Key || record.metadata.key)) || record.id;
      const s3Key = typeof s3KeyRaw === 'string' ? s3KeyRaw.trim() : '';
      if (!s3Key) {
        throw new Error('Missing S3 object Key for this record. Ensure metadata contains s3Key or key.');
      }
      await deleteFromS3(s3Key);
      await deleteMetadataCompat({ id: record.id, filename: record.filename });

      setRecords(prev => prev.filter(r => r.id !== record.id));
      toast({ title: 'Deleted', description: 'File and metadata removed.' });
    } catch (e: any) {
      const message = e?.message || (typeof e === 'string' ? e : 'Unknown error');
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = (record: MetadataRecord) => {
    const id = (record.id || '').trim();
    if (!id) {
      toast({ title: 'Cannot open', description: 'Record is missing an ID', variant: 'destructive' });
      return;
    }
    navigate(`/record/${encodeURIComponent(id)}`, { state: { record } });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const renderMetadataPreview = (metadata: Record<string, any>) => {
    const ext = String((metadata?.extension ?? '') || '').trim();
    const mime = String((metadata?.mimeType ?? '') || '').trim();
    const type = ext || mime || 'Unknown';
    const sizeBytes = Number((metadata as any)?.sizeBytes);
    const sizeMB = Number((metadata as any)?.sizeMB);
    const size = !isNaN(sizeBytes) && sizeBytes > 0
      ? (() => {
          const units = ['B','KB','MB','GB','TB'];
          let b = sizeBytes;
          let i = 0;
          while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
          return `${b.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
        })()
      : (!isNaN(sizeMB) && sizeMB > 0 ? `${sizeMB.toFixed(2)} MB` : 'Unknown');
    return (
      <div className="space-y-1 text-xs">
        <div><span className="font-medium">Type:</span> <span className="text-muted-foreground">{type}</span></div>
        <div><span className="font-medium">Size:</span> <span className="text-muted-foreground">{size}</span></div>
      </div>
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Download className="w-5 h-5" />
          <span>Metadata Dashboard</span>
        </CardTitle>
        <CardDescription>
          View and search through processed metadata from your uploaded datasets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by filename or metadata content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            Search
          </Button>
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {records.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No metadata yet</h3>
            <p className="text-muted-foreground">
              Upload some files to see their processed metadata here
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Upload Time</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id || `${record.filename}-${record.uploadTime}`}>
                    <TableCell className="font-medium">
                      {record.filename}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(record.uploadTime)}
                    </TableCell>
                    <TableCell>
                      {renderMetadataPreview(record.metadata)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleView(record)}>
                          <Eye className="w-4 h-4 mr-2" /> View
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={deletingId === record.id}>
                              <Trash className="w-4 h-4 mr-2" />
                              {deletingId === record.id ? 'Deleting...' : 'Delete'}
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
                              <AlertDialogAction onClick={() => handleDelete(record)}>
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center">
            <Button 
              onClick={() => loadData({ searchTerm: searchTerm || undefined })}
              variant="outline"
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetadataTable;