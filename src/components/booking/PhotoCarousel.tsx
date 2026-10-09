import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Scissors, ZoomIn } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { orderPhotos, photoUrl, type Photo } from "@/lib/booking";

type Props = { photos: Photo[]; barberName: string };

// Marketplace-style product gallery: main image with prev/next, a thumbnail strip,
// and click-to-zoom. Featured photos come first.
export default function PhotoCarousel({ photos, barberName }: Props) {
  const ordered = orderPhotos(photos);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  const step = useCallback(
    (dir: -1 | 1) =>
      setZoomed((z) => (z === null ? z : (z + dir + ordered.length) % ordered.length)),
    [ordered.length],
  );

  if (ordered.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-sand text-muted-foreground">
        <Scissors className="h-10 w-10 opacity-60" />
        <span className="text-sm">還沒有作品照 / No photos yet</span>
      </div>
    );
  }

  const zoomedPhoto = zoomed === null ? undefined : ordered[zoomed];
  const alt = (p: Photo, i: number) => p.caption ?? `${barberName} 的作品 ${i + 1}`;

  return (
    <div>
      <Carousel setApi={setApi} opts={{ loop: ordered.length > 1 }} className="relative">
        <CarouselContent>
          {ordered.map((p, i) => (
            <CarouselItem key={p.id}>
              <button
                type="button"
                onClick={() => setZoomed(i)}
                className="group relative block w-full overflow-hidden rounded-3xl bg-sand"
                aria-label={`放大第 ${i + 1} 張 / Zoom photo ${i + 1}`}
              >
                <img
                  src={photoUrl(p.storage_path)}
                  alt={alt(p, i)}
                  className="aspect-[4/3] w-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
                <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-card/90 px-3 py-1 text-xs opacity-0 transition group-hover:opacity-100">
                  <ZoomIn className="h-3.5 w-3.5" /> 點擊放大
                </span>
                {p.is_featured && (
                  <span className="absolute top-3 left-3 rounded-full bg-card px-3 py-1 text-xs font-medium">
                    ★ 精選 Featured
                  </span>
                )}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {ordered.length > 1 && (
          <>
            <CarouselPrevious className="left-3 h-10 w-10 bg-card/90" />
            <CarouselNext className="right-3 h-10 w-10 bg-card/90" />
          </>
        )}
      </Carousel>

      {ordered.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
          {ordered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`第 ${i + 1} 張 / Photo ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`shrink-0 overflow-hidden rounded-xl border-2 transition ${i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <img
                src={photoUrl(p.storage_path)}
                alt=""
                className="h-16 w-16 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={zoomed !== null} onOpenChange={(o) => !o && setZoomed(null)}>
        <DialogContent
          className="max-w-4xl border-none bg-transparent p-0 shadow-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
        >
          <DialogTitle className="sr-only">{barberName} 作品照</DialogTitle>
          {zoomedPhoto && zoomed !== null && (
            <div className="relative">
              <img
                src={photoUrl(zoomedPhoto.storage_path)}
                alt={alt(zoomedPhoto, zoomed)}
                className="max-h-[85vh] w-full rounded-2xl object-contain"
              />
              {zoomedPhoto.caption && (
                <p className="mt-3 text-center text-sm text-white">{zoomedPhoto.caption}</p>
              )}
              {ordered.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous photo"
                    className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-card/90 p-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next photo"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-card/90 p-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
