import React from "react";
import { Search, X } from "lucide-react";
import { Button, Input, SearchField } from "react-aria-components";
import { t } from "../../i18n/runtime";

export function AccessibleSearchField({ value, onChange, placeholder, ariaLabel, autoFocus = false, className = "" }) {
  return (
    <SearchField
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`accessible-search ${className}`.trim()}
      onSubmit={() => {}}
    >
      <Search className="accessible-search__icon" size={21} aria-hidden="true" />
      <Input autoFocus={autoFocus} placeholder={placeholder} inputMode="search" enterKeyHint="search" />
      {value ? <Button className="accessible-search__clear" aria-label={t("common.clearSearch")}><X size={17} /></Button> : null}
    </SearchField>
  );
}
