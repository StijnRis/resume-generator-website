interface ValidationErrorListProps {
  title: string;
  errors: { path: string; message: string }[];
  footer?: string;
  variant?: "warning" | "error";
}

export function ValidationErrorList({
  title,
  errors,
  footer,
  variant = "warning",
}: ValidationErrorListProps) {
  const styles =
    variant === "error"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-amber-50 border-amber-200 text-amber-800";

  const codeStyles =
    variant === "error" ? "bg-red-100" : "bg-amber-100";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <p className="font-medium mb-2">{title}</p>
      <ul className="space-y-1.5">
        {errors.map((issue, index) => (
          <li key={`${issue.path}-${index}`} className="flex gap-2 items-start">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>
              <code className={`text-xs px-1.5 py-0.5 rounded ${codeStyles}`}>
                {issue.path}
              </code>
              {" — "}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-2 text-sm opacity-90">{footer}</p>}
    </div>
  );
}
