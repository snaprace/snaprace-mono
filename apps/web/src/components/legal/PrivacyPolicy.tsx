"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, Shield, Eye, Camera, FileText } from "lucide-react";

export function PrivacyPolicy() {
  const lastUpdated = "September 14, 2025";
  const effectiveDate = "September 14, 2025";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <div className="text-muted-foreground flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Effective Date: {effectiveDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Last Updated: {lastUpdated}</span>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              1. Introduction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This Privacy Policy explains how we (&quot;SnapRace,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collect, use,
              and share information in connection with our photo identification
              and gallery services (the &quot;Service&quot;). Our mission is to
              help you, the participant, find your race photos quickly and
              easily.
            </p>
            <p>
              This policy applies to the participants of events
              (&quot;Events&quot;) organized by our clients, the race organizers
              (&quot;Organizers&quot;).
            </p>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-green-600" />
              2. Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Information from Race Organizers:
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Event Photos:</strong> We receive official event
                  photos taken by or on behalf of the Organizer.
                </li>
                <li>
                  <strong>Participant Data:</strong> We may receive limited data
                  about you from the Organizer, such as your name and assigned
                  bib number for the event.
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Information from Your Photos:
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Bib Numbers:</strong> Our technology automatically
                  scans event photos to detect and read bib numbers.
                </li>
                <li>
                  <strong>Biometric Information (Facial Geometry):</strong> When
                  we process photos, our technology detects faces and creates a
                  unique numeric representation of each face (a &quot;face
                  vector&quot; or &quot;embedding&quot;). Please see our
                  detailed Biometric Information Policy in Section 4 below.
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Information You Provide Directly:
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>Selfies and Bib Numbers:</strong> If you use our
                  selfie search feature, you provide us with a photo of yourself
                  (a &quot;selfie&quot;) and your bib number for a specific
                  event.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Your Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              3. How We Use Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              We use the information we collect for one primary purpose: to
              provide and improve our Service. This includes:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>Generating Your Photo Gallery:</strong> To automatically
                identify and group all of your photos from an event into a
                personal gallery.
              </li>
              <li>
                <strong>Linking Photos:</strong> To associate photos with you
                via bib number detection and/or facial recognition.
              </li>
              <li>
                <strong>Enabling Selfie Search:</strong> To allow you to find
                your photos by providing a selfie and bib number.
              </li>
              <li>
                <strong>Improving Our Service:</strong> To enhance the accuracy
                of our photo identification technology.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Biometric Information Policy */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              4. Biometric Information Policy
              <Badge
                variant="outline"
                className="ml-2 border-orange-600 text-orange-600"
              >
                Important
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-semibold text-orange-800">
              Your trust is our priority. We are committed to handling your
              biometric information responsibly and transparently.
            </p>

            <div className="grid gap-4">
              <div>
                <h4 className="font-semibold">What We Collect:</h4>
                <p>
                  We collect a numeric representation of your facial geometry
                  from event photos and any selfies you provide. We do not store
                  your actual facial data. We do not collect or store scans of
                  your eyes, fingerprints, or voice.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Purpose of Collection:</h4>
                <p>
                  This facial geometry data is used exclusively to identify and
                  group your race photos for a specific event. It is the key to
                  finding photos where your bib number is not visible.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Consent:</h4>
                <p>
                  Your consent to the collection and use of this biometric
                  information is obtained by the Race Organizer through the
                  event registration waiver you agree to when you sign up for
                  the race.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Prohibition on Profiting:</h4>
                <p>
                  We will never sell, lease, trade, or otherwise profit from
                  your biometric information.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Data Retention & Destruction:</h4>
                <p>
                  We will permanently destroy your biometric information from
                  our systems upon the earlier of: (a) your request to delete
                  your data, or (b) no more than three (3) years after our last
                  interaction with you.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How We Share Your Information */}
        <Card>
          <CardHeader>
            <CardTitle>5. How We Share Your Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We do not share your personal information with third parties
              except in the limited circumstances described below:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>With Race Organizers:</strong> We provide the final,
                organized photo galleries to the Organizer of the event you
                participated in.
              </li>
              <li>
                <strong>With Service Providers:</strong> We use trusted
                third-party vendors to provide the underlying technology for our
                service, such as cloud hosting and facial recognition APIs
                (e.g., Amazon Web Services). These vendors are contractually
                obligated to protect your data.
              </li>
              <li>
                <strong>For Legal Reasons:</strong> We may share information if
                required by law or to protect the rights, property, or safety of
                SnapRace, our users, or the public.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card>
          <CardHeader>
            <CardTitle>6. Data Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We implement reasonable and appropriate technical and
              organizational security measures to protect your information from
              unauthorized access, use, or disclosure. This includes data
              encryption at rest and in transit and strict access controls.
            </p>
          </CardContent>
        </Card>

        {/* Your Rights and Choices */}
        <Card>
          <CardHeader>
            <CardTitle>7. Your Rights and Choices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You have control over your information.</p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>Accessing Your Photos:</strong> You can access your
                photos through the gallery provided by your Race Organizer.
              </li>
              <li>
                <strong>Deleting Your Data (Opt-Out):</strong> You have the
                right to request the deletion of your photos and any associated
                biometric information from our systems at any time. To do so,
                please contact us at{" "}
                <a
                  href="mailto:snaprace.info@gmail.com"
                  className="text-blue-600 hover:underline"
                >
                  snaprace.info@gmail.com
                </a>{" "}
                with the event name, your name, and your bib number. We will
                process your request in a timely manner.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>8. Children&apos;s Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Our Service is not directed to children under the age of 16, and
              we do not knowingly collect personal information from them. If we
              become aware that we have collected information from a child
              without parental consent, we will take steps to delete it.
            </p>
          </CardContent>
        </Card>

        {/* Changes to This Policy */}
        <Card>
          <CardHeader>
            <CardTitle>9. Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new policy on this page
              and updating the &quot;Last Updated&quot; date.
            </p>
          </CardContent>
        </Card>

        {/* Contact Us */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              10. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at{" "}
              <a
                href="mailto:snaprace.info@gmail.com"
                className="font-semibold text-blue-600 hover:underline"
              >
                snaprace.info@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
