"use client";

import { useState, useEffect, useCallback } from "react";
import { searchSecuritiesAction } from "@/lib/actions/securities";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SecurityOption {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

interface Props {
  value: string | null;
  onChange: (securityId: string | null, security: SecurityOption | null) => void;
  onCreateNew?: () => void;
}

export function SecurityCombobox({ value, onChange, onCreateNew }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SecurityOption[]>([]);
  const [selected, setSelected] = useState<SecurityOption | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setOptions([]);
      return;
    }
    const results = await searchSecuritiesAction(q);
    setOptions(results);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? `${selected.symbol} — ${selected.name}` : "Select security..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by symbol or name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              No securities found.
              {onCreateNew && (
                <Button
                  variant="link"
                  className="mt-1 h-auto p-0 text-sm"
                  onClick={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                >
                  Create new security
                </Button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((sec) => (
                <CommandItem
                  key={sec.id}
                  value={sec.id}
                  onSelect={() => {
                    setSelected(sec);
                    onChange(sec.id, sec);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{sec.symbol}</span>
                  <span className="ml-2 text-muted-foreground">{sec.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{sec.exchange} · {sec.currency}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
