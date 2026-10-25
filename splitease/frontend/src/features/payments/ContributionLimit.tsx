import { Input } from "../../components/ui/Input";
export function ContributionLimit({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <Input
        label="Maximum contribution (ZAR)"
        type="number"
        min="0.01"
        max="1000000"
        step="0.01"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="muted">
        A limit is a ceiling, not an extra charge. You pay only your final
        share.
      </p>
    </>
  );
}
