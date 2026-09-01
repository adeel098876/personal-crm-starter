import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "glass-input flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none transition-all active:scale-[0.98] disabled:opacity-50 w-full cursor-pointer",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{date ? format(date, "MMM d, yyyy") : placeholder}</span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl rounded-2xl z-50"
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onDateChange?.(d);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
