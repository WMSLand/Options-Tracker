import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Auth = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#18181B] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-3xl text-white">Welcome</CardTitle>
          <CardDescription className="text-zinc-400">
            Sign in to access your options tracker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-400 text-center py-8">
            Authentication is optional. You can use the app as a guest.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
