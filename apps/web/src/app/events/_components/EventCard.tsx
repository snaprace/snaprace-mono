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
  return (
    <div className="text-center">
      <Link href={`/events/${id}`} className="block cursor-pointer">
        {/* Event Image */}
        <div className="relative mb-4 aspect-4/3 w-full overflow-hidden">
          <Image
            src={
              Boolean(image)
                ? image
                : "/images/partners/partner-millenniumrunning.png"
            }
            alt={name}
            fill
            className="object-contain transition-opacity duration-300 hover:opacity-80"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={(e) => {
              e.currentTarget.src =
                "/images/partners/partner-millenniumrunning.png";
            }}
            priority
          />

          {/* Status Badge */}
          {/* <div className="absolute top-3 right-3">
            <div className="bg-background/90 rounded-full px-2 py-1 backdrop-blur-sm">
              <span className="text-foreground text-xs font-medium">
                Available Now
              </span>
            </div>
          </div> */}
        </div>

        {/* Event Info */}
        <div className="space-y-1">
          <h3 className="text-foreground tablet:text-xl text-lg font-medium">
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
