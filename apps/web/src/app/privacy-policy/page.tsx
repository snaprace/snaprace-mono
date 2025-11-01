import { type Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";

export const metadata: Metadata = {
  title: "Privacy Policy - SnapRace",
  description: "Learn how SnapRace collects, uses, and protects your personal information, including our biometric information policy for facial recognition services.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <PrivacyPolicy />
    </div>
  );
}