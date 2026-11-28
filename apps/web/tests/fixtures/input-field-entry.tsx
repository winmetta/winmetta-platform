// A page for tests/myanmar-input-field.spec.ts: the shared Burmese field on its own, bundled by the
// spec, because no site page uses it yet. Exposes every change the field reports on `window`.
import { createRoot } from 'react-dom/client';
import { t } from '../../src/i18n/messages';
import MyanmarInputField, {
  type InputChange,
} from '../../src/components/ui/MyanmarInputField';
import { inputLabels } from '../../src/lib/myanmar-input-view';

declare global {
  interface Window {
    changes: InputChange[];
  }
}
window.changes = [];
const labels = inputLabels((key) => t('en', key));
createRoot(document.getElementById('root')!).render(
  <MyanmarInputField
    id="field"
    label="Burmese text"
    labels={labels}
    app="test-app"
    showKeys
    placeholder="ဓမ္မ"
    settleMs={50}
    onChange={(change) => window.changes.push(change)}
  />,
);
