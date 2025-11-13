import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "404 - Page Not Found | SnapRace",
  description: "The page you are looking for does not exist.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-primary mb-2 text-8xl font-bold">404</h1>
        <h2 className="text-foreground mb-4 text-3xl font-bold">
          Page Not Found
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/">
            <Button size="lg" className="w-full sm:w-auto">
              <Home className="mr-2 h-5 w-5" />
              Go to Home
            </Button>
          </Link>
          <Link href="/events">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Search className="mr-2 h-5 w-5" />
              Browse Events
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
