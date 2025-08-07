import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FileUpload from '@/components/FileUpload';
import { BarChart3 } from 'lucide-react';

const Upload: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Upload Dataset</h1>
              <p className="text-muted-foreground mt-2">
                Upload your nutritional science dataset for automated metadata analysis
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>View Dashboard</span>
              </Link>
            </Button>
          </div>
        </div>

        <FileUpload />
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Once uploaded, your file will be automatically processed and metadata will be available in the{' '}
            <Link to="/dashboard" className="text-primary hover:underline">
              dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default Upload;