import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <a href="/" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Command className="size-6" />
              </div>
              <span className="text-xl font-bold">SnapRace Admin</span>
            </a>
          </div>
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Enter your email to access your organizer dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
