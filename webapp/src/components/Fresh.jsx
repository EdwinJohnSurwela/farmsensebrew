import { Children } from 'react';

/// Briefly highlights its content when the shown value changes, like a live
/// counter ticking over. Keying on the text (not on the reading time) means
/// 2-second live samples only flash when a number actually changes.
/// Changing the key remounts the span, which replays the CSS flash.
export default function Fresh({ children }) {
  const text = Children.toArray(children).join('');
  return <span key={text} className="fresh">{children}</span>;
}
