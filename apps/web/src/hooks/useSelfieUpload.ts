import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { api } from "@/trpc/react";

interface SelfieUploadParams {
  eventId: string;
  bibNumber: string;
  organizerId: string;
  existingPhotos?: string[];
  faceSearchOnly: boolean;
}

interface LambdaResponse {
  message: string;
  selfie_matched_photos: string[];
}

const LAMBDA_ENDPOINT_URL =
  "https://p52zmaxn1h.execute-api.us-east-1.amazonaws.com/prd/selfie";
const LAMBDA_TIMEOUT_MS = 30000;

export function useSelfieUpload({
  eventId,
  bibNumber,
  organizerId,
  existingPhotos,
  faceSearchOnly,
}: SelfieUploadParams) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [response, setResponse] = useState<LambdaResponse | null>(null);

  // tRPC mutation for V2 Photo Processing Stack
  const searchBySelfieMutation = api.photos.searchBySelfie.useMutation();

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64String = result.split(",")[1];
        if (base64String) {
          resolve(base64String);
        } else {
          reject(new Error("Failed to extract base64"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  const callLambdaFunction = async (
    base64Image: string,
  ): Promise<LambdaResponse> => {
    const payload = {
      image: base64Image,
      bib_number: bibNumber,
      organizer_id: organizerId,
      event_id: eventId,
    };

    const response = await axios.post<LambdaResponse>(
      LAMBDA_ENDPOINT_URL,
      payload,
      {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(LAMBDA_TIMEOUT_MS),
      },
    );

    if (response.status !== 200) {
      throw new Error(`Server responded with ${response.status}`);
    }

    setIsProcessed(true);

    return response.data;
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Please upload a valid image file (JPG, PNG, or HEIC)");
      return false;
    }

    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB");
      return false;
    }

    return true;
  };

  const uploadSelfie = async (
    file: File,
  ): Promise<{ success: boolean; matchedPhotos: string[] }> => {
    // Check if all required params are available
    if (!(bibNumber || faceSearchOnly) || !eventId) {
      toast.error("Please enter a bib number first");
      return { success: false, matchedPhotos: [] };
    }

    if (!validateFile(file)) {
      return { success: false, matchedPhotos: [] };
    }

    setUploadedFile(file);
    setIsProcessing(true);
    setHasError(false);

    try {
      const base64Image = await convertToBase64(file);

      if (faceSearchOnly) {
        // V2 Photo Processing Stack 사용 (tRPC useMutation)
        const result = await searchBySelfieMutation.mutateAsync({
          organizer: organizerId,
          eventId: eventId,
          selfieImage: base64Image,
        });

        // Lambda에서 이미 CloudFront URL이 조합된 imageUrls를 반환
        const selfieMatchedPhotos = result.imageUrls;

        const existingSet = new Set(existingPhotos ?? []);
        const uniqueSelfieMatchedPhotos = selfieMatchedPhotos.filter(
          (photo) => !existingSet.has(photo),
        );

        setIsProcessed(true);

        if (uniqueSelfieMatchedPhotos.length > 0) {
          toast.success(
            `Successfully matched ${uniqueSelfieMatchedPhotos.length} photos!`,
          );
        } else {
          toast.info(
            result.message ??
              "No additional photos found. Try a different selfie with better lighting or a clearer view of your face.",
          );
        }

        setResponse({
          message: result.message,
          selfie_matched_photos: uniqueSelfieMatchedPhotos,
        });

        return {
          success: uniqueSelfieMatchedPhotos.length > 0,
          matchedPhotos: uniqueSelfieMatchedPhotos,
        };
      } else {
        // 기존 Lambda 함수 사용
        const matchedResult = await callLambdaFunction(base64Image);

        if (matchedResult.selfie_matched_photos.length > 0) {
          toast.success(
            matchedResult?.message ?? "Successfully matched photos!",
          );
        } else {
          toast.info(
            matchedResult.message ??
              "No additional photos found. Try a different photo with clearer face visibility.",
          );
        }

        setResponse(matchedResult);

        return {
          success: matchedResult.selfie_matched_photos.length > 0,
          matchedPhotos: matchedResult.selfie_matched_photos,
        };
      }
    } catch (error) {
      console.error("Selfie upload error:", error);
      setHasError(true);
      setIsProcessed(true);
      toast.error(
        "Failed to process selfie. Please try again with a different photo.",
      );
      return { success: false, matchedPhotos: [] };
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setUploadedFile(null);
    setIsProcessing(false);
    setIsProcessed(false);
    setHasError(false);
    setResponse(null);
  };

  return {
    uploadSelfie,
    isProcessing,
    isProcessed,
    uploadedFile,
    reset,
    response,
    hasError,
  };
}
