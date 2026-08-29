// Iframe height handshake.
//
// The form is tall and its height changes with every step, so a fixed-height
// iframe would either clip the footer or leave a large gap. The page reports
// its own height to the parent, which resizes the frame to match.
//
// Only the height is ever sent. Nothing about the patient crosses the frame
// boundary, and the parent page cannot read into the frame either — it is a
// different origin, which is exactly why embedding is preferable to hosting
// this form inside the marketing site.

const CHANNEL = 'carexps-intake';

export function startEmbedBridge() {
  if (window.parent === window) return;   // not framed

  // The page normally fills the tablet screen (`min-height: 100vh` on body,
  // `58vh` on the content area). Inside a frame that is a feedback loop: the
  // parent sizes the frame to the reported height, the body then measures
  // exactly that height, and the form can never grow or shrink again. The
  // embedded stylesheet drops both so the measurement follows real content.
  document.documentElement.classList.add('is-embedded');

  let last = 0;
  const measure = () => {
    const body = document.body;
    if (!body) return 0;
    const rect = body.getBoundingClientRect();
    return Math.ceil(Math.max(rect.height, body.scrollHeight));
  };

  const report = () => {
    const height = measure();
    if (Math.abs(height - last) < 2) return;
    last = height;
    window.parent.postMessage({ channel: CHANNEL, type: 'height', height }, '*');
  };

  // Step changes rebuild the screen wholesale, and conditional fields appear
  // and disappear inside a step, so watch the DOM rather than guessing.
  new MutationObserver(report).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class']
  });
  window.addEventListener('resize', report);
  window.addEventListener('load', report);
  setInterval(report, 1000);   // cheap backstop for anything the observer misses
  report();

  window.parent.postMessage({ channel: CHANNEL, type: 'ready' }, '*');
}
