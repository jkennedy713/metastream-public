import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/AuthWrapper';
import { Upload, BarChart3, Shield, Zap } from 'lucide-react';

const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-foreground">Welcome to </span>
            <span className="text-primary">Metastream</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A production-grade platform for researchers to upload and analyze metadata 
            from nutritional science datasets, powered by AWS infrastructure.
          </p>
          
          {user ? (
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link to="/upload">Upload Dataset</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/dashboard">View Dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link to="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Powerful Features for Research Teams
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Upload className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Easy Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Drag-and-drop interface for CSV, TSV, XLSX, TXT, and JSON files 
                  with real-time progress tracking.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="w-8 h-8 text-secondary mb-2" />
                <CardTitle className="text-lg">Metadata Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automated metadata extraction and analysis with searchable 
                  dashboard and filtering capabilities.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Secure Authentication</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Enterprise-grade security with Amazon Cognito authentication 
                  and user management.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="w-8 h-8 text-secondary mb-2" />
                <CardTitle className="text-lg">AWS Infrastructure</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Built on AWS with S3 storage, DynamoDB, and Lambda for 
                  scalable, reliable performance.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join researchers worldwide who trust Metastream for their data analysis needs.
          </p>
          
          {!user && (
            <Button asChild size="lg">
              <Link to="/signup">Create Your Account</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;