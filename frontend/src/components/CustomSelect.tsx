import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  options: readonly CustomSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel = 'Select option',
  defaultOpen = false,
  className = '',
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentOption = options[selectedIndex] ?? options[0];

  const selectByIndex = (idx: number) => {
    const option = options[idx];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (options.length === 0) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(selectedIndex);
        } else {
          setActiveIndex((prev) => (prev + 1) % options.length);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(selectedIndex);
        } else {
          setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (open) {
          selectByIndex(activeIndex);
        } else {
          setOpen(true);
          setActiveIndex(selectedIndex);
        }
        break;
      }
      case 'Tab': {
        if (open) setOpen(false);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block min-w-[190px] ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
        className={`flex w-full items-center justify-between gap-2.5 rounded-none bg-[#1F0A4D] px-3.5 py-2 text-left text-sm font-bold text-white transition hover:bg-[#37128A] focus:outline-none ${
          open ? 'ring-2 ring-[#FFDC00]' : 'ring-1 ring-inset ring-white/15 focus-visible:ring-2 focus-visible:ring-[#FFDC00]'
        }`}
      >
        <span className="truncate">{currentOption?.label ?? ''}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#FFDC00] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        aria-hidden={!open}
        className={`absolute right-0 z-40 mt-1.5 w-full min-w-[210px] origin-top-right overflow-hidden rounded-none bg-[#1F0A4D] p-1 shadow-2xl ring-1 ring-white/15 transition-all duration-150 ease-out ${
          open ? 'visible scale-100 opacity-100' : 'pointer-events-none invisible scale-95 opacity-0'
        }`}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isHighlighted = index === activeIndex;
          return (
            <li
              key={option.value}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectByIndex(index)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-none px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? 'bg-[#37128A] font-extrabold text-[#FFDC00]'
                  : isHighlighted
                    ? 'bg-[#37128A]/80 font-bold text-white'
                    : 'font-semibold text-white/90 hover:bg-[#37128A]'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-[#FFDC00]" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
