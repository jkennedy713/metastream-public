import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryMetadataById } from '@/utils/dynamodbQueryById';
import { filterMetadataForDisplay } from '@/utils/metadataDisplay';
import { ArrowLeft } from 'lucide-react';

interface MetadataRecord {
  id: string;
  filename: string;
  metadata: Record<string, any>;
  userId: string;
}

const extractKeyPhrases = (record: MetadataRecord): string[] => {
  const meta: any = record.metadata || {};
  if (Array.isArray(meta.keyPhrases) && meta.keyPhrases.length) {
    const keys = (meta.keyPhrases as any[]).map((x) => String(x)).filter(Boolean);
    return Array.from(new Set(keys)).slice(0, 20);
  }
  // Prefer structured keys first
  if (Array.isArray(meta.columns) && meta.columns.length) {
    const cols = (meta.columns as any[]).map((x) => String(x)).filter(Boolean);
    return Array.from(new Set(cols)).slice(0, 10);
  }
  if (Array.isArray(meta.topLevelKeys) && meta.topLevelKeys.length) {
    const keys = (meta.topLevelKeys as any[]).map((x) => String(x)).filter(Boolean);
    return Array.from(new Set(keys)).slice(0, 10);
  }
  // Fallback: derive from text preview (for txt) or any short string values
  const textSources: string[] = [];
  if (typeof meta.preview === 'string') textSources.push(meta.preview);
  // Gather short stringy values in metadata
  Object.values(meta).forEach((v) => {
    if (typeof v === 'string' && v.length <= 80) textSources.push(v);
    if (Array.isArray(v)) {
      (v as any[]).forEach((x) => typeof x === 'string' && x.length <= 50 && textSources.push(x));
    }
  });
  const text = textSources.join(' ');
  const stop = new Set(['the','and','for','with','that','this','from','into','over','under','your','file','data','dataset','json','csv','xlsx','tsv','txt','meta','metadata','null','true','false','none','unknown','name']);
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const ranked = Object.entries(freq).sort((a,b) => b[1]-a[1]).map(([w]) => w);
  return ranked.slice(0, 10);
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

const toTypeTag = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  if (Array.isArray(val)) return 'LIST';
  if (typeof val === 'object') return 'MAP';
  if (typeof val === 'number') return 'NUMBER';
  if (typeof val === 'boolean') return 'BOOL';
  return 'STRING';
};

const formatBytes = (bytes?: number): string => {
  const b = typeof bytes === 'number' ? bytes : NaN;
  if (!b || isNaN(b) || b < 0) return 'Unknown';
  const units = ['B','KB','MB','GB','TB'];
  let val = b;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  const fixed = i === 0 ? 0 : 2;
  return `${val.toFixed(fixed)} ${units[i]}`;
};

const RecordDetails: React.FC = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { record?: MetadataRecord } };
  const { toast } = useToast();

  const [record, setRecord] = useState<MetadataRecord | null>(state?.record || null);
  const [loading, setLoading] = useState(false);

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



  const metaEntries = useMemo(() => {
    if (!record) return [] as Array<{ k: string; v: string }>;
    const rows: Array<{ k: string; v: string }> = [];
    
    // Add filename as first row
    rows.push({ k: 'File Name', v: record.filename || '' });
    
    // Get filtered metadata (excludes technical fields like id, s3key, etc.)
    const filteredMeta = filterMetadataForDisplay(record.metadata || {});
    
    // Convert all metadata entries to display format
    Object.entries(filteredMeta).forEach(([key, value]) => {
      let displayValue = '';
      
      if (Array.isArray(value)) {
        displayValue = value.join(', ');
      } else {
        displayValue = flattenValue(value);
      }
      
      // Format key names to be more readable
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
      
      rows.push({ k: formattedKey, v: displayValue });
    });

    return rows;
  }, [record]);

  // Delete functionality removed per architectural requirements

  const handleBack = () => {
    navigate('/dashboard');
  };

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
              Detailed metadata for your uploaded dataset (technical fields hidden)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Attribute</TableHead>
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
                    metaEntries.map((row) => (
                      <TableRow key={row.k}>
                        <TableCell className="font-medium">{row.k}</TableCell>
                        <TableCell>
                          {row.k === 'Content' ? (
                            <div className="max-h-32 overflow-auto">
                              <pre className="whitespace-pre-wrap break-words text-sm">{row.v}</pre>
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap break-words text-sm">{row.v}</pre>
                          )}
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
