"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type Option = {
  value: string;
  label: string;
};

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  maxSelected?: number;
  allowCreate?: boolean;
  onCreateOption?: (label: string) => Promise<Option | null>;
  creatingLabel?: string;
}

export function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder = "Seleccionar...",
  className,
  maxSelected,
  allowCreate = false,
  onCreateOption,
  creatingLabel = "Creando...",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const handleUnselect = (value: string) => {
    onChange(selected.filter((s) => s !== value));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      handleUnselect(value);
    } else {
      if (maxSelected && selected.length >= maxSelected) {
        return;
      }
      onChange([...selected, value]);
    }
    setInputValue("");
  };

  const handleCreateOption = async () => {
    if (!inputValue.trim() || !allowCreate || !onCreateOption || creating) {
      return;
    }

    setCreating(true);
    try {
      const newOption = await onCreateOption(inputValue.trim());
      if (newOption) {
        // Add the new option to selected
        onChange([...selected, newOption.value]);
        setInputValue("");
        setOpen(false);
      }
    } catch (error) {
      console.error("Error creating option:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim() && allowCreate) {
      e.preventDefault();
      if (filtered.length === 0) {
        handleCreateOption();
      }
    }
  };

  const selectables = options.filter(
    (option) => !selected.includes(option.value)
  );

  // Filter by input value
  const filtered = inputValue
    ? selectables.filter((option) =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : selectables;

  return (
    <div className={className}>
      <div className="group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => {
            const option = options.find((o) => o.value === value);
            if (!option) return null;
            return (
              <Badge key={value} variant="secondary">
                {option.label}
                <button
                  type="button"
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(value);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(value)}
                  aria-label={`Remover ${option.label}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 200);
            }}
            placeholder={selected.length === 0 ? placeholder : ""}
            className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px]"
            disabled={creating}
          />
        </div>
      </div>
      {open && (filtered.length > 0 || (allowCreate && inputValue.trim())) && (
        <div className="relative mt-2">
          <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <Command shouldFilter={false}>
              <CommandList>
                <CommandGroup className="max-h-64 overflow-auto">
                  {filtered.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                  {allowCreate &&
                    inputValue.trim() &&
                    filtered.length === 0 && (
                      <CommandItem
                        value={inputValue}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={handleCreateOption}
                        className="cursor-pointer text-primary"
                        disabled={creating}
                      >
                        {creating ? (
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            {creatingLabel}
                          </span>
                        ) : (
                          <span>
                            Crear "{inputValue}"{" "}
                            <span className="text-xs text-muted-foreground">
                              (Presiona Enter)
                            </span>
                          </span>
                        )}
                      </CommandItem>
                    )}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      )}
    </div>
  );
}
