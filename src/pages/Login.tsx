import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { signIn, fetchAuthSession, confirmSignIn } from 'aws-amplify/auth';
import { LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'newPassword'>('login');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const attempt = async (
      flow: 'USER_PASSWORD_AUTH' | 'USER_SRP_AUTH'
    ) => {
      const res = await signIn({
        username: email,
        password,
        options: { authFlowType: flow as any },
      });
      console.log('[Auth] signIn result', res);
      return res as unknown as { isSignedIn?: boolean; nextStep?: { signInStep?: string } };
    };

    try {
      let signedIn = false;
      let result: { isSignedIn?: boolean; nextStep?: { signInStep?: string } } | null = null;
      let lastError: any = null;

      for (const flow of ['USER_PASSWORD_AUTH', 'USER_SRP_AUTH'] as const) {
        try {
          result = await attempt(flow);
          if (result?.isSignedIn) {
            signedIn = true;
            break;
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!signedIn) {
        // Handle common next steps (unconfirmed, MFA, etc.)
        const stepKey = result?.nextStep?.signInStep;
        if (stepKey === 'CONFIRM_SIGN_UP') {
          toast({
            title: 'Confirm your account',
            description: 'Please enter the confirmation code sent to your email.',
          });
          return navigate('/signup');
        }
        if (stepKey === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
          setStep('newPassword');
          toast({
            title: 'New password required',
            description: 'Please set a new password to complete sign-in.',
          });
          return;
        }
        if (stepKey && stepKey !== 'DONE') {
          throw new Error(`Additional verification required: ${stepKey}`);
        }
        // If no structured next step, throw the last error
        throw lastError || new Error('Unable to sign in.');
      }

      // Ensure credentials are materialized for S3/Dynamo immediately
      try {
        await fetchAuthSession({ forceRefresh: true });
      } catch (e) {
        console.warn('[Auth] fetchAuthSession post-signin failed', e);
      }

      toast({
        title: 'Welcome back!',
        description: 'You have been successfully signed in.',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description:
          error?.message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await confirmSignIn({ challengeResponse: newPassword });
      await fetchAuthSession({ forceRefresh: true });
      toast({ title: 'Password updated', description: 'You are now signed in.' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold">M</span>
            </div>
            <span className="text-2xl font-semibold text-foreground">Metastream</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'login' ? (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
                  </p>
                </div>
              </>
            ) : (
              <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" placeholder="Enter a new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Updating...' : 'Set New Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;