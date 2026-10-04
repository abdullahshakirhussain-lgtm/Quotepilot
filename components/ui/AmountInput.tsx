"use client";

import { useState } from "react";
import { readAmount } from "@/lib/money";
import { formatCurrency } from "@/lib/utils";

/**
 * A money field that accepts the amount the way people type it (1,250.00,
 * 1.250,00, $1,250...) and shows underneath what QuoteLoop understood, so a
 * misread amount is caught before it is saved or emailed.
 */
export function AmountInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  currency,
  required,
}: {
  id: string;
  /** Set when the field is read from a form submission. */
  name?: string;
  /** Controlled value; leave out to let the field keep its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  currency: string;
  required?: boolean;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const text = value ?? own;
  const amount = readAmount(text);
  const hintId = `${id}-reads-as`;

  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        className="input num"
        value={text}
        onChange={(e) => {
          if (value === undefined) setOwn(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder="0.00"
        aria-describedby={text.trim() ? hintId : undefined}
      />
      {text.trim() !== "" && (
        <p id={hintId} className={amount === null ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-stone-500"} aria-live="polite">
          {amount === null ? (
            "Enter a number, like 1250 or 1,250.00."
          ) : (
            <>
              Saved as <span className="num font-medium text-stone-800">{formatCurrency(amount, currency)}</span>
            </>
          )}
        </p>
      )}
    </>
  );
}
