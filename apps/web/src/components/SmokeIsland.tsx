import { useState } from 'react';
import { Button } from './ui/button';
interface Props {
  show: string;
  hide: string;
  details: string;
}
export default function SmokeIsland({ show, hide, details }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="space-y-4">
      <Button
        type="button"
        aria-expanded={expanded}
        aria-controls="sample-details"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? hide : show}
      </Button>
      <p id="sample-details" hidden={!expanded}>
        {details}
      </p>
    </section>
  );
}
