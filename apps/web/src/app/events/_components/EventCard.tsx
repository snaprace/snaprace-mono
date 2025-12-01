"use client";

import Link from "next/link";
import Image from "next/image";
import { displayDate } from "@/utils/date";

interface EventCardProps {
  id: string;
  name: string;
  image: string;
  date: string;
}

export default function EventCard({ id, name, image, date }: EventCardProps) {
  const imageUrl = image || "/images/no-image.jpg";
  const isExternal =
    imageUrl.startsWith("http") || imageUrl.startsWith("https");

  return (
    <div className="text-center">
      <Link href={`/events/${id}`} className="block cursor-pointer">
        {/* Event Image */}
        <div className="relative mb-4 aspect-4/3 w-full overflow-hidden">
          <Image
            src={imageUrl}
            alt={name}
            fill
            unoptimized={isExternal}
            className="object-contain transition-opacity duration-300 hover:opacity-80"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={(e) => {
              e.currentTarget.src = "/images/no-image.jpg";
            }}
            priority
          />
        </div>

        {/* Event Info */}
        <div className="space-y-1">
          <h3 className="text-foreground text-md font-medium md:text-lg">
            {name}
          </h3>
          <p className="text-muted-foreground tablet:text-base text-sm">
            {displayDate(date)}
          </p>
        </div>
      </Link>
    </div>
  );
}
