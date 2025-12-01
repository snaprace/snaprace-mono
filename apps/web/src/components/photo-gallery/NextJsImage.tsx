import Image from "next/image";
import {
  isImageFitCover,
  isImageSlide,
  useLightboxProps,
  useLightboxState,
  type Slide,
  type SlideImage,
} from "yet-another-react-lightbox";
import { formatInstagramHandle } from "@/utils/instagram";

function isNextJsImage(
  slide: Slide,
): slide is SlideImage & { width: number; height: number } {
  return (
    isImageSlide(slide) &&
    typeof slide.width === "number" &&
    typeof slide.height === "number"
  );
}

export default function NextJsImage({
  slide,
  offset,
  rect,
}: {
  slide: Slide;
  offset: number;
  rect: { width: number; height: number };
}) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps();

  const { currentIndex } = useLightboxState();
  const cover = isImageSlide(slide) && isImageFitCover(slide, imageFit);

  if (!isNextJsImage(slide)) return undefined;

  const width = !cover
    ? Math.round(
        Math.min(rect.width, (rect.height / slide.height) * slide.width),
      )
    : rect.width;

  const height = !cover
    ? Math.round(
        Math.min(rect.height, (rect.width / slide.width) * slide.height),
      )
    : rect.height;

  const { displayHandle, instagramUrl } = formatInstagramHandle(
    slide.instagramHandle,
  );

  return (
    <div style={{ position: "relative", width, height }}>
      <Image
        fill
        alt=""
        src={slide.src}
        loading="eager"
        draggable={false}
        placeholder={slide.blurDataURL ? "blur" : "empty"}
        blurDataURL={slide.blurDataURL}
        style={{
          objectFit: cover ? "cover" : "contain",
          cursor: click ? "pointer" : undefined,
        }}
        sizes={
          typeof window !== "undefined"
            ? `${Math.ceil((width / window.innerWidth) * 100)}vw`
            : "100vw"
        }
        onClick={
          offset === 0
            ? () => {
                click?.({ index: currentIndex });
              }
            : undefined
        }
      />
      {/* Instagram Handle */}
      {displayHandle && instagramUrl && (
        <div className="absolute bottom-1 left-2 z-1000 md:bottom-2 md:left-2">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-white/90 drop-shadow-md transition-colors duration-200 ease-in-out hover:text-white md:text-sm"
          >
            {displayHandle}
          </a>
        </div>
      )}
    </div>
  );
}
