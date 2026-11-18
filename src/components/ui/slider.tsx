import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

/** Slider de duas pontas: um Thumb por valor. Os rótulos vêm de `thumbLabels`. */
function Slider({
  className,
  thumbLabels,
  getValueText,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props<readonly number[]> & {
  thumbLabels: readonly string[]
  getValueText?: (value: number) => string
}) {
  /** O input range já tem min/max nativos; os atributos ARIA ficam explícitos para leitores de tela. */
  const setBounds = (input: HTMLInputElement | null) => {
    input?.setAttribute('aria-valuemin', String(min))
    input?.setAttribute('aria-valuemax', String(max))
  }
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn("w-full", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex h-6 w-full touch-none items-center select-none">
        <SliderPrimitive.Track className="h-0.5 w-full rounded-full bg-border select-none">
          <SliderPrimitive.Indicator className="rounded-full bg-primary select-none" />
          {thumbLabels.map((label, index) => (
            <SliderPrimitive.Thumb
              key={label}
              index={index}
              aria-label={label}
              inputRef={setBounds}
              getAriaValueText={getValueText ? (_, v) => getValueText(v) : undefined}
              className="size-3.5 rounded-full bg-primary outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
