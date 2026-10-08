import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { isChatCapable } from "@/lib/ai/models";
import type { Model, Provider } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ModelPicker({
  models,
  providers,
  value,
  onChange,
  className,
}: {
  models: Model[];
  providers: Provider[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => {
    const usable = models.filter((m) => m.is_available && isChatCapable(m));
    return providers
      .map((p) => ({ provider: p, models: usable.filter((m) => m.provider_id === p.id).slice(0, 400) }))
      .filter((g) => g.models.length);
  }, [models, providers]);
  const selected = models.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-10 justify-between gap-2", className)}>
          <span className="truncate font-mono text-sm" dir="ltr">
            {selected?.display_name ?? t.chat.pickModel}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t.models.searchPh} />
          <CommandList className="max-h-80">
            <CommandEmpty>{t.models.noMatch}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.provider.id} heading={g.provider.name}>
                {g.models.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.display_name} ${m.external_model_id} ${g.provider.name}`}
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === m.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate font-mono text-[13px]" dir="ltr">
                      {m.display_name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
