"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, Shield, Eye, Camera, FileText } from "lucide-react";

export function PrivacyPolicy() {
  const t = useTranslations("privacy");
  const lastUpdated = "September 14, 2025";
  const effectiveDate = "September 14, 2025";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
          <div className="text-muted-foreground flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {t("effectiveDate")}: {effectiveDate}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>
                {t("lastUpdated")}: {lastUpdated}
              </span>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              {t("section1.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{t("section1.p1")}</p>
            <p>{t("section1.p2")}</p>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-green-600" />
              {t("section2.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-3 text-lg font-semibold">
                {t("section2.fromOrganizers")}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>{t("section2.eventPhotos")}</strong>{" "}
                  {t("section2.eventPhotosDesc")}
                </li>
                <li>
                  <strong>{t("section2.participantData")}</strong>{" "}
                  {t("section2.participantDataDesc")}
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-lg font-semibold">
                {t("section2.fromPhotos")}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>{t("section2.bibNumbers")}</strong>{" "}
                  {t("section2.bibNumbersDesc")}
                </li>
                <li>
                  <strong>{t("section2.biometricInfo")}</strong>{" "}
                  {t("section2.biometricInfoDesc")}
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-lg font-semibold">
                {t("section2.fromYou")}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>
                  <strong>{t("section2.selfiesAndBibs")}</strong>{" "}
                  {t("section2.selfiesAndBibsDesc")}
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
              {t("section3.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{t("section3.intro")}</p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>{t("section3.gallery")}</strong>{" "}
                {t("section3.galleryDesc")}
              </li>
              <li>
                <strong>{t("section3.linking")}</strong>{" "}
                {t("section3.linkingDesc")}
              </li>
              <li>
                <strong>{t("section3.selfieSearch")}</strong>{" "}
                {t("section3.selfieSearchDesc")}
              </li>
              <li>
                <strong>{t("section3.improving")}</strong>{" "}
                {t("section3.improvingDesc")}
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Biometric Information Policy */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              {t("section4.title")}
              <Badge
                variant="outline"
                className="ml-2 border-orange-600 text-orange-600"
              >
                {t("section4.important")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-semibold text-orange-800">
              {t("section4.intro")}
            </p>

            <div className="grid gap-4">
              <div>
                <h4 className="font-semibold">{t("section4.whatWeCollect")}</h4>
                <p>{t("section4.whatWeCollectDesc")}</p>
              </div>

              <div>
                <h4 className="font-semibold">{t("section4.purpose")}</h4>
                <p>{t("section4.purposeDesc")}</p>
              </div>

              <div>
                <h4 className="font-semibold">{t("section4.consent")}</h4>
                <p>{t("section4.consentDesc")}</p>
              </div>

              <div>
                <h4 className="font-semibold">{t("section4.prohibition")}</h4>
                <p>{t("section4.prohibitionDesc")}</p>
              </div>

              <div>
                <h4 className="font-semibold">{t("section4.retention")}</h4>
                <p>{t("section4.retentionDesc")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How We Share Your Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("section5.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{t("section5.intro")}</p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>{t("section5.withOrganizers")}</strong>{" "}
                {t("section5.withOrganizersDesc")}
              </li>
              <li>
                <strong>{t("section5.withProviders")}</strong>{" "}
                {t("section5.withProvidersDesc")}
              </li>
              <li>
                <strong>{t("section5.forLegal")}</strong>{" "}
                {t("section5.forLegalDesc")}
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card>
          <CardHeader>
            <CardTitle>{t("section6.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("section6.content")}</p>
          </CardContent>
        </Card>

        {/* Your Rights and Choices */}
        <Card>
          <CardHeader>
            <CardTitle>{t("section7.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{t("section7.intro")}</p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>
                <strong>{t("section7.accessPhotos")}</strong>{" "}
                {t("section7.accessPhotosDesc")}
              </li>
              <li>
                <strong>{t("section7.deleteData")}</strong>{" "}
                {t("section7.deleteDataDesc")}{" "}
                <a
                  href="mailto:snaprace.info@gmail.com"
                  className="text-blue-600 hover:underline"
                >
                  snaprace.info@gmail.com
                </a>{" "}
                {t("section7.deleteDataSuffix")}
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>{t("section8.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("section8.content")}</p>
          </CardContent>
        </Card>

        {/* Changes to This Policy */}
        <Card>
          <CardHeader>
            <CardTitle>{t("section9.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("section9.content")}</p>
          </CardContent>
        </Card>

        {/* Contact Us */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              {t("section10.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {t("section10.content")}{" "}
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
