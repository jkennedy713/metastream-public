import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryMetadataById } from '@/utils/dynamodbQueryById';
import { ArrowLeft } from 'lucide-react';

const RecordDetails: React.FC = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('RecordDetails component mounted');
    console.log('params.id:', params.id);
    const load = async () => {
      if (params.id) {
        console.log('Starting to load record for id:', params.id);
        setLoading(true);
        try {
          console.log('About to call queryMetadataById...');
          const r = await queryMetadataById(params.id);
          console.log('queryMetadataById returned:', r);
          setRecord(r);
        } catch (e: any) {
          console.error('Error in load function:', e);
          toast({ title: 'Error', description: e?.message || 'Failed to load record', variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      } else {
        console.log('No params.id found');
      }
    };
    load();
  }, [params.id, toast]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  // Simple function to convert any value to string for display
  const valueToString = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getTypeTag = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (Array.isArray(value)) return 'ARRAY';
    if (typeof value === 'object') return 'OBJECT';
    if (typeof value === 'number') return 'NUMBER';
    if (typeof value === 'boolean') return 'BOOLEAN';
    return 'STRING';
  };

  // Get ALL attributes - filename, id, userId, and everything in metadata
  const getAllAttributes = () => {
    if (!record) return [];
    
    const attributes = [];
    
    // Add basic record fields
    if (record.filename) {
      attributes.push({ key: 'File Name', value: record.filename, type: getTypeTag(record.filename) });
    }
    if (record.id) {
      attributes.push({ key: 'Record ID', value: record.id, type: getTypeTag(record.id) });
    }
    if (record.userId) {
      attributes.push({ key: 'User ID', value: record.userId, type: getTypeTag(record.userId) });
    }
    
    // Add ALL metadata attributes
    if (record.metadata && typeof record.metadata === 'object') {
      Object.entries(record.metadata).forEach(([key, value]) => {
        attributes.push({ 
          key: key, 
          value: value, 
          type: getTypeTag(value) 
        });
      });
    }
    
    return attributes;
  };

  const allAttributes = getAllAttributes();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{record?.filename || 'Record Details'}</CardTitle>
            <CardDescription>
              All attributes for this record
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Attribute</TableHead>
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : allAttributes.length > 0 ? (
                    allAttributes.map((attr, index) => (
                      <TableRow key={`${attr.key}-${index}`}>
                        <TableCell className="font-medium">{attr.key}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{attr.type}</TableCell>
                        <TableCell>
                          <div className="max-h-40 overflow-auto">
                            <pre className="whitespace-pre-wrap break-words text-sm">
                              {valueToString(attr.value)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                        {record ? 'No attributes found' : 'Record not found'}
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