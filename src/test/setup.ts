import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React 19 act() gate for testing-library's render/fireEvent wrapping.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__UI_SDK_STRICT__ = true;

HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);
