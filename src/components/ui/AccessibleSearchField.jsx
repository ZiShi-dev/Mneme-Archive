import React from "react";
import { Search, X } from "lucide-react";
import { Button, Input, SearchField } from "react-aria-components";
import { t } from "../../i18n/runtime";
import { MAX_SEARCH_QUERY_LENGTH } from "../../../server/lib/queryLimits.js";

export function AccessibleSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus = false,
  className = "",
  busy = false,
  maxLength = MAX_SEARCH_QUERY_LENGTH,
}) {
  return (
    <SearchField
      value={value}
      onChange={(next) => onChange(String(next ?? "").slice(0, maxLength))}
      aria-label={ariaLabel}
      className={`accessible-search ${className}`.trim()}
      onSubmit={() => {}}
    >
      <Search className="accessible-search__icon" size={21} aria-hidden="true" />
      <Input
        autoFocus={autoFocus}
        placeholder={placeholder}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={maxLength}
        aria-busy={busy || undefined}
      />
      {value ? <Button className="accessible-search__clear" aria-label={t("common.clearSearch")}><X size={17} /></Button> : null}
    </SearchField>
  );
}
