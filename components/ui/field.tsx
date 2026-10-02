import { cn } from "./cn";

const control =
  "w-full min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
      {children}
      {hint ? <span className="ml-1 font-normal text-ink-3">({hint})</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, className)} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, "appearance-none", className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-24 py-2", className)} />;
}

/** Large single-choice chips (radio semantics) for thumb-friendly forms. */
export function ChoiceChips<T extends string>({
  name,
  options,
  value,
  onChange,
  legend,
}: {
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  legend: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium",
              value === o.value ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
