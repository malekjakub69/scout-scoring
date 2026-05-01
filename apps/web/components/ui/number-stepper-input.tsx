"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "max" | "min" | "step" | "type">;

export type NumberStepperInputProps = NumericInputProps & {
  /**
   * Maximální hodnota (inclusive).
   */
  max: number;

  /**
   * true: krok 0.5, false: krok 1.
   */
  halfStep?: boolean;
};

const min = 0;

const NumberStepperInput = React.forwardRef<HTMLInputElement, NumberStepperInputProps>(
  (
    { className, disabled, halfStep = false, max, onBlur, onChange, readOnly, style, value, defaultValue, ...props },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() => String(defaultValue ?? min));
    const isControlled = value !== undefined;
    const inputValue = isControlled ? value : uncontrolledValue;
    const step = halfStep ? 0.5 : 1;
    const fastStepRaw = Math.floor(0.4 * max);
    const showFastStep = fastStepRaw > 1;
    const fastStep = showFastStep ? fastStepRaw : null;
    const currentValue = clamp(toNumber(inputValue), min, max);
    const progress = max > min ? ((currentValue - min) / (max - min)) * 100 : 0;
    const controlsDisabled = disabled || readOnly;

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    function setValue(nextValue: number) {
      const next = formatNumber(clamp(nextValue, min, max));

      if (!isControlled) {
        setUncontrolledValue(next);
      }

      const input = inputRef.current;
      if (!input) {
        return;
      }

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      nativeInputValueSetter?.call(input, next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function handleStep(delta: number) {
      setValue(currentValue + delta);
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (!isControlled) {
        setUncontrolledValue(event.target.value);
      }

      onChange?.(event);
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      const next = formatNumber(clamp(toNumber(event.target.value), min, max));

      if (event.target.value !== next) {
        setValue(Number(next));
      }

      onBlur?.(event);
    }

    return (
      <div className="flex w-full items-center gap-2">
        {fastStep ? (
          <StepButton
            amount={-fastStep}
            disabled={controlsDisabled || currentValue <= min}
            onClick={() => handleStep(-fastStep)}
          />
        ) : null}
        <StepButton amount={-step} disabled={controlsDisabled || currentValue <= min} onClick={() => handleStep(-step)} />
        <Input
          ref={inputRef}
          type="number"
          inputMode={halfStep ? "decimal" : "numeric"}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          value={inputValue}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn(
            "min-w-20 text-center font-semibold tabular-nums",
            "bg-[linear-gradient(90deg,var(--stepper-progress)_0%,var(--stepper-progress)_var(--stepper-progress-width),white_var(--stepper-progress-width),white_100%)]",
            className
          )}
          style={
            {
              "--stepper-progress": "rgb(219 234 254)",
              "--stepper-progress-width": `${progress}%`,
              ...style,
            } as React.CSSProperties
          }
          {...props}
        />
        <StepButton amount={step} disabled={controlsDisabled || currentValue >= max} onClick={() => handleStep(step)} />
        {fastStep ? (
          <StepButton
            amount={fastStep}
            disabled={controlsDisabled || currentValue >= max}
            onClick={() => handleStep(fastStep)}
          />
        ) : null}
      </div>
    );
  }
);
NumberStepperInput.displayName = "NumberStepperInput";

function StepButton({
  amount,
  disabled,
  onClick,
}: {
  amount: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = amount < 0 ? Minus : Plus;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={amount < 0 ? `Odebrat ${formatNumber(Math.abs(amount))}` : `Přidat ${formatNumber(amount)}`}
      className="h-10 min-w-12 px-2 tabular-nums"
    >
      <Icon className="h-3.5 w-3.5" />
      {formatNumber(Math.abs(amount))}
    </Button>
  );
}

function toNumber(value: React.InputHTMLAttributes<HTMLInputElement>["value"]) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : min;
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

export { NumberStepperInput };
