import { DetailDrawer } from './components/DetailDrawer.tsx';
import { FacetRail } from './components/FacetRail.tsx';
import { Masthead } from './components/Masthead.tsx';
import { ParameterStrip } from './components/ParameterStrip.tsx';
import { SpecMatrix } from './components/SpecMatrix.tsx';

/**
 * Factory Index shell: dark masthead over the three-column register —
 * facet rail / spec matrix / detail drawer.
 */
export default function App() {
  return (
    <div className="app">
      <Masthead />
      <div className="shell">
        <FacetRail />
        <main>
          <ParameterStrip />
          <SpecMatrix />
        </main>
        <DetailDrawer />
      </div>
    </div>
  );
}
