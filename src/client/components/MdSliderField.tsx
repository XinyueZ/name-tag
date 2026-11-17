import React from 'react'

export interface MdSliderFieldProps {
  readonly label: string
  readonly badge: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly hint?: string
  readonly headerAction?: React.ReactNode
  readonly onChange: (value: number) => void
}

export function MdSliderField(props: MdSliderFieldProps): React.JSX.Element {
  return (
    <div className="nt-slider-field">
      <div className="nt-slider-head">
        <span className="nt-slider-label">{props.label}</span>
        <span className="nt-slider-head-right">
          {props.headerAction}
          <span className="nt-slider-badge">{props.badge}</span>
        </span>
      </div>
      <input
        className="nt-range"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      {props.hint ? <div className="nt-slider-hint">{props.hint}</div> : null}
    </div>
  )
}
