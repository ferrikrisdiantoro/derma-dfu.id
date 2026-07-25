import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Check if user is admin
        if (data.user) {
          const { data: roles } = await (supabase as any)
            .from("user_roles")
            .select("*")
            .eq("user_id", data.user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (roles) {
            toast({
              title: "Login berhasil",
              description: "Selamat datang Admin!",
            });
            navigate("/admin");
          } else {
            toast({
              title: "Login berhasil",
              description: "Selamat datang kembali!",
            });
            navigate("/");
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Registrasi berhasil",
          description: "Akun Anda telah dibuat. Silakan login.",
        });

        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background">
        {/* Simple Navbar for Auth */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-md">
          <div className="container mx-auto px-4 py-4">
            <button 
              onClick={() => navigate("/")}
              className="text-2xl font-bold text-heading hover:opacity-80 transition-opacity"
            >
              DERMA-DFU.ID
            </button>
          </div>
        </header>

        {/* Auth Form */}
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{isLogin ? "Login" : "Register"}</CardTitle>
              <CardDescription>
                {isLogin
                  ? "Masuk ke akun Anda untuk melanjutkan"
                  : "Buat akun baru untuk memulai"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : isLogin ? "Login" : "Register"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIsLogin(!isLogin)}
                  disabled={loading}
                >
                  {isLogin
                    ? "Belum punya akun? Register"
                    : "Sudah punya akun? Login"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer Warning */}
        <footer className="sticky bottom-0 bg-warning/10 border-t border-warning/30 backdrop-blur">
          <div className="container mx-auto px-4 py-2">
            <p className="text-xs text-center text-body">
              Aplikasi demo. Bukan pengganti dokter. Jika ada tanda bahaya, rujuk dalam 48 jam.
            </p>
          </div>
        </footer>
      </div>
    </LanguageProvider>
  );
}
