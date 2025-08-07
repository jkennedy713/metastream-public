import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryMetadata, MetadataRecord, QueryFilters } from '@/utils/dynamodbClient';
import { Search, Download, Calendar, RefreshCw } from 'lucide-react';

const MetadataTable: React.FC = () => {
  const [records, setRecords] = useState<MetadataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<Record<string, any> | undefined>();
  const { toast } = useToast();

  const loadData = async (filters: QueryFilters = {}, reset: boolean = false) => {
    setLoading(true);
    try {
      const result = await queryMetadata(
        filters,
        100,
        reset ? undefined : lastEvaluatedKey
      );
      
      if (reset) {
        setRecords(result.items);
      } else {
        setRecords(prev => [...prev, ...result.items]);
      }
      
      setHasMore(result.hasMore);
      setLastEvaluatedKey(result.lastEvaluatedKey);
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

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const renderMetadataPreview = (metadata: Record<string, any>) => {
    const keys = Object.keys(metadata).slice(0, 3);
    if (keys.length === 0) return <span className="text-muted-foreground">No metadata</span>;
    
    return (
      <div className="space-y-1">
        {keys.map(key => (
          <div key={key} className="text-xs">
            <span className="font-medium">{key}:</span>{' '}
            <span className="text-muted-foreground">
              {String(metadata[key]).slice(0, 50)}
              {String(metadata[key]).length > 50 ? '...' : ''}
            </span>
          </div>
        ))}
        {Object.keys(metadata).length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{Object.keys(metadata).length - 3} more
          </Badge>
        )}
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
                  <TableHead>Filename</TableHead>
                  <TableHead>Upload Time</TableHead>
                  <TableHead>Metadata Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.filename}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(record.uploadTime)}
                    </TableCell>
                    <TableCell>
                      {renderMetadataPreview(record.metadata)}
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