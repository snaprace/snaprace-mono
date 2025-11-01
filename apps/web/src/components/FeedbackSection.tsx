"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trackFeedbackSubmit } from "@/lib/analytics";

interface FeedbackSectionProps {
  eventId: string;
  bibNumber: string;
  eventName: string;
}

export function FeedbackSection({
  eventId,
  bibNumber,
  eventName,
}: FeedbackSectionProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track feedback section view
  useEffect(() => {
    // Feedback section view tracking removed for simplicity
  }, [eventId, bibNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          bibNumber,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (response.ok) {
        // Track successful feedback submission
        trackFeedbackSubmit({
          event_id: eventId,
          bib_number: bibNumber,
          rating,
          has_comment: !!comment.trim()
        });

        toast.success("Thank you for your feedback!", {
          description: "Your feedback helps us improve our service.",
        });
        setRating(0);
        setComment("");
      } else {
        toast.error("Failed to submit feedback", {
          description: "Please try again later.",
        });
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error("Failed to submit feedback", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-muted sm:mx-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MessageSquare className="text-primary h-4 w-4 shrink-0 bg-white sm:h-5 sm:w-5" />
          <span className="leading-tight">
            How was your SnapRace experience?
          </span>
        </CardTitle>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Help us improve our service for {eventName}
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Rate your experience
            </label>
            <div className="flex items-center justify-center gap-2 py-2 sm:justify-start">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="touch-manipulation p-2 transition-all hover:scale-110 active:scale-95 sm:p-1"
                >
                  <Star
                    className={`h-8 w-8 transition-colors sm:h-6 sm:w-6 ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300 hover:text-yellow-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="text-center sm:text-left">
                <span className="text-muted-foreground text-sm font-medium">
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent"}
                </span>
              </div>
            )}
          </div>

          {/* Optional Comment */}
          <div className="space-y-3">
            <label htmlFor="comment" className="block text-sm font-medium">
              Additional comments (optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Tell us what you loved or what we could improve..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px] resize-none bg-white text-sm sm:min-h-[80px] sm:text-sm"
              maxLength={500}
            />
            <div className="text-muted-foreground text-right text-xs">
              {comment.length}/500
            </div>
          </div>

          {/* Submit Section */}
          <div className="space-y-3 pt-2">
            <p className="text-muted-foreground text-center text-xs sm:text-left">
              Your feedback helps us improve our service
            </p>
            <div className="flex justify-center sm:justify-end">
              <Button
                type="submit"
                disabled={!rating || isSubmitting}
                className="min-h-[44px] w-full gap-2 sm:min-h-auto sm:w-auto"
                size="default"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
