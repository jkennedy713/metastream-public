import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import { queryMetadata, MetadataRecord, QueryFilters } from '@/utils/dynamodbClient';
import { Search, Download, Calendar, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { isHidden, hideItem, unhideItem } from '@/utils/uiHide';
import { Switch } from '@/components/ui/switch';
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
  return `${base}::${r.RecordID || r.id || ''}`;
};

const MetadataTable: React.FC = () => {
  const [allRecords, setAllRecords] = useState<MetadataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<Record<string, any> | undefined>();
  const [showHidden, setShowHidden] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Filter records based on hidden state
  const records = allRecords.filter(record => 
    showHidden || !isHidden({ fileName: record.fileName, RecordID: record.RecordID })
  );

  const loadData = async (filters: QueryFilters = {}, reset: boolean = false) => {
    setLoading(true);
    try {
      const result = await queryMetadata(
        filters,
        100,
        reset ? undefined : lastEvaluatedKey
      );
      
      // Sort by filename alphabetically
      const sortByFilename = (arr: MetadataRecord[]) =>
        [...arr].sort((a, b) => a.filename.localeCompare(b.filename));

      if (reset) {
        const deduped = Array.from(
          new Map(result.items.map(r => [recordDedupeKey(r), r])).values()
        );
        setAllRecords(sortByFilename(deduped));
      } else {
        setAllRecords(prev =>
          sortByFilename(
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

  const removeFromView = (record: MetadataRecord) => {
    hideItem({ fileName: record.fileName, RecordID: record.RecordID });
    // Optimistic UI update by filtering out the hidden record
    setAllRecords(prev => prev.filter(r => !(r.fileName === record.fileName && r.RecordID === record.RecordID)));
    
    toast({ 
      title: 'Removed from view', 
      description: 'Item hidden locally. Use "Show hidden" to restore.',
      action: (
        <button 
          onClick={() => {
            unhideItem({ fileName: record.fileName, RecordID: record.RecordID });
            // Refresh the data to show the unhidden item
            loadData({}, true);
          }}
          className="text-sm underline"
        >
          Undo
        </button>
      )
    });
  };

  const restoreItem = (record: MetadataRecord) => {
    unhideItem({ fileName: record.fileName, RecordID: record.RecordID });
    toast({ title: 'Restored', description: 'Item is now visible again.' });
  };

  const handleView = (record: MetadataRecord) => {
    const id = (record.id || '').trim();
    if (!id) {
      toast({ title: 'Cannot open', description: 'Record is missing an ID', variant: 'destructive' });
      return;
    }
    navigate(`/record/${encodeURIComponent(id)}`, { state: { record } });
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
        <div className="space-y-4">
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
            <Switch checked={showHidden} onCheckedChange={setShowHidden} />
            <label className="text-sm text-muted-foreground">Show hidden items</label>
          </div>
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
                  <TableHead>Preview</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id || `${record.filename}-${record.RecordID}`}>
                    <TableCell className="font-medium">
                      {record.filename}
                    </TableCell>
                    <TableCell>
                      {renderMetadataPreview(record.metadata)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleView(record)}>
                          <Eye className="w-4 h-4 mr-2" /> View
                        </Button>
                        {showHidden && isHidden({ fileName: record.fileName, RecordID: record.RecordID }) ? (
                          <Button variant="outline" size="sm" onClick={() => restoreItem(record)}>
                            <Eye className="w-4 h-4 mr-2" /> Unhide
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => removeFromView(record)}>
                            <EyeOff className="w-4 h-4 mr-2" /> Remove
                          </Button>
                        )}
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