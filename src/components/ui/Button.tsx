import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "ghost" | "leaf" | "coral";

export function Button({
  variant = "default",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variantClass = variant === "default" ? "" : " " + variant;
  return <button className={"btn" + variantClass + (className ? " " + className : "")} {...rest} />;
}
