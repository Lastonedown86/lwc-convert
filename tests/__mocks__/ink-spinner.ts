/**
 * Mock for ink-spinner
 */

import React from 'react';

const Spinner = ({ type }: { type?: string }) => {
  return React.createElement('ink-spinner', { type }, '⠋');
};

export default Spinner;
