import {
  type RouterInputs as _RouterInputs,
  type RouterOutputs as _RouterOutputs,
} from "@/trpc/react";

export type RouterInputs = _RouterInputs;
export type RouterOutputs = _RouterOutputs;

// Events
export type EventEntity = RouterOutputs["events"]["getAll"][number];
export type EventById = RouterOutputs["events"]["getById"];

// Galleries
export type GalleriesList = RouterOutputs["galleries"]["getAllByEventId"];
export type GalleryByBib = RouterOutputs["galleries"]["getByBibNumber"];
export type GalleriesGetByBibInput = RouterInputs["galleries"]["getByBibNumber"];
export type GalleriesGetAllInput = RouterInputs["galleries"]["getAllByEventId"];

type TimingQueryOutput = RouterOutputs["results"]["getTimingByBib"];

export type ResultsByBib = TimingQueryOutput;

export type TimingDetail = TimingQueryOutput extends (infer Item)[]
  ? Item
  : TimingQueryOutput extends object
    ? TimingQueryOutput
    : never;
