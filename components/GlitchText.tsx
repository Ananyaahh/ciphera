export default function GlitchText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`glitch-text ${className}`} data-text={text}>
      {text}
    </span>
  );
}
