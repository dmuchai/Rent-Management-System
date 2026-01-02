import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIdentities } from "@/hooks/useIdentities";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export function LinkedAccountsSection() {
  const { toast } = useToast();
  const { data: identities, isLoading, refetch } = useIdentities();
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    try {
      // Use Supabase client to initiate linking
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
      });

      if (error) {
        console.error('[LinkGoogle] Error:', error);
        toast({
          title: "Link Failed",
          description: error.message || "Failed to link Google account",
          variant: "destructive",
        });
      } else if (data?.url) {
        // Redirect to Google OAuth for linking
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('[LinkGoogle] Unexpected error:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading linked accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Link multiple sign-in methods to your account for easier access. You can use any linked method to sign in.
      </p>

      <div className="space-y-3">
        {/* Email/Password Provider */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <i className="fas fa-envelope text-blue-600"></i>
            </div>
            <div>
              <h4 className="font-medium">Email & Password</h4>
              <p className="text-sm text-muted-foreground">
                Sign in with your email address and password
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {identities?.hasEmailProvider ? (
              <span className="flex items-center text-sm text-green-600 font-medium">
                <i className="fas fa-check-circle mr-1"></i>
                Linked
              </span>
            ) : (
              <span className="flex items-center text-sm text-muted-foreground">
                <i className="fas fa-times-circle mr-1"></i>
                Not linked
              </span>
            )}
          </div>
        </div>

        {/* Google OAuth Provider */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fab fa-google text-red-600"></i>
            </div>
            <div>
              <h4 className="font-medium">Google</h4>
              <p className="text-sm text-muted-foreground">
                Sign in with your Google account
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {identities?.hasGoogleProvider ? (
              <span className="flex items-center text-sm text-green-600 font-medium">
                <i className="fas fa-check-circle mr-1"></i>
                Linked
              </span>
            ) : (
              <Button
                onClick={handleLinkGoogle}
                disabled={isLinking}
                variant="outline"
                size="sm"
              >
                {isLinking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <i className="fas fa-link mr-2"></i>
                    Link Google
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex">
          <i className="fas fa-info-circle text-blue-600 mt-0.5 mr-2"></i>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Linked Accounts</p>
            <p>
              Once you link a Google account, you can sign in using either your email/password or "Sign in with Google".
              This gives you flexibility in how you access your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
