import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export interface OperationContext { supabase: SupabaseClient<Database>; userId: string; request?: Request }
export interface Operation<D, R> { method: "GET" | "POST"; validate: (raw: unknown) => D; execute: (args: {data:D;context:OperationContext}) => Promise<R> }
export function defineOperation<D = undefined>(options: {method:"GET"|"POST"}, validate: (raw:unknown)=>D = (()=>undefined as D)) {
  return {
    inputValidator<N>(validator:(raw:unknown)=>N) { return defineOperation<N>(options, validator); },
    handler<R>(execute:(args:{data:D;context:OperationContext})=>Promise<R>):Operation<D,R> {return {method:options.method,validate,execute};}
  };
}
