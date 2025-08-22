import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MetadataTable from '@/components/MetadataTable';
import { Upload } from 'lucide-react';

const Dashboard: React.FC = () => {
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
            <Button asChild variant="gradient">
              <Link to="/upload" className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Upload New File</span>
              </Link>
            </Button>
          </div>
        </div>

        <MetadataTable />
      </div>
    </div>
  );
};

export default Dashboard;