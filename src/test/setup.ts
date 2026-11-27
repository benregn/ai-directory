import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React 19 act() gate for testing-library's render/fireEvent wrapping.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom gaps the virtualizer and focus machinery hit. Assigned, not ??=:
// jsdom ships some of these without the parts that matter (per the ui-sdk
// testing guide).
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = function () {};
// jsdom ships no scrollTo at all; a faithful stub moves scrollTop the way
// a real browser does and fires the scroll event code listens for.
Element.prototype.scrollTo = function (
  this: HTMLElement,
  options?: ScrollToOptions | number,
  y?: number,
) {
  if (typeof options === 'number') {
    this.scrollTop = y ?? 0;
    this.scrollLeft = options;
  } else if (options) {
    if (typeof options.top === 'number') {
      this.scrollTop = options.top;
    }
    if (typeof options.left === 'number') {
      this.scrollLeft = options.left;
    }
  }
  this.dispatchEvent(new Event('scroll'));
};

afterEach(cleanup);
