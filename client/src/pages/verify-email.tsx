import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function VerifyEmail() {
    usePageTitle('Verify Email');
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            // Extract token from URL
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (!token) {
                setStatus('error');
                setMessage('No verification token provided');
                return;
            }

            try {
                const response = await apiRequest("POST", "/api/auth?action=verify-email", {
                    token,
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Verification failed");
                }

                const data = await response.json();
                setStatus('success');
                setMessage(data.message);

                toast({
                    title: "Success",
                    description: data.message,
                });

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    setLocation("/login");
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error instanceof Error ? error.message : "Verification failed");

                toast({
                    title: "Verification Failed",
                    description: error instanceof Error ? error.message : "Verification failed",
                    variant: "destructive",
                });
            }
        };

        verifyEmail();
    }, [toast, setLocation]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <img src="/favicon.png" alt="Landee & Moony" className="h-12 w-12 mr-3" />
                        <h1 className="text-3xl font-bold">Landee & Moony</h1>
                    </div>
                    <p className="text-muted-foreground">Email Verification</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center">
                            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
                            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
                            {status === 'error' && <XCircle className="h-6 w-6 text-destructive" />}
                            <span className="ml-2">
                                {status === 'loading' && 'Verifying...'}
                                {status === 'success' && 'Verified!'}
                                {status === 'error' && 'Verification Failed'}
                            </span>
                        </CardTitle>
                        <CardDescription className="text-center">
                            {status === 'loading' && 'Please wait while we verify your email address...'}
                            {status === 'success' && 'Your email has been successfully verified'}
                            {status === 'error' && 'We encountered an issue verifying your email'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">{message}</p>
                        </div>

                        {status === 'success' && (
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Redirecting to login in 3 seconds...
                                </p>
                                <Button onClick={() => setLocation("/login")} className="w-full">
                                    Go to Login
                                </Button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="space-y-2">
                                <Button onClick={() => setLocation("/register")} variant="outline" className="w-full">
                                    Back to Registration
                                </Button>
                                <Button onClick={() => setLocation("/login")} className="w-full">
                                    Try Logging In
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Back to Home */}
                <div className="text-center mt-4">
                    <button
                        onClick={() => setLocation("/")}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        ← Back to home
                    </button>
                </div>
            </div>
        </div>
    );
}
