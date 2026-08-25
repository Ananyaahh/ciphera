// Server wrapper so this dynamic route can be statically exported for the
// Capacitor app build. generateStaticParams provides a placeholder so the
// route is emitted; in-app navigation reads the real id client-side via
// useParams() inside Detail. On the normal (Vercel) build this is inert.
import Detail from "./Detail";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export const dynamicParams = true;

export default function Page() {
  return <Detail />;
}
