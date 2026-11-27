import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React 19 act() gate for testing-library's render/fireEvent wrapping.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);
