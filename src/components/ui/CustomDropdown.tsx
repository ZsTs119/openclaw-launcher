// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Custom Dropdown — styled select matching the app's dark theme.
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownOption {
    value: string;
    label: string;
    sublabel?: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function CustomDropdown({ options, value, onChange, placeholder = "请选择" }: CustomDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="custom-dropdown" ref={ref}>
            <button
                type="button"
                className="custom-dropdown-trigger"
                onClick={() => setOpen(!open)}
            >
                <span className={selected ? "" : "dropdown-placeholder"}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={14} strokeWidth={2} className={`dropdown-arrow ${open ? "open" : ""}`} />
            </button>
            {open && (
                <div className="custom-dropdown-menu">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`custom-dropdown-item ${opt.value === value ? "active" : ""}`}
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                        >
                            <span className="dropdown-item-label">{opt.label}</span>
                            {opt.sublabel && <span className="dropdown-item-sub">{opt.sublabel}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
