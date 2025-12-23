import '@testing-library/jest-dom';

// Extend Jest matchers for all test files
// This file is included in tsconfig.json and picked up by Jest automatically

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}
