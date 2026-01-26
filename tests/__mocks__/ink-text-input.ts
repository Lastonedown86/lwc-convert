/**
 * Mock for ink-text-input
 */

import React from 'react';

interface TextInputProps {
  value: string;
  placeholder?: string;
  focus?: boolean;
  mask?: string;
  showCursor?: boolean;
  highlightPastedText?: boolean;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
}

const TextInput = ({ value, placeholder }: TextInputProps) => {
  return React.createElement('ink-text-input', {}, value || placeholder || '');
};

export default TextInput;
