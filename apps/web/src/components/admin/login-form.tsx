"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export function LoginForm() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const locale = params.locale || "en";

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Login Failed", {
          description: "Invalid email or password. Only registered admins can access this area.",
        });
      } else {
        toast.success("Login Successful", {
          description: "Redirecting to dashboard...",
        });
        router.push(`/${locale}/admin`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="you@snaprace.com" autoComplete="email" disabled={isLoading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLoading ? "Signing in..." : "Login to Admin"}
        </Button>
      </form>
    </Form>
  );
}
