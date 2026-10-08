import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const myBarbersKey = (shopId: string) => ["barbers", shopId];

// All barbers owned by this shop (a shop can run many).
export function useMyBarbers(shopId: string) {
  return useQuery({
    queryKey: myBarbersKey(shopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}
