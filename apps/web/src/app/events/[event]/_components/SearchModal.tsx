"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

export function SearchModal({ isOpen, onClose, eventId }: SearchModalProps) {
  const router = useRouter();
  const [searchBib, setSearchBib] = useState("");

  // 모달 열릴 때 검색어 초기화
  useEffect(() => {
    if (isOpen) {
      setSearchBib("");
    }
  }, [isOpen]);

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBib.trim()) {
      onClose();
      router.push(`/events/${eventId}/${searchBib.trim()}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search by Bib Number</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBibSearch} className="space-y-4">
          <Input
            type="number"
            pattern="[0-9]*"
            inputMode="numeric"
            placeholder="Enter bib number"
            value={searchBib}
            onChange={(e) => setSearchBib(e.target.value)}
            className="bg-background border-border w-full text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={!searchBib.trim()}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

