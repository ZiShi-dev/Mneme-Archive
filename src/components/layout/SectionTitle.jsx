import React from "react";
import { ChevronLeft } from "lucide-react";

export function SectionTitle({ title, action, onAction, id }) {
  return <div className="section-title"><h2 id={id}>{title}</h2>{action && <button type="button" onClick={onAction}>{action}<ChevronLeft size={15} /></button>}</div>;
}

