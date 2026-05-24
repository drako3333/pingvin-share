import { NativeSelect, NumberInput } from "@mantine/core";
import { useState } from "react";

const multipliers = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const units = (
  ["B", "KB", "MB", "GB", "TB"] as const
).map((unit) => ({ label: unit, value: unit }));

function getLargestApplicableUnit(value: number) {
  if (value === 0) return units.find((u) => u.value === "MB") || units[0];
  return (
    units.findLast((unit) => value % multipliers[unit.value] === 0) || units[0]
  );
}

const FileSizeInput = ({
  label,
  value,
  onChange,
  min = 1,
  ...restProps
}: {
  label?: string;
  value: number;
  min?: number;
  // eslint-disable-next-line no-unused-vars
  onChange: (number: number) => void;
  [key: string]: any;
}) => {
  const [unit, setUnit] = useState(getLargestApplicableUnit(value).value);
  const [inputValue, setInputValue] = useState(value / multipliers[unit]);
  const unitSelect = (
    <NativeSelect
      data={units}
      value={unit}
      rightSectionWidth={28}
      styles={{
        input: {
          fontWeight: 500,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          width: 76,
          marginRight: -2,
        },
      }}
      onChange={(event) => {
        const unit = event.currentTarget
          .value as (typeof units)[number]["value"];
        setUnit(unit);
        onChange(multipliers[unit] * inputValue);
      }}
    />
  );

  return (
    <NumberInput
      label={label}
      value={inputValue}
      min={min}
      max={999999}
      decimalScale={0}
      allowDecimal={false}
      rightSection={unitSelect}
      rightSectionWidth={76}
      onChange={(value) => {
        const inputVal =
          typeof value === "number" ? value : parseFloat(value) || 0;
        setInputValue(inputVal);
        onChange(multipliers[unit] * inputVal);
      }}
      {...restProps}
    />
  );
};

export default FileSizeInput;
