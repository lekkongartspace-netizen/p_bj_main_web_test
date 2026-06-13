"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Thai } from "flatpickr/dist/l10n/th";

interface FlatpickrInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  enableTime?: boolean;
  noCalendar?: boolean;
  dateFormat?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function FlatpickrInput({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  enableTime = false,
  noCalendar = false,
  dateFormat,
  className = "",
}: FlatpickrInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    fpRef.current = flatpickr(inputRef.current, {
      locale: Thai,
      enableTime,
      noCalendar,
      time_24hr: true,
      // The stored value (real input) stays Gregorian so calcAge and existing
      // data keep working...
      dateFormat: dateFormat || (enableTime ? "d/m/Y H:i" : "d/m/Y"),
      // ...while the visible alt input shows the Buddhist (พ.ศ.) year.
      altInput: true,
      altFormat: "BE",
      defaultDate: value || undefined,
      formatDate: (date, format) => {
        const dd = pad(date.getDate());
        const mm = pad(date.getMonth() + 1);
        const yyyy = date.getFullYear();
        const year = format === "BE" ? yyyy + 543 : yyyy;
        const datePart = `${dd}/${mm}/${year}`;
        if (enableTime) {
          return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }
        return datePart;
      },
      onChange: (_, dateStr) => {
        onChange(dateStr);
      },
    });

    return () => {
      fpRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fpRef.current && value) {
      fpRef.current.setDate(value, false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      placeholder={placeholder}
      readOnly
      className={`input-field cursor-pointer ${className}`}
    />
  );
}
