import React from "react";

const variantClass = {
  header: "app-brand-name--header",
  profile: "app-brand-name--profile",
  desktop: "app-brand-name--desktop",
  nav: "app-brand-name--nav",
};

export function AppBrandName({
  as: Tag = "span",
  variant = "inline",
  lead,
  tail,
  children,
  className = "",
  ...props
}) {
  const variantCls = variantClass[variant] || "";
  const classes = ["app-brand-name", variantCls, className].filter(Boolean).join(" ");

  const content = lead && tail ? (
    <>
      <span className="app-brand-name__lead">{lead}</span>
      <span className="app-brand-name__accent">{tail}</span>
    </>
  ) : children;

  return (
    <Tag className={classes} {...props}>
      {content}
    </Tag>
  );
}
