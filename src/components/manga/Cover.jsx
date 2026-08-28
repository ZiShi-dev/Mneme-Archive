import React from "react";
export function Cover({ item, large = false }) {
  return (
    <div className={`cover cover--${item.accent} ${large ? "cover--large" : ""}`}>
      <div className="cover__halo" />
      <span className="cover__mark">{item.mark}</span>
      <div className="cover__mountains" />
      <span className="cover__label">MANHUA</span>
    </div>
  );
}



