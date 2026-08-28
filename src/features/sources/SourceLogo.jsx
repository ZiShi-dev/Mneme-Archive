import React, { useEffect, useState } from "react";
import { getSourceProfile } from "../../config/sources";

export function SourceLogo({ sourceId = "mangalik", large = false, className = "" }) {
  const [failed, setFailed] = useState(false);
  const profile = getSourceProfile(sourceId);

  useEffect(() => setFailed(false), [sourceId]);

  const classes = `source-logo source-logo--official source-logo--${sourceId} ${large ? "source-logo--large" : ""} ${className}`.trim();
  return <span className={classes}>{failed ? profile.initials : <img src={profile.logo} alt={profile.name} loading="lazy" onError={() => setFailed(true)} />}</span>;
}


