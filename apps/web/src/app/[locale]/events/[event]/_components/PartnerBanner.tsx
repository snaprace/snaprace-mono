"use client";

import Image from "next/image";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export interface Partner {
  id: string;
  name: string;
  siteUrl: string;
  imageUrl: string;
}

interface PartnerBannerProps {
  partners: Partner[];
}

export function PartnerBanner({ partners }: PartnerBannerProps) {
  if (!partners || partners.length === 0) return null;

  return (
    <div className="w-full border-b bg-white py-6">
      <div className="container mx-auto px-4">
        <h4 className="text-muted-foreground mb-2 text-center text-sm font-semibold tracking-widest uppercase">
          Partners
        </h4>
        <Carousel
          opts={{
            align: "center",
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: 3000,
              stopOnInteraction: false,
            }),
          ]}
          className="mx-auto w-full max-w-6xl"
        >
          <CarouselContent className="-ml-4 items-center md:-ml-8">
            {partners.map((partner) => (
              <CarouselItem
                key={partner.id}
                className="basis-1/3 pl-4 sm:basis-1/4 md:basis-1/5 md:pl-8 lg:basis-1/6"
              >
                <Link
                  href={partner.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex aspect-2/1 items-center justify-center p-2 transition-transform hover:scale-105"
                >
                  <div className="relative h-10 w-full md:h-12">
                    <Image
                      src={partner.imageUrl}
                      alt={partner.name.replace("-", " ")}
                      fill
                      className="object-contain opacity-70 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                      sizes="(max-width: 768px) 33vw, (max-width: 1200px) 20vw, 16vw"
                    />
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}
