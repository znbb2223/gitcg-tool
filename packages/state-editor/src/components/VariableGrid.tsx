import { For } from "solid-js";
import { variableHint, variableLabel } from "../state/variable-labels";
import { NumberField } from "./Fields";

export function VariableGrid(props: {
  entries: readonly [string, number | undefined][];
  disabled?: boolean;
  readOnlyKeys?: readonly string[];
  onChange: (key: string, value: number) => void;
}) {
  const readOnly = () => new Set(props.readOnlyKeys ?? []);
  return (
    <div class="grid gap-3 sm:grid-cols-2">
      <For each={props.entries}>
        {([key, value]) => (
          <NumberField
            label={variableLabel(key)}
            hint={variableHint(key)}
            value={value}
            disabled={props.disabled}
            readOnly={readOnly().has(key)}
            onChange={(nextValue) => props.onChange(key, nextValue)}
          />
        )}
      </For>
    </div>
  );
}
