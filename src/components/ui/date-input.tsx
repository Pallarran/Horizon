"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  name?: string;
  defaultValue?: string; // YYYY-MM-DD
  required?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

/**
 * Segmented date input (YYYY-MM-DD) with auto-advance between fields.
 * Renders three numeric inputs that look like a single input.
 */
export function DateInput({ name, defaultValue, required, className, onChange }: DateInputProps) {
  const parts = defaultValue?.split("-") ?? [];
  const [year, setYear] = React.useState(parts[0] ?? "");
  const [month, setMonth] = React.useState(parts[1] ?? "");
  const [day, setDay] = React.useState(parts[2] ?? "");

  const yearRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [focused, setFocused] = React.useState(false);

  const value = year && month && day
    ? `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    : "";

  React.useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  const handleYear = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYear(v);
    if (v.length === 4) monthRef.current?.focus();
  };

  const handleMonth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(v, 10);
    if (v.length === 2 && (num < 1 || num > 12)) return;
    setMonth(v);
    if (v.length === 2) dayRef.current?.focus();
  };

  const handleDay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(v, 10);
    if (v.length === 2 && (num < 1 || num > 31)) return;
    setDay(v);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    prevRef: React.RefObject<HTMLInputElement | null>,
    currentValue: string,
  ) => {
    if (e.key === "Backspace" && currentValue === "" && prevRef.current) {
      e.preventDefault();
      prevRef.current.focus();
    }
  };

  const handleFocus = () => setFocused(true);
  const handleBlur = (e: React.FocusEvent) => {
    // Only unfocus if the new target is outside our container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setFocused(false);
      // Pad values on blur
      if (month && month.length === 1) setMonth(month.padStart(2, "0"));
      if (day && day.length === 1) setDay(day.padStart(2, "0"));
    }
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <div
        ref={containerRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "flex h-9 items-center gap-0 rounded-md border border-input bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow]",
          focused && "border-ring ring-[3px] ring-ring/50",
          "dark:bg-input/30",
          className,
        )}
      >
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          placeholder="YYYY"
          value={year}
          onChange={handleYear}
          required={required}
          className="w-[3.2ch] bg-transparent text-center text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <span className="text-muted-foreground">-</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          placeholder="MM"
          value={month}
          onChange={handleMonth}
          onKeyDown={(e) => handleKeyDown(e, yearRef, month)}
          className="w-[2.2ch] bg-transparent text-center text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <span className="text-muted-foreground">-</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          placeholder="DD"
          value={day}
          onChange={handleDay}
          onKeyDown={(e) => handleKeyDown(e, monthRef, day)}
          className="w-[2.2ch] bg-transparent text-center text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
    </>
  );
}
