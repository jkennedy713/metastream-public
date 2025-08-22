import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MetadataTable from '@/components/MetadataTable';
import { Upload, RotateCcw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { clearAllDynamoDBRecords } from '@/utils/dynamodbCleaner';
import { useToast } from '@/hooks/use-toast';

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleHardRefresh = () => {
    // Clear all React Query cache
    queryClient.clear();
    // Clear localStorage
    localStorage.clear();
    // Force page reload to reset everything
    window.location.reload();
  };

  const handleClearAllRecords = async () => {
    try {
      const result = await clearAllDynamoDBRecords();
      toast({
        title: 'Records Cleared',
        description: `Successfully deleted ${result.deletedCount} records from DynamoDB`,
      });
      // Refresh the page to show empty state
      handleHardRefresh();
    } catch (error) {
      toast({
        title: 'Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear records',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                View and analyze metadata from your uploaded datasets
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleClearAllRecords} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Records
              </Button>
              <Button onClick={handleHardRefresh} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Hard Refresh
              </Button>
              <Button asChild variant="gradient">
                <Link to="/upload" className="flex items-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Upload New File</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <MetadataTable />
      </div>
    </div>
  );
};

export default Dashboard;