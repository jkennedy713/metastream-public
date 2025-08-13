import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { useToast } from '@/hooks/use-toast';
import { queryMetadata, MetadataRecord, QueryFilters } from '@/utils/dynamodbClient';
import { Search, Download, Calendar, RefreshCw, Eye, EyeOff, Undo2 } from 'lucide-react';
import { filterMetadataForDisplay } from '@/utils/metadataDisplay';
import { isHidden, hideItem, unhideItem } from '@/utils/uiHide';

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
  const [showHidden, setShowHidden] = useState(false);
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

  const removeFromView = (record: MetadataRecord) => {
    const fileName = record.filename || '';
    const RecordID = record.id || '';
    
    hideItem({ fileName, RecordID });
    
    // Optimistic UI: remove from current view immediately
    setRecords(prev => prev.filter(r => r.id !== record.id));
    
    // Show toast with undo option
    toast({
      title: 'Item Hidden',
      description: `${fileName} has been hidden from view`,
      action: (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => undoHide(record)}
          className="ml-2"
        >
          <Undo2 className="w-3 h-3 mr-1" />
          Undo
        </Button>
      ),
    });
  };

  const undoHide = (record: MetadataRecord) => {
    const fileName = record.filename || '';
    const RecordID = record.id || '';
    
    unhideItem({ fileName, RecordID });
    
    // Re-add to current view
    setRecords(prev => {
      const exists = prev.some(r => r.id === record.id);
      if (exists) return prev;
      return [...prev, record].sort(
        (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
      );
    });
    
    toast({
      title: 'Item Restored',
      description: `${fileName} is now visible again`,
    });
  };

  const handleUnhide = (record: MetadataRecord) => {
    undoHide(record);
  };


  const handleRefresh = () => {
    setSearchTerm('');
    loadData({}, true);
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

  // Filter records based on showHidden toggle
  const visibleRecords = showHidden 
    ? records 
    : records.filter(record => !isHidden({ 
        fileName: record.filename || '', 
        RecordID: record.id || '' 
      }));

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

        <div className="flex items-center space-x-2">
          <Switch
            id="show-hidden"
            checked={showHidden}
            onCheckedChange={setShowHidden}
          />
          <Label htmlFor="show-hidden" className="text-sm">
            Show hidden items ({records.length - visibleRecords.length} hidden)
          </Label>
        </div>

        {visibleRecords.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {showHidden ? 'No metadata yet' : 'No visible metadata'}
            </h3>
            <p className="text-muted-foreground">
              {showHidden 
                ? 'Upload some files to see their processed metadata here'
                : 'All items are hidden or no files uploaded yet'
              }
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((record) => {
                  const isRecordHidden = isHidden({ 
                    fileName: record.filename || '', 
                    RecordID: record.id || '' 
                  });
                  
                  return (
                    <TableRow 
                      key={record.id || `${record.filename}-${record.uploadTime}`}
                      className={isRecordHidden && showHidden ? 'opacity-60 bg-muted/20' : ''}
                    >
                      <TableCell className="font-medium">
                        {record.filename}
                        {isRecordHidden && showHidden && (
                          <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                        )}
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
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </Button>
                          
                          {isRecordHidden && showHidden ? (
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => handleUnhide(record)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Unhide
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeFromView(record)}
                              title="Remove from view (no data is deleted)"
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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