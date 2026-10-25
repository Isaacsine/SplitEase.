import { useId, type InputHTMLAttributes } from "react";
export function Input({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} {...props} />
    </div>
  );
}
