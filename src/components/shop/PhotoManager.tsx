import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import ConfirmButton from "@/components/ConfirmButton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ghostBtn } from "@/lib/ui";

const BUCKET = "barber-photos";
const MAX_BYTES = 5 * 1024 * 1024;

type Photo = Tables<"barber_photos">;

function photoUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Sample hairstyle photos for one barber. Files go to <barber_id>/<uuid>.<ext>
// in the public barber-photos bucket; metadata goes to barber_photos.
export default function PhotoManager({ barberId }: { barberId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ["barber_photos", barberId];

  const { data: photos = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_photos")
        .select("*")
        .eq("barber_id", barberId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    let next = photos.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name}: 只能上傳圖片 / images only`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: 檔案太大（上限 5MB）/ max 5 MB`);
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${barberId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) {
        setError(up.error.message);
        continue;
      }
      const ins = await supabase
        .from("barber_photos")
        .insert({ barber_id: barberId, storage_path: path, sort_order: next++ });
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        setError(ins.error.message);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    refresh();
  }

  async function update(
    photo: Photo,
    patch: Partial<Pick<Photo, "is_featured" | "caption" | "sort_order">>,
  ) {
    const { error } = await supabase.from("barber_photos").update(patch).eq("id", photo.id);
    if (error) setError(error.message);
    refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const a = photos[index];
    const b = photos[index + dir];
    if (!a || !b) return;
    // Normalise to positions so equal sort_order values still swap cleanly.
    await Promise.all([
      supabase
        .from("barber_photos")
        .update({ sort_order: index + dir })
        .eq("id", a.id),
      supabase.from("barber_photos").update({ sort_order: index }).eq("id", b.id),
    ]);
    refresh();
  }

  async function remove(photo: Photo) {
    const st = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    if (st.error) return setError(st.error.message);
    const { error } = await supabase.from("barber_photos").delete().eq("id", photo.id);
    if (error) setError(error.message);
    refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">作品照 / Sample hairstyle photos</h4>
        <label
          className={`${ghostBtn} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {busy ? "上傳中…" : "＋ 上傳照片 / Upload"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          還沒有作品照。上傳幾張這位理髮師的代表作吧 / No photos yet.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border bg-background">
              <div className="relative">
                <img
                  src={photoUrl(p.storage_path)}
                  alt={p.caption ?? "Hairstyle photo"}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                {p.is_featured && (
                  <span className="absolute top-2 left-2 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium">
                    ★ 精選
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <input
                  defaultValue={p.caption ?? ""}
                  placeholder="說明 / caption"
                  className="w-full rounded-full border bg-card px-3 py-1.5 text-xs outline-none focus:border-ring"
                  onBlur={(e) => {
                    const caption = e.target.value.trim() || null;
                    if (caption !== p.caption) update(p, { caption });
                  }}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={p.is_featured}
                    onChange={(e) => update(p, { is_featured: e.target.checked })}
                  />
                  精選 / Featured
                </label>
                <div className="flex items-center justify-between">
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Move left"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded-full px-2 py-1 text-xs hover:bg-secondary disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Move right"
                      disabled={i === photos.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded-full px-2 py-1 text-xs hover:bg-secondary disabled:opacity-30"
                    >
                      →
                    </button>
                  </span>
                  <ConfirmButton label="刪除" confirmLabel="確定？" onConfirm={() => remove(p)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
